// @ts-nocheck — This file runs on Deno (Supabase Edge Functions), not Node.
/**
 * Stripe webhook — Supabase Edge (Deno).
 *
 * No Stripe SDK and no @supabase/supabase-js: both pull Node-compat code
 * (deno.land/std/node → Deno.core.runMicrotasks) on Edge and crash after the handler.
 * This file uses fetch-only calls to Stripe REST and PostgREST.
 */

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ONE_TIME_PAYMENT_FLOW = "one_time_payment_sheet";

type Json = Record<string, unknown>;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "Missing stripe-signature header" }, 400);
  }

  try {
    const body = await req.text();

    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      return json({ error: "Invalid Stripe signature" }, 400);
    }

    const event = JSON.parse(body) as { type: string; data: { object: Json } };

    console.log(`Received event: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    return json({ received: true }, 200);
  } catch (err) {
    console.error("Webhook error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown webhook error" },
      400,
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const elements = signatureHeader.split(",").map((part) => part.trim());
    const timestampPart = elements.find((part) => part.startsWith("t="));
    const v1Signatures = elements
      .filter((part) => part.startsWith("v1="))
      .map((part) => part.split("=")[1])
      .filter((value): value is string => Boolean(value));

    if (!timestampPart || v1Signatures.length === 0) {
      console.error("Invalid Stripe signature header format");
      return false;
    }

    const timestamp = timestampPart.split("=")[1];

    if (!timestamp) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload),
    );

    const expectedSignature = toHex(sig);
    return v1Signatures.some((candidate) =>
      secureCompare(expectedSignature, candidate)
    );
  } catch (error) {
    console.error("Stripe signature verification failed:", error);
    return false;
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function stripeGetSubscription(subscriptionId: string): Promise<Json> {
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe subscription retrieve ${res.status}: ${text}`);
  }
  return JSON.parse(text) as Json;
}

async function restPost(
  table: string,
  query: string,
  body: unknown,
  prefer: string,
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PostgREST POST ${table} ${res.status}: ${t}`);
  }
}

async function restPatch(
  table: string,
  query: string,
  body: Json,
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PostgREST PATCH ${table} ${res.status}: ${t}`);
  }
}

function metaString(obj: Json | undefined, key: string): string | undefined {
  const m = obj?.metadata as Record<string, string> | undefined;
  return m?.[key];
}

function num(obj: Json, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" ? v : undefined;
}

async function handleSubscriptionUpdate(subscription: Json) {
  const userId = metaString(subscription, "user_id");

  if (!userId) {
    console.error("No user_id in subscription metadata");
    return;
  }

  const items = subscription.items as { data?: Array<{ price?: { id?: string }; quantity?: number }> } | undefined;
  const firstItem = items?.data?.[0];

  const subscriptionData = {
    user_id: userId,
    stripe_subscription_id: subscription.id as string,
    stripe_customer_id: subscription.customer as string,
    status: subscription.status as string,
    price_id: firstItem?.price?.id || "",
    quantity: firstItem?.quantity || 1,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_start: num(subscription, "current_period_start")
      ? new Date(num(subscription, "current_period_start")! * 1000).toISOString()
      : null,
    current_period_end: num(subscription, "current_period_end")
      ? new Date(num(subscription, "current_period_end")! * 1000).toISOString()
      : null,
    ended_at: num(subscription, "ended_at")
      ? new Date(num(subscription, "ended_at")! * 1000).toISOString()
      : null,
    canceled_at: num(subscription, "canceled_at")
      ? new Date(num(subscription, "canceled_at")! * 1000).toISOString()
      : null,
    trial_start: num(subscription, "trial_start")
      ? new Date(num(subscription, "trial_start")! * 1000).toISOString()
      : null,
    trial_end: num(subscription, "trial_end")
      ? new Date(num(subscription, "trial_end")! * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  await restPost(
    "subscriptions",
    "?on_conflict=stripe_subscription_id",
    subscriptionData,
    "resolution=merge-duplicates",
  );

  console.log(`Subscription ${subscription.id} updated for user ${userId}`);
}

async function handleSubscriptionDeleted(subscription: Json) {
  await restPatch(
    "subscriptions",
    `?stripe_subscription_id=eq.${encodeURIComponent(subscription.id as string)}`,
    {
      status: "canceled",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  );

  console.log(`Subscription ${subscription.id} deleted`);
}

async function handleInvoicePaymentSucceeded(invoice: Json) {
  const subId = invoice.subscription as string | undefined;
  const piId = invoice.payment_intent as string | undefined;

  if (!subId || !piId) {
    console.log(
      "invoice.payment_succeeded skipped: missing subscription or payment_intent",
    );
    return;
  }

  const subscription = await stripeGetSubscription(subId);
  const userId = metaString(subscription, "user_id");

  if (!userId) {
    console.error("No user_id in subscription metadata");
    return;
  }

  await restPost(
    "payment_history",
    "?on_conflict=stripe_payment_intent_id",
    {
      user_id: userId,
      stripe_payment_intent_id: piId,
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: "succeeded",
      payment_method_type: "card",
      created_at: new Date().toISOString(),
    },
    "resolution=merge-duplicates",
  );

  console.log(`Payment succeeded for invoice ${invoice.id}`);
}

async function handleInvoicePaymentFailed(invoice: Json) {
  const subId = invoice.subscription as string | undefined;
  const piId = invoice.payment_intent as string | undefined;

  if (!subId || !piId) {
    console.log(
      "invoice.payment_failed skipped: missing subscription or payment_intent",
    );
    return;
  }

  const subscription = await stripeGetSubscription(subId);
  const userId = metaString(subscription, "user_id");

  if (!userId) {
    console.error("No user_id in subscription metadata");
    return;
  }

  await restPost(
    "payment_history",
    "?on_conflict=stripe_payment_intent_id",
    {
      user_id: userId,
      stripe_payment_intent_id: piId,
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: "failed",
      payment_method_type: "card",
      created_at: new Date().toISOString(),
    },
    "resolution=merge-duplicates",
  );

  console.log(`Payment failed for invoice ${invoice.id}`);
}

async function handleCheckoutSessionCompleted(session: Json) {
  const userId = metaString(session, "user_id");

  if (!userId) {
    console.error("No user_id in session metadata");
    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    console.log(`Checkout completed for subscription ${session.subscription}`);
    return;
  }

  if (session.mode === "payment") {
    console.log(
      `Checkout completed for one-time payment. Session: ${session.id}`,
    );
    return;
  }

  console.log(`Checkout session completed with mode: ${session.mode}`);
}

async function handlePaymentIntentSucceeded(paymentIntent: Json) {
  const flow = metaString(paymentIntent, "flow");
  if (flow !== ONE_TIME_PAYMENT_FLOW) {
    console.log(
      `Skipping payment_intent.succeeded for ${paymentIntent.id} (flow=${flow ?? "none"})`,
    );
    return;
  }

  const userId = metaString(paymentIntent, "user_id");
  const priceId = metaString(paymentIntent, "price_id") ?? null;

  if (!userId) {
    console.error("No user_id in payment intent metadata");
    return;
  }

  const amountReceived = num(paymentIntent, "amount_received");
  const amount = num(paymentIntent, "amount");
  const row = {
    user_id: userId,
    stripe_payment_intent_id: paymentIntent.id as string,
    stripe_invoice_id: null,
    amount: amountReceived ?? amount ?? 0,
    currency: paymentIntent.currency as string,
    status: "succeeded",
    payment_method_type: "card",
    created_at: new Date().toISOString(),
  };

  await restPost(
    "payment_history",
    "?on_conflict=stripe_payment_intent_id",
    row,
    "resolution=merge-duplicates",
  );

  console.log(
    `One-time payment recorded. payment_intent=${paymentIntent.id}, user_id=${userId}, price_id=${priceId}, flow=${ONE_TIME_PAYMENT_FLOW}`,
  );
}
