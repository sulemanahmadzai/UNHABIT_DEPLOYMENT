# Stripe one-time purchase — Backend APIs & React Native flow

This document explains **what each API does**, **in what order to call them**, **what you send and receive**, and **what the React Native app must do after each response**. It is the handoff spec for mobile engineers integrating with this backend.

**Product type:** **One-time charge** (user pays once). It is **not** a recurring Stripe subscription. There is no subscription to cancel in-app for this flow.

**Payment UX:** **Stripe PaymentSheet** (`@stripe/stripe-react-native`) — native sheet for card / Apple Pay / Google Pay where enabled. Card numbers **never** go to your Node API; they are collected by Stripe’s SDK and sent to Stripe’s servers.

**Out of scope:** Hosted Checkout URLs, Customer Portal, subscription cancel/reactivate endpoints — do **not** use those for this product.

---

## Base URL

Prefix all paths with your API host, e.g.:

- Local: `http://localhost:3000`
- Production: `https://<your-api-host>`

Example: `POST https://api.example.com/api/auth/login`

---

## Order of operations (end-to-end)

Follow this sequence in the app. Skipping a step or reordering will break the flow.

| Step | Who | Action |
|------|-----|--------|
| 1 | App + backend | **Authenticate** → obtain `access_token` |
| 2 | App + backend | **Create PaymentSheet session** → obtain Stripe secrets |
| 3 | App (React Native) | **Configure Stripe SDK** with `publishableKey` |
| 4 | App (React Native) | **`initPaymentSheet`** then **`presentPaymentSheet`** |
| 5 | App + backend | **Refresh entitlement** (user is “paid” only after server knows — webhook) |

Below, each step is detailed: **request → response → frontend work**.

---

### Step 1 — Authenticate (required first)

**Purpose:** The payment API is protected. Stripe routes require a valid **Supabase JWT** so the backend knows **which user** is paying and can attach the Stripe Customer + metadata.

#### Option A: Email and password

| | |
|--|--|
| **You call** | `POST /api/auth/login` |
| **Headers** | `Content-Type: application/json` |
| **Body (JSON)** | `{ "email": "user@example.com", "password": "atleast8chars" }` |
| **Auth header** | None |

**Success response (200):**

```json
{
  "success": true,
  "user": { "id": "uuid", "email": "...", "created_at": "..." },
  "access_token": "<jwt>",
  "refresh_token": "<refresh>",
  "expires_in": 3600
}
```

#### Option B: OAuth (Google / Apple) — typical for your app

| | |
|--|--|
| **You call** | `POST /api/auth/oauth/google` **or** `POST /api/auth/oauth/apple` |
| **Headers** | `Content-Type: application/json` |
| **Body (JSON)** | `{ "id_token": "<from Google or Apple>" }` — for Apple, add `"nonce": "..."` if your flow uses a nonce |

**Success response:** Same shape as Option A: includes **`access_token`** and **`refresh_token`**.

#### What the React Native app must do after Step 1

1. **Persist** `access_token` securely (e.g. secure storage / Supabase session), not plain `AsyncStorage` for production if you have a stronger option.
2. For every **next** HTTP call to your API (Step 2), set:

   `Authorization: Bearer <access_token>`

3. When the token expires, refresh using your existing auth approach (Supabase `onAuthStateChange`, refresh endpoint, or re-login).

---

### Step 2 — Create PaymentSheet session (core backend payment API)

**Purpose:** Your server creates a **Stripe PaymentIntent** (amount/currency from Stripe **Price**), creates an **ephemeral key** for the Customer, and returns everything the **Stripe React Native SDK** needs to show **PaymentSheet**.  
This call **does not** charge the card. It **prepares** the payment.

| | |
|--|--|
| **You call** | `POST /api/stripe/create-payment-sheet` |
| **Headers** | `Content-Type: application/json`<br>`Authorization: Bearer <access_token>` |
| **Body (JSON)** | `{ "priceId": "price_xxxxxxxxxxxxx" }` |

| Field | Required | Notes |
|-------|----------|--------|
| `priceId` | Yes | Stripe **Price** id. Must be **one-time** (not recurring) in Stripe Dashboard. Amount and currency come from this Price on the server — **do not** send amount from the app. |

**Success response (200):**

```json
{
  "success": true,
  "paymentIntent": "pi_xxx_secret_xxx",
  "ephemeralKey": "ek_test_xxx",
  "customer": "cus_xxx",
  "publishableKey": "pk_test_xxx"
}
```

| Response field | Meaning |
|----------------|--------|
| `paymentIntent` | **PaymentIntent client secret** — ties PaymentSheet to this charge |
| `ephemeralKey` | Short-lived secret so the SDK can read Customer payment methods for this session |
| `customer` | Stripe **Customer** id (`cus_...`) |
| `publishableKey` | Stripe **publishable** key — safe to ship in the app; identifies your Stripe account (test vs live) |

**Typical errors**

- **401** — Missing/expired `access_token`
- **400** — Bad JSON, wrong `priceId`, price not **one-time**, inactive price, or not in `STRIPE_ALLOWED_ONE_TIME_PRICE_IDS` (if your server sets that env)
- **500** — `STRIPE_SECRET_KEY` missing on server, or Stripe API error

#### What the React Native app must do after Step 2

1. **Immediately** use the four values with the Stripe SDK (Step 3–4). Do not treat the user as “paid” yet.
2. **Do not** log full `paymentIntent` / `ephemeralKey` in production logs (they are secrets).
3. If the request fails, show an error and **do not** call `initPaymentSheet` with stale data from a previous purchase.

---

### Step 3 — Initialize Stripe in the app (React Native)

**Purpose:** The Stripe SDK must know your **publishable** key before PaymentSheet can run.

#### React Native concepts

- Install **`@stripe/stripe-react-native`** and complete **native setup** (iOS `pod install`, Android Gradle), per [Stripe’s React Native docs](https://stripe.com/docs/payments/accept-a-payment?platform=react-native).
- Wrap your app (or payment subtree) in **`StripeProvider`** from the library, **or** call **`initStripe`** once with `{ publishableKey }`.
- Use the **`publishableKey`** from **Step 2’s response** (or the same key from `GET /api/stripe/config` if you prefer a two-step split — usually Step 2 is enough).

**Example pattern (conceptual):**

```tsx
// Use publishableKey from create-payment-sheet response (or from env in dev)
<StripeProvider publishableKey={publishableKey}>
  <PaymentScreen />
</StripeProvider>
```

You can initialize Stripe once at app launch if you fetch `publishableKey` early; for **simplicity**, using the key returned **with** the PaymentIntent keeps keys in sync with the session you just created.

---

### Step 4 — Present PaymentSheet (React Native)

**Purpose:** Show Stripe’s native UI so the user enters a card (or wallet). Stripe **confirms** the PaymentIntent when the user succeeds.

#### React Native concepts

- Use the hook **`useStripe()`** from `@stripe/stripe-react-native` to get **`initPaymentSheet`** and **`presentPaymentSheet`**.
- Call **`initPaymentSheet`** **first** with the secrets from Step 2, **then** **`presentPaymentSheet`**.
- Map backend fields → SDK parameters:

| Backend (Step 2) | `initPaymentSheet` parameter |
|------------------|-----------------------------|
| `paymentIntent` | `paymentIntentClientSecret` |
| `ephemeralKey` | `customerEphemeralKeySecret` |
| `customer` | `customerId` |
| (n/a) | `merchantDisplayName` — **your app name** (required string for UX) |

**Conceptual sequence:**

```tsx
const { initPaymentSheet, presentPaymentSheet } = useStripe();

// 1) After fetch(create-payment-sheet) succeeds:
const { error: initError } = await initPaymentSheet({
  merchantDisplayName: 'Your App Name',
  customerId: customer,
  customerEphemeralKeySecret: ephemeralKey,
  paymentIntentClientSecret: paymentIntent,
  allowsDelayedPaymentMethods: false,
});
if (initError) { /* show initError.message */ return; }

// 2) Then present the sheet:
const { error: presentError } = await presentPaymentSheet();
if (presentError) {
  // User cancelled or payment failed — handle presentError
  return;
}

// 3) No presentError usually means the sheet completed successfully on device.
// Still verify entitlement on YOUR backend (Step 5) — webhook is source of truth.
```

**Test mode card:** `4242 4242 4242 4242`, any future expiry, any CVC.

**User cancellation:** If the user closes the sheet without paying, you get an error / cancelled path — do not unlock premium.

---

### Step 5 — After PaymentSheet succeeds (entitlement)

**Purpose:** The device may say “success,” but your **backend** should decide if the user really paid (webhook latency, retries, fraud).

**What the backend does (automatic):** Stripe sends **`payment_intent.succeeded`** to your **Supabase `stripe-webhook`** function. The function records a row in **`payment_history`** (one-time flow only: `metadata.flow === "one_time_payment_sheet"`).

**What the React Native app should do**

1. After `presentPaymentSheet` resolves without error, call **`GET /api/auth/me`** with the same Bearer token (or refetch until ready).
2. Treat the user as unlocked when the response includes **`has_paid: true`** (and/or **`has_premium: true`** — same meaning for this product). Use **`one_time_purchase_at`** (ISO string or `null`) if you need a timestamp.
3. Optionally poll **`GET /api/auth/me`** every 1–2 seconds for a few attempts if the webhook is slightly delayed.
4. Do not unlock premium **only** from client-side success without the server returning **`has_paid`**.

**`GET /api/auth/me` response (relevant fields)**

```json
{
  "success": true,
  "user": { ... },
  "profile": { ... },
  "has_paid": true,
  "has_premium": true,
  "one_time_purchase_at": "2026-04-08T07:05:06.000Z"
}
```

`has_paid` / `has_premium` are derived from **`payment_history`**: latest **`status: succeeded`** row with **`stripe_invoice_id: null`** (one-time PaymentSheet charges). Subscription invoice payments use a non-null invoice id and are not used for this flag.

---

## Optional: `GET /api/stripe/config`

| | |
|--|--|
| **You call** | `GET /api/stripe/config` |
| **Auth** | None |

**Returns:** `{ "success": true, "publishableKey": "pk_..." }`

**Use case:** Early app bootstrap if you want `publishableKey` before any purchase. For the flow described here, Step 2 already returns `publishableKey`, so this call is **optional**.

---

## Why Stripe Dashboard shows “Incomplete” after only calling the API

| Action | Stripe |
|--------|--------|
| **Only** `POST /api/stripe/create-payment-sheet` (Postman, etc.) | Creates PaymentIntent; **no card** yet → often **Incomplete** |
| User completes **PaymentSheet** in the app | Payment method attached → **Succeeded** or **Failed** |

A **200** from `create-payment-sheet` means “ready for PaymentSheet,” **not** “payment completed.”

---

## APIs the mobile app must **not** use for this one-time flow

| Path | Reason |
|------|--------|
| `POST /api/stripe/create-checkout-session` | Different flow (subscription + session URL). |
| `POST /api/stripe/create-portal-session` | Not part of one-time PaymentSheet product. |
| `GET /api/stripe/subscription` | Subscription rows only. |
| `POST /api/stripe/cancel-subscription` | Subscription only. |
| `POST /api/stripe/reactivate-subscription` | Subscription only. |

---

## Quick reference — headers and bodies

| Step | Method | Path | Headers | Body |
|------|--------|------|---------|------|
| 1a | POST | `/api/auth/login` | `Content-Type: application/json` | `{ "email", "password" }` |
| 1b | POST | `/api/auth/oauth/google` or `.../apple` | `Content-Type: application/json` | `{ "id_token", "nonce"? }` |
| 2 | POST | `/api/stripe/create-payment-sheet` | `Content-Type: application/json`, `Authorization: Bearer <jwt>` | `{ "priceId" }` |
| — | GET | `/api/stripe/config` | none | none |

---

## Checklist — backend / DevOps

- `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` on the API server.
- Stripe **one-time** Price; `priceId` communicated to the app (config/constants).
- Optional: `STRIPE_ALLOWED_ONE_TIME_PRICE_IDS` (comma-separated).
- Webhook: **`payment_intent.succeeded`** and **`payment_intent.payment_failed`** → Supabase `stripe-webhook` deployed.

## Checklist — React Native

- `@stripe/stripe-react-native` installed and native projects configured.
- Auth: obtain and store `access_token`; send `Bearer` on `create-payment-sheet`.
- Purchase flow: **fetch session → initPaymentSheet → presentPaymentSheet → refresh user from backend**.
- POST bodies: **JSON** type in clients (not raw “Text” only).
- API version / ephemeral keys aligned with backend (`STRIPE_API_VERSION` in `src/services/stripe.service.ts`).

## Checklist — QA (Postman / RapidAPI)

- 200 + four secrets = OK for **SDK** next step, not “paid” in Dashboard until PaymentSheet completes.
- **Incomplete** in Stripe after API-only call is **expected**.

---

## Supabase Edge webhook — deploy, fix, and verify

The `stripe-webhook` function must **not** import the Stripe Node SDK or `@supabase/supabase-js` on Edge: they pull **Node polyfills** (`deno.land/std/node` → `Deno.core.runMicrotasks`), which **crash** the worker after the handler runs.

**This repo’s function uses:**

- Native **`Deno.serve`**.
- **`fetch` only**: Stripe REST (`https://api.stripe.com/v1/...`) and Supabase **PostgREST** (`/rest/v1/...`) with the **service role** key — no npm/esm Stripe or Supabase client libraries.

**Deploy**

```bash
cd backend   # or repo root where supabase/ lives
supabase functions deploy stripe-webhook --project-ref <YOUR_PROJECT_REF>
```

Ensure function secrets include: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Edge Functions → stripe-webhook → Secrets).

**Verify**

1. Stripe Dashboard → Developers → Webhooks → your endpoint → confirm deliveries return **HTTP 200** (not 500/400).
2. Supabase → Edge Functions → `stripe-webhook` → Logs: you should see `Received event: payment_intent.succeeded` and `One-time payment recorded...` **without** an `UncaughtException` / `runMicrotasks` error after it.
3. Table Editor → **`payment_history`**: new row for the user after a successful in-app PaymentSheet payment.
4. **`GET /api/auth/me`**: **`has_paid`** becomes **`true`** after the row exists (may take 1–5 s after payment).

**Local webhook test (optional)**

```bash
stripe listen --forward-to https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
```

Use the signing secret from `stripe listen` in the function’s `STRIPE_WEBHOOK_SECRET` for that test, or trigger test events from the Stripe Dashboard against the deployed URL.

---

*Handoff: one-time PaymentSheet + Unhabit backend only.*
