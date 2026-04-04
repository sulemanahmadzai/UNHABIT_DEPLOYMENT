# Stripe Integration - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Stripe Package
```bash
npm install stripe@latest
```

### Step 2: Run Database Migration
```bash
# Copy and run the SQL in Supabase SQL Editor
# File: prisma/migrations/add_stripe_tables.sql
```

Or use psql:
```bash
psql $DIRECT_URL < prisma/migrations/add_stripe_tables.sql
```

### Step 3: Environment Variables Already Set ✅
Your `.env` file already has:

```

### Step 4: Deploy Supabase Edge Function
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link to your project
supabase link --project-ref kgvrycgrzhfqhklvjxso

# Deploy the webhook function
supabase functions deploy stripe-webhook


```

### Step 5: Verify Webhook in Stripe Dashboard ✅
Your webhook is already configured at:
```
https://supabase.com/dashboard/project/kgvrycgrzhfqhklvjxso/functions/stripe-webhook
```

Events to listen for:
- ✅ customer.subscription.created
- ✅ customer.subscription.updated
- ✅ customer.subscription.deleted
- ✅ invoice.payment_succeeded
- ✅ invoice.payment_failed
- ✅ checkout.session.completed
- ✅ payment_intent.succeeded (one-time PaymentSheet)
- ✅ payment_intent.payment_failed (one-time PaymentSheet)

---

## 🧪 Testing

### Run Automated Tests
```bash
npm run test:stripe
```

### Manual Testing

#### 1. Get Stripe Config
```bash
curl http://localhost:3000/api/stripe/config
```

#### 2. Create Checkout Session (web subscription — redirects to Stripe-hosted page)
```bash
curl -X POST http://localhost:3000/api/stripe/create-checkout-session \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_1TEa2lEoULduCiVK8c4Q8lFk",
    "successUrl": "http://localhost:3000/success",
    "cancelUrl": "http://localhost:3000/cancel"
  }'
```

#### 2b. Create Payment Sheet session (React Native — one-time Stripe Price)
Use a Price whose **type** is **one-time** in the Stripe Dashboard.

```bash
curl -X POST http://localhost:3000/api/stripe/create-payment-sheet \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priceId": "price_YOUR_ONE_TIME_PRICE_ID"}'
```

Response includes `paymentIntent`, `ephemeralKey`, `customer`, `publishableKey` for `@stripe/stripe-react-native` (`initPaymentSheet` / `presentPaymentSheet`). Treat payment as confirmed only after your backend reflects webhook results (e.g. `payment_history`), not only client success.

Optional: set **`STRIPE_ALLOWED_ONE_TIME_PRICE_IDS`** (comma-separated) so only approved Price IDs are accepted.

Automated test: set **`STRIPE_ONE_TIME_PRICE_ID`** in `.env` and run `npm run test:stripe`.

#### 3. Complete Checkout
- Visit the returned URL
- Use test card: `4242 4242 4242 4242`
- Any future expiry, any CVC, any ZIP

#### 4. Check Subscription
```bash
curl http://localhost:3000/api/stripe/subscription \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📋 API Endpoints

All endpoints are prefixed with `/api/stripe`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/config` | Get publishable key | No |
| POST | `/create-payment-sheet` | One-time PaymentIntent + ephemeral key (mobile PaymentSheet) | Yes |
| POST | `/create-checkout-session` | Hosted Checkout URL (subscription) | Yes |
| GET | `/subscription` | Get subscription status | Yes |
| POST | `/create-portal-session` | Create customer portal | Yes |
| POST | `/cancel-subscription` | Cancel subscription | Yes |
| POST | `/reactivate-subscription` | Reactivate subscription | Yes |

---

## 🔒 Security Features

✅ **Webhook Signature Verification** - All webhooks are verified using Stripe signatures

✅ **Row Level Security (RLS)** - Users can only access their own subscription data

✅ **Environment Variables** - All sensitive keys stored in environment variables

✅ **User Authorization** - All endpoints require authentication

✅ **Idempotency** - Webhook handlers are idempotent to prevent duplicate processing

---

## 🐛 Troubleshooting

### Issue: "stripe is not defined"
**Solution:** Run `npm install stripe@latest`

### Issue: Database tables don't exist
**Solution:** Run the migration SQL in Supabase SQL Editor

### Issue: Webhook not receiving events
**Solution:** 
1. Check webhook URL in Stripe Dashboard
2. Verify webhook secret matches
3. Check Supabase function logs: `supabase functions logs stripe-webhook`

### Issue: "No Stripe customer found"
**Solution:** User needs to complete checkout first to create a customer

---

## 📚 Full Documentation

For complete documentation, see: `STRIPE_INTEGRATION_GUIDE.md`

---

## ✅ Integration Checklist

- [x] Stripe package installed
- [x] Database tables created
- [x] Environment variables configured
- [x] Supabase edge function deployed
- [x] Webhook configured in Stripe
- [x] API routes registered
- [ ] Run test suite: `npm run test:stripe`
- [ ] Complete test checkout
- [ ] Verify subscription in database

---

## 🎯 Next Steps

1. **Run the test suite:**
   ```bash
   npm run test:stripe
   ```

2. **Complete a test checkout** using the URL from the test output

3. **Verify in Stripe Dashboard:**
   - Check Customers section
   - Check Subscriptions section
   - Check Webhooks logs

4. **Verify in Database:**
   ```sql
   SELECT * FROM public.stripe_customers;
   SELECT * FROM public.subscriptions;
   SELECT * FROM public.payment_history;
   ```

5. **Test Customer Portal:**
   - Create portal session
   - Update payment method
   - Cancel subscription
   - Reactivate subscription

---

## 🆘 Need Help?

- Stripe Docs: https://stripe.com/docs
- Supabase Docs: https://supabase.com/docs
- Test Cards: https://stripe.com/docs/testing

---

**Ready to go live?** See the Production Checklist in `STRIPE_INTEGRATION_GUIDE.md`
