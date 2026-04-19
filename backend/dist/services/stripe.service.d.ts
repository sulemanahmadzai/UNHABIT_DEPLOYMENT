import Stripe from 'stripe';
/** Keep in sync with ephemeral key creation and Supabase stripe-webhook Stripe client. */
export declare const STRIPE_API_VERSION: "2026-02-25.clover";
declare const stripe: Stripe | null;
export declare const ONE_TIME_PAYMENT_FLOW = "one_time_payment_sheet";
/**
 * Resolve or create Stripe Customer + DB row for app user.
 */
export declare function ensureStripeCustomer(userId: string, customerEmail?: string | undefined): Promise<string>;
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
export declare function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{
    sessionId: string;
    url: string | null;
}>;
/**
 * PaymentIntent + ephemeral key for @stripe/stripe-react-native PaymentSheet (one-time Price only).
 * Amount/currency come from Stripe Price — never from the client.
 */
export declare function createPaymentSheetParamsForOneTimePrice(params: CreatePaymentSheetOneTimeParams): Promise<PaymentSheetOneTimeResult>;
/**
 * Fallback for delayed/missed webhook delivery:
 * verify PaymentIntent ownership/status and upsert payment_history.
 */
export declare function confirmOneTimePaymentIntentForUser(params: ConfirmOneTimePaymentIntentParams): Promise<{
    confirmed: boolean;
    status: string;
}>;
/**
 * Create a Stripe Customer Portal Session
 */
export declare function createPortalSession(params: CreatePortalSessionParams): Promise<{
    url: string;
}>;
/**
 * Get subscription status for a user
 */
export declare function getUserSubscription(userId: string): Promise<{
    id: string;
    status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
} | null>;
/**
 * Cancel a subscription at period end
 */
export declare function cancelSubscription(userId: string): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Reactivate a canceled subscription
 */
export declare function reactivateSubscription(userId: string): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Check if user has active subscription
 */
export declare function hasActiveSubscription(userId: string): Promise<boolean>;
/**
 * Get Stripe customer for user
 */
export declare function getStripeCustomer(userId: string): Promise<{
    email: string | null;
    user_id: string;
    created_at: Date;
    updated_at: Date;
    id: string;
    stripe_customer_id: string;
} | null>;
export { stripe };
//# sourceMappingURL=stripe.service.d.ts.map