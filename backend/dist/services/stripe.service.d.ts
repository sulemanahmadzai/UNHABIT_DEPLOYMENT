import Stripe from 'stripe';
declare const stripe: Stripe;
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