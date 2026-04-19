import Stripe from 'stripe';
import { prisma } from '../db/prisma.js';

/** Keep in sync with ephemeral key creation and Supabase stripe-webhook Stripe client. */
export const STRIPE_API_VERSION = '2026-02-25.clover' as const;

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY is not set. Stripe features will be disabled.');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
}) : null;

export const ONE_TIME_PAYMENT_FLOW = 'one_time_payment_sheet';

function parseOneTimePriceAllowlist(): Set<string> | null {
  const raw = process.env.STRIPE_ALLOWED_ONE_TIME_PRICE_IDS?.trim();
  if (!raw) {
    return null;
  }
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return new Set(ids);
}

function throwBadRequest(message: string): never {
  const err = new Error(message);
  (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 400;
  throw err;
}

/**
 * Resolve or create Stripe Customer + DB row for app user.
 */
export async function ensureStripeCustomer(
  userId: string,
  customerEmail?: string | undefined,
): Promise<string> {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');

  const existing = await prisma.stripe_customers.findUnique({
    where: { user_id: userId },
  });
  if (existing) {
    return existing.stripe_customer_id;
  }

  const customerData: Stripe.CustomerCreateParams = {
    metadata: { user_id: userId },
  };
  if (customerEmail) {
    customerData.email = customerEmail;
  }

  const stripeCustomer = await stripe.customers.create(customerData);

  await prisma.stripe_customers.create({
    data: {
      user_id: userId,
      stripe_customer_id: stripeCustomer.id,
      email: customerEmail ?? null,
    },
  });

  return stripeCustomer.id;
}

export interface CreatePaymentSheetOneTimeParams {
  userId: string;
  priceId: string;
  customerEmail?: string | undefined;
}

export interface PaymentSheetOneTimeResult {
  paymentIntentClientSecret: string;
  ephemeralKeySecret: string;
  customerId: string;
}
export interface ConfirmOneTimePaymentIntentParams {
  userId: string;
  paymentIntentId: string;
}

export interface CreateCheckoutSessionParams {
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | undefined;
}

export interface CreatePortalSessionParams {
  customerId: string;
  returnUrl: string;
}

/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(params: CreateCheckoutSessionParams) {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  const { userId, priceId, successUrl, cancelUrl, customerEmail } = params;

  // Check if user already has an active subscription
  const existingSubscription = await prisma.subscriptions.findFirst({
    where: {
      user_id: userId,
      status: { in: ['active', 'trialing'] },
    },
  });

  if (existingSubscription) {
    throw new Error('User already has an active subscription');
  }

  const customerId = await ensureStripeCustomer(userId, customerEmail);

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
    },
    subscription_data: {
      metadata: {
        user_id: userId,
      },
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * PaymentIntent + ephemeral key for @stripe/stripe-react-native PaymentSheet (one-time Price only).
 * Amount/currency come from Stripe Price — never from the client.
 */
export async function createPaymentSheetParamsForOneTimePrice(
  params: CreatePaymentSheetOneTimeParams,
): Promise<PaymentSheetOneTimeResult> {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  const { userId, priceId, customerEmail } = params;

  const allowlist = parseOneTimePriceAllowlist();
  if (allowlist && !allowlist.has(priceId)) {
    throwBadRequest('This price is not available for purchase');
  }

  const price = await stripe.prices.retrieve(priceId);
  if (!price.active) {
    throwBadRequest('Price is not active');
  }
  if (price.type !== 'one_time') {
    throwBadRequest('Only one-time prices are supported for PaymentSheet checkout');
  }
  if (price.unit_amount == null) {
    throwBadRequest('Price has no fixed unit amount');
  }

  const customerId = await ensureStripeCustomer(userId, customerEmail);

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: STRIPE_API_VERSION },
  );

  if (!ephemeralKey.secret) {
    throw new Error('Stripe did not return an ephemeral key secret');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: price.unit_amount,
    currency: price.currency,
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      user_id: userId,
      price_id: priceId,
      flow: ONE_TIME_PAYMENT_FLOW,
    },
  });

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a PaymentIntent client secret');
  }

  return {
    paymentIntentClientSecret: paymentIntent.client_secret,
    ephemeralKeySecret: ephemeralKey.secret,
    customerId,
  };
}

/**
 * Fallback for delayed/missed webhook delivery:
 * verify PaymentIntent ownership/status and upsert payment_history.
 */
export async function confirmOneTimePaymentIntentForUser(
  params: ConfirmOneTimePaymentIntentParams,
): Promise<{ confirmed: boolean; status: string }> {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  const { userId, paymentIntentId } = params;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const metadataUserId = paymentIntent.metadata?.user_id;
  const flow = paymentIntent.metadata?.flow;

  if (!metadataUserId || metadataUserId !== userId) {
    throwBadRequest('Payment intent does not belong to this user');
  }
  if (flow !== ONE_TIME_PAYMENT_FLOW) {
    throwBadRequest('Payment intent is not from the one-time payment flow');
  }

  if (paymentIntent.status !== 'succeeded') {
    return { confirmed: false, status: paymentIntent.status };
  }

  await prisma.payment_history.upsert({
    where: { stripe_payment_intent_id: paymentIntent.id },
    create: {
      user_id: userId,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_invoice_id: null,
      amount: paymentIntent.amount_received || paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'succeeded',
      payment_method_type: 'card',
      created_at: new Date(),
    },
    update: {
      status: 'succeeded',
      amount: paymentIntent.amount_received || paymentIntent.amount,
      currency: paymentIntent.currency,
    },
  });

  return { confirmed: true, status: paymentIntent.status };
}

/**
 * Create a Stripe Customer Portal Session
 */
export async function createPortalSession(params: CreatePortalSessionParams) {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  const { customerId, returnUrl } = params;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return {
    url: session.url,
  };
}

/**
 * Get subscription status for a user
 */
export async function getUserSubscription(userId: string) {
  const subscription = await prisma.subscriptions.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });

  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at,
  };
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(userId: string) {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  const subscription = await prisma.subscriptions.findFirst({
    where: {
      user_id: userId,
      status: { in: ['active', 'trialing'] },
    },
  });

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  // Cancel at period end in Stripe
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // Update in database
  await prisma.subscriptions.update({
    where: { id: subscription.id },
    data: {
      cancel_at_period_end: true,
      updated_at: new Date(),
    },
  });

  return {
    success: true,
    message: 'Subscription will be canceled at the end of the billing period',
  };
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(userId: string) {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  const subscription = await prisma.subscriptions.findFirst({
    where: {
      user_id: userId,
      status: { in: ['active', 'trialing'] },
      cancel_at_period_end: true,
    },
  });

  if (!subscription) {
    throw new Error('No subscription found to reactivate');
  }

  // Reactivate in Stripe
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  // Update in database
  await prisma.subscriptions.update({
    where: { id: subscription.id },
    data: {
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date(),
    },
  });

  return {
    success: true,
    message: 'Subscription reactivated successfully',
  };
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await prisma.subscriptions.findFirst({
    where: {
      user_id: userId,
      status: { in: ['active', 'trialing'] },
    },
  });

  return !!subscription;
}

/**
 * Get Stripe customer for user
 */
export async function getStripeCustomer(userId: string) {
  return await prisma.stripe_customers.findUnique({
    where: { user_id: userId },
  });
}

export { stripe };
