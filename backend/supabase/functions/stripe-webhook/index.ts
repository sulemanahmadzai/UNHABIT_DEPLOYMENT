import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-12-18.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log(`Received event: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;

  if (!userId) {
    console.error('No user_id in subscription metadata');
    return;
  }

  const subscriptionData = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    status: subscription.status,
    price_id: subscription.items.data[0]?.price.id || '',
    quantity: subscription.items.data[0]?.quantity || 1,
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_start: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    ended_at: subscription.ended_at
      ? new Date(subscription.ended_at * 1000).toISOString()
      : null,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  // Upsert subscription
  const { error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id',
    });

  if (error) {
    console.error('Error upserting subscription:', error);
    throw error;
  }

  console.log(`Subscription ${subscription.id} updated for user ${userId}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error deleting subscription:', error);
    throw error;
  }

  console.log(`Subscription ${subscription.id} deleted`);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription || !invoice.payment_intent) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = subscription.metadata.user_id;

  if (!userId) {
    console.error('No user_id in subscription metadata');
    return;
  }

  // Record payment
  const { error } = await supabase.from('payment_history').insert({
    user_id: userId,
    stripe_payment_intent_id: invoice.payment_intent as string,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'succeeded',
    payment_method_type: 'card',
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error recording payment:', error);
  }

  console.log(`Payment succeeded for invoice ${invoice.id}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription || !invoice.payment_intent) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = subscription.metadata.user_id;

  if (!userId) {
    console.error('No user_id in subscription metadata');
    return;
  }

  // Record failed payment
  const { error } = await supabase.from('payment_history').insert({
    user_id: userId,
    stripe_payment_intent_id: invoice.payment_intent as string,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: 'failed',
    payment_method_type: 'card',
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error recording failed payment:', error);
  }

  console.log(`Payment failed for invoice ${invoice.id}`);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;

  if (!userId) {
    console.error('No user_id in session metadata');
    return;
  }

  // If this is a subscription checkout, the subscription webhook will handle it
  if (session.mode === 'subscription' && session.subscription) {
    console.log(`Checkout completed for subscription ${session.subscription}`);
  }
}
