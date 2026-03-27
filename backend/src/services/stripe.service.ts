import Stripe from 'stripe';
import { prisma } from '../db/prisma.js';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY is not set. Stripe features will be disabled.');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
}) : null;

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

  // Get or create Stripe customer
  let customer = await prisma.stripe_customers.findUnique({
    where: { user_id: userId },
  });

  let customerId: string;

  if (customer) {
    customerId = customer.stripe_customer_id;
  } else {
    // Create new Stripe customer
    const customerData: any = {
      metadata: {
        user_id: userId,
      },
    };
    
    if (customerEmail) {
      customerData.email = customerEmail;
    }
    
    const stripeCustomer = await stripe.customers.create(customerData);

    // Save to database
    customer = await prisma.stripe_customers.create({
      data: {
        user_id: userId,
        stripe_customer_id: stripeCustomer.id,
        email: customerEmail || null,
      },
    });

    customerId = stripeCustomer.id;
  }

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
