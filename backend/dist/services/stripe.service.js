import Stripe from 'stripe';
import { prisma } from '../db/prisma.js';
/** Keep in sync with ephemeral key creation and Supabase stripe-webhook Stripe client. */
export const STRIPE_API_VERSION = '2026-02-25.clover';
if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  STRIPE_SECRET_KEY is not set. Stripe features will be disabled.');
}
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
}) : null;
export const ONE_TIME_PAYMENT_FLOW = 'one_time_payment_sheet';
function parseOneTimePriceAllowlist() {
    const raw = process.env.STRIPE_ALLOWED_ONE_TIME_PRICE_IDS?.trim();
    if (!raw) {
        return null;
    }
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return new Set(ids);
}
function toIsoFromUnix(ts) {
    if (!ts)
        return null;
    return new Date(ts * 1000).toISOString();
}
function getUnixField(source, key) {
    const value = source[key];
    return typeof value === 'number' ? value : null;
}
function throwBadRequest(message) {
    const err = new Error(message);
    err.statusCode = 400;
    throw err;
}
/**
 * Resolve or create Stripe Customer + DB row for app user.
 */
export async function ensureStripeCustomer(userId, customerEmail) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    const existing = await prisma.stripe_customers.findUnique({
        where: { user_id: userId },
    });
    if (existing) {
        return existing.stripe_customer_id;
    }
    const customerData = {
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
function extractSubscriptionItem(subscription) {
    const firstItem = subscription.items.data[0];
    return {
        priceId: firstItem?.price?.id ?? '',
        quantity: firstItem?.quantity ?? 1,
    };
}
async function upsertSubscriptionRecord(userId, subscription) {
    const item = extractSubscriptionItem(subscription);
    const subscriptionObj = subscription;
    const currentPeriodStart = toIsoFromUnix(getUnixField(subscriptionObj, 'current_period_start'));
    const currentPeriodEnd = toIsoFromUnix(getUnixField(subscriptionObj, 'current_period_end'));
    const endedAt = toIsoFromUnix(subscription.ended_at);
    const canceledAt = toIsoFromUnix(subscription.canceled_at);
    const trialStart = toIsoFromUnix(subscription.trial_start);
    const trialEnd = toIsoFromUnix(subscription.trial_end);
    await prisma.subscriptions.upsert({
        where: { stripe_subscription_id: subscription.id },
        create: {
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: String(subscription.customer),
            status: subscription.status,
            price_id: item.priceId,
            quantity: item.quantity,
            cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            ended_at: endedAt,
            canceled_at: canceledAt,
            trial_start: trialStart,
            trial_end: trialEnd,
            updated_at: new Date(),
        },
        update: {
            status: subscription.status,
            price_id: item.priceId,
            quantity: item.quantity,
            cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            ended_at: endedAt,
            canceled_at: canceledAt,
            trial_start: trialStart,
            trial_end: trialEnd,
            updated_at: new Date(),
        },
    });
}
/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(params) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
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
export async function createPaymentSheetParamsForOneTimePrice(params) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
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
    const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: STRIPE_API_VERSION });
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
 * Create Subscription + pending SetupIntent for React Native PaymentSheet trial flow.
 * No immediate charge during trial; first charge happens after trial ends.
 */
export async function createSubscriptionSheetParams(params) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    const { userId, priceId, customerEmail } = params;
    const trialDays = Math.max(1, Math.min(30, Math.floor(params.trialDays || 3)));
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
        throwBadRequest('Price is not active');
    }
    if (price.type !== 'recurring') {
        throwBadRequest('Only recurring prices are supported for subscription trial checkout');
    }
    const existingSubscription = await prisma.subscriptions.findFirst({
        where: {
            user_id: userId,
            status: { in: ['active', 'trialing'] },
        },
        orderBy: { created_at: 'desc' },
    });
    if (existingSubscription) {
        throwBadRequest('User already has an active subscription');
    }
    const customerId = await ensureStripeCustomer(userId, customerEmail);
    const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: STRIPE_API_VERSION });
    if (!ephemeralKey.secret) {
        throw new Error('Stripe did not return an ephemeral key secret');
    }
    const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId, quantity: 1 }],
        trial_period_days: trialDays,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: {
            user_id: userId,
            trial_days: String(trialDays),
        },
        expand: ['pending_setup_intent'],
    });
    let pendingSetupIntent = null;
    if (typeof subscription.pending_setup_intent === 'string') {
        pendingSetupIntent = await stripe.setupIntents.retrieve(subscription.pending_setup_intent);
    }
    else if (subscription.pending_setup_intent) {
        pendingSetupIntent = subscription.pending_setup_intent;
    }
    const setupIntentClientSecret = pendingSetupIntent?.client_secret;
    if (!setupIntentClientSecret) {
        throw new Error('Stripe did not return a SetupIntent client secret for trial setup');
    }
    await upsertSubscriptionRecord(userId, subscription);
    return {
        setupIntentClientSecret,
        ephemeralKeySecret: ephemeralKey.secret,
        customerId,
        subscriptionId: subscription.id,
    };
}
/**
 * Fallback for delayed/missed webhook delivery:
 * verify PaymentIntent ownership/status and upsert payment_history.
 */
export async function confirmOneTimePaymentIntentForUser(params) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
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
 * Fallback for delayed/missed webhook delivery:
 * verify subscription ownership/status and upsert subscriptions row.
 */
export async function confirmSubscriptionForUser(params) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    const { userId, subscriptionId } = params;
    const localSub = await prisma.subscriptions.findUnique({
        where: { stripe_subscription_id: subscriptionId },
    });
    if (localSub && localSub.user_id !== userId) {
        throwBadRequest('Subscription does not belong to this user');
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['pending_setup_intent'],
    });
    const metadataUserId = subscription.metadata?.user_id;
    if (!localSub && metadataUserId && metadataUserId !== userId) {
        throwBadRequest('Subscription does not belong to this user');
    }
    await upsertSubscriptionRecord(userId, subscription);
    const confirmed = ['trialing', 'active'].includes(subscription.status);
    return { confirmed, status: subscription.status };
}
/**
 * Create a Stripe Customer Portal Session
 */
export async function createPortalSession(params) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
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
export async function getUserSubscription(userId) {
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
export async function cancelSubscription(userId) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
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
export async function reactivateSubscription(userId) {
    if (!stripe)
        throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
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
export async function hasActiveSubscription(userId) {
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
export async function getStripeCustomer(userId) {
    return await prisma.stripe_customers.findUnique({
        where: { user_id: userId },
    });
}
export { stripe };
//# sourceMappingURL=stripe.service.js.map