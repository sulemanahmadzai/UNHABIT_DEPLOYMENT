import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import * as StripeService from '../services/stripe.service.js';
import { prisma } from '../db/prisma.js';
const r = Router();
/**
 * POST /api/stripe/create-checkout-session
 * Create a Stripe Checkout Session for subscription
 */
/**
 * POST /api/stripe/create-payment-sheet
 * One-time PaymentIntent + ephemeral key for React Native PaymentSheet (amount from Stripe Price).
 */
r.post('/create-payment-sheet', requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            priceId: z.string().min(1),
        });
        const data = schema.parse(req.body);
        const userId = req.user.id;
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        const sheet = await StripeService.createPaymentSheetParamsForOneTimePrice({
            userId,
            priceId: data.priceId,
            customerEmail: user?.email ?? undefined,
        });
        res.json({
            success: true,
            paymentIntent: sheet.paymentIntentClientSecret,
            ephemeralKey: sheet.ephemeralKeySecret,
            customer: sheet.customerId,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
        });
    }
    catch (error) {
        next(error);
    }
});
r.post('/create-checkout-session', requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            priceId: z.string().min(1),
            successUrl: z.string().url(),
            cancelUrl: z.string().url(),
        });
        const data = schema.parse(req.body);
        const userId = req.user.id;
        // Get user email from database
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        const session = await StripeService.createCheckoutSession({
            userId,
            priceId: data.priceId,
            successUrl: data.successUrl,
            cancelUrl: data.cancelUrl,
            customerEmail: user?.email ?? undefined,
        });
        res.json({
            success: true,
            sessionId: session.sessionId,
            url: session.url,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stripe/create-portal-session
 * Create a Stripe Customer Portal Session
 */
r.post('/create-portal-session', requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            returnUrl: z.string().url(),
        });
        const data = schema.parse(req.body);
        const userId = req.user.id;
        // Get Stripe customer
        const customer = await StripeService.getStripeCustomer(userId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'No Stripe customer found',
            });
        }
        const session = await StripeService.createPortalSession({
            customerId: customer.stripe_customer_id,
            returnUrl: data.returnUrl,
        });
        res.json({
            success: true,
            url: session.url,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/stripe/subscription
 * Get current user's subscription status
 */
r.get('/subscription', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const subscription = await StripeService.getUserSubscription(userId);
        if (!subscription) {
            return res.json({
                success: true,
                subscription: null,
                hasActiveSubscription: false,
            });
        }
        res.json({
            success: true,
            subscription,
            hasActiveSubscription: ['active', 'trialing'].includes(subscription.status),
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stripe/cancel-subscription
 * Cancel subscription at period end
 */
r.post('/cancel-subscription', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await StripeService.cancelSubscription(userId);
        res.json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stripe/reactivate-subscription
 * Reactivate a canceled subscription
 */
r.post('/reactivate-subscription', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await StripeService.reactivateSubscription(userId);
        res.json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/stripe/config
 * Get Stripe publishable key
 */
r.get('/config', (_req, res) => {
    res.json({
        success: true,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
});
export default r;
//# sourceMappingURL=stripe.js.map