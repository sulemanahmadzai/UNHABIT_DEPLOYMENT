# Stripe API Reference

This document covers all Stripe-related endpoints exposed by the UnHabit backend. Intended for frontend developers integrating subscription and billing flows.

---

## Base URL

```
http://localhost:3000/api/stripe
```

---

## Authentication

All endpoints (except `GET /config`) require a valid JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### GET /config

Returns the Stripe publishable key needed to initialize the Stripe.js client on the frontend.

No authentication required.

**Response**
```json
{
  "success": true,
  "publishableKey": "pk_live_..."
}
```

Usage: Call this once on app load and use `publishableKey` to initialize `loadStripe()`.

---

### POST /create-checkout-session

Creates a Stripe Checkout Session for a new subscription. Redirects the user to Stripe's hosted checkout page.

**Request Body**
```json
{
  "priceId": "price_1ABC...",
  "successUrl": "https://yourapp.com/success",
  "cancelUrl": "https://yourapp.com/cancel"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `priceId` | string | yes | Stripe Price ID for the plan |
| `successUrl` | string | yes | Full URL to redirect after successful payment |
| `cancelUrl` | string | yes | Full URL to redirect if user cancels |

**Response**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

Usage: Redirect the user to `url`, or use `sessionId` with `stripe.redirectToCheckout({ sessionId })`.

**Error cases**
- `400` — User already has an active subscription
- `422` — Validation error (missing/invalid fields)

---

### POST /create-portal-session

Creates a Stripe Customer Portal session so the user can manage their billing, update payment methods, or view invoices.

**Request Body**
```json
{
  "returnUrl": "https://yourapp.com/settings"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `returnUrl` | string | yes | URL to return to after leaving the portal |

**Response**
```json
{
  "success": true,
  "url": "https://billing.stripe.com/session/..."
}
```

Usage: Redirect the user to `url`. They'll be taken back to `returnUrl` when done.

**Error cases**
- `404` — User has no Stripe customer record (hasn't subscribed before)

---

### GET /subscription

Returns the current user's subscription status.

**Response — active subscription**
```json
{
  "success": true,
  "hasActiveSubscription": true,
  "subscription": {
    "id": "uuid",
    "status": "active",
    "currentPeriodStart": "2026-03-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-04-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "canceledAt": null
  }
}
```

**Response — no subscription**
```json
{
  "success": true,
  "hasActiveSubscription": false,
  "subscription": null
}
```

Subscription `status` values:

| Value | Meaning |
|---|---|
| `active` | Paid and current |
| `trialing` | In free trial period |
| `canceled` | Canceled (may still have access until period end) |
| `past_due` | Payment failed, awaiting retry |
| `incomplete` | Initial payment not completed |

Use `hasActiveSubscription` as the quick boolean check for gating premium features.

---

### POST /cancel-subscription

Cancels the user's subscription at the end of the current billing period. The user retains access until `currentPeriodEnd`.

No request body needed.

**Response**
```json
{
  "success": true,
  "message": "Subscription will be canceled at the end of the billing period"
}
```

**Error cases**
- `400` — No active subscription found

After calling this, `GET /subscription` will return `cancelAtPeriodEnd: true`.

---

### POST /reactivate-subscription

Reactivates a subscription that was set to cancel at period end. Only works if the period hasn't ended yet.

No request body needed.

**Response**
```json
{
  "success": true,
  "message": "Subscription reactivated successfully"
}
```

**Error cases**
- `400` — No cancelable subscription found to reactivate

---

## Typical Frontend Flows

### New subscription flow

```
1. GET /config                          → get publishableKey, init Stripe.js
2. POST /create-checkout-session        → get checkout URL
3. Redirect user to URL
4. On return to successUrl:
   GET /subscription                    → confirm active status
```

### Manage billing flow

```
1. POST /create-portal-session          → get portal URL
2. Redirect user to URL
3. User returns to returnUrl automatically
```

### Cancel / reactivate flow

```
Cancel:     POST /cancel-subscription
Reactivate: POST /reactivate-subscription
Check:      GET /subscription  →  cancelAtPeriodEnd: true/false
```

---

## Error Response Shape

All errors follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

Standard HTTP status codes apply: `400` for bad input, `401` for missing/invalid auth, `404` for not found, `500` for server errors.
