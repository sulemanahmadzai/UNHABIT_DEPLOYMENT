# Stripe Integration - Setup Commands

## Complete Setup in Order

### 1. Install Dependencies
```bash
cd UnHabit/UNHABIT/backend
npm install stripe@latest
npm install --save-dev @types/stripe
```

### 2. Run Database Migration
```bash
# Option A: Using Supabase SQL Editor (Recommended)
# 1. Go to: https://supabase.com/dashboard/project/kgvrycgrzhfqhklvjxso/editor
# 2. Copy contents of: prisma/migrations/add_stripe_tables.sql
# 3. Paste and run in SQL Editor

# Option B: Using psql
psql "postgresql://postgres.kgvrycgrzhfqhklvjxso:Unhabit@100@aws-1-us-east-2.pooler.supabase.com:5432/postgres" < prisma/migrations/add_stripe_tables.sql
```

### 3. Update Prisma Schema and Regenerate
```bash
# The schema updates are needed - add the models from STRIPE_INTEGRATION_GUIDE.md
# Then regenerate:
npx prisma generate
```

### 4. Install Supabase CLI
```bash
npm install -g supabase
```

### 5. Link Supabase Project
```bash
supabase link --project-ref kgvrycgrzhfqhklvjxso
```

### 6. Deploy Edge Function
```bash
supabase functions deploy stripe-webhook
```

### 7. Set Edge Function Secrets 
```bash
```

### 8. Start Your Backend Server
```bash
npm run dev
```

### 9. Run Integration Tests
```bash
# In a new terminal
npm run test:stripe
```

---

## Verification Commands

### Check Database Tables
```bash
# Using Supabase SQL Editor
SELECT * FROM public.stripe_customers;
SELECT * FROM public.subscriptions;
SELECT * FROM public.payment_history;
```

### Check Edge Function Logs
```bash
supabase functions logs stripe-webhook
```

### Test API Endpoints
```bash
# Get config
curl http://localhost:3000/api/stripe/config

# Create checkout (replace YOUR_TOKEN)
curl -X POST http://localhost:3000/api/stripe/create-checkout-session \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_1TEa2lEoULduCiVK8c4Q8lFk",
    "successUrl": "http://localhost:3000/success",
    "cancelUrl": "http://localhost:3000/cancel"
  }'

# Create Payment Sheet session — one-time Price (React Native); replace YOUR_ONE_TIME_PRICE
curl -X POST http://localhost:3000/api/stripe/create-payment-sheet \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priceId": "YOUR_ONE_TIME_PRICE"}'

# Get subscription
curl http://localhost:3000/api/stripe/subscription \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Testing with Stripe CLI (Optional)

### Install Stripe CLI
```bash
# Windows (using Scoop)
scoop install stripe

# Or download from: https://stripe.com/docs/stripe-cli
```

### Forward Webhooks to Local
```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

### Trigger Test Events
```bash
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted
```

---

## Quick Test Flow

1. **Start server:** `npm run dev`
2. **Run tests:** `npm run test:stripe`
3. **Get checkout URL** from test output
4. **Complete checkout** with card `4242 4242 4242 4242`
5. **Run tests again** to verify subscription created
6. **Check Stripe Dashboard** for customer and subscription
7. **Check database** for records

---

## Environment Variables (Already Set ✅)

Your `.env` file already contains:
```
```

---

## Stripe Dashboard URLs

- **Dashboard:** https://dashboard.stripe.com/test/dashboard
- **Customers:** https://dashboard.stripe.com/test/customers
- **Subscriptions:** https://dashboard.stripe.com/test/subscriptions
- **Webhooks:** https://dashboard.stripe.com/test/webhooks
- **Logs:** https://dashboard.stripe.com/test/logs

---

## Supabase Dashboard URLs

- **Project:** https://supabase.com/dashboard/project/kgvrycgrzhfqhklvjxso
- **SQL Editor:** https://supabase.com/dashboard/project/kgvrycgrzhfqhklvjxso/editor
- **Edge Functions:** https://supabase.com/dashboard/project/kgvrycgrzhfqhklvjxso/functions
- **Database:** https://supabase.com/dashboard/project/kgvrycgrzhfqhklvjxso/database/tables

---

## Troubleshooting Commands

### Check if Stripe package is installed
```bash
npm list stripe
```

### Check if tables exist
```bash
# In Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('stripe_customers', 'subscriptions', 'payment_history');
```

### Check edge function status
```bash
supabase functions list
```

### View edge function logs
```bash
supabase functions logs stripe-webhook --tail
```

### Test webhook endpoint directly
```bash
curl https://kgvrycgrzhfqhklvjxso.supabase.co/functions/v1/stripe-webhook
```

---

## Success Indicators

✅ `npm run test:stripe` passes all tests
✅ Checkout URL is generated successfully
✅ Subscription appears in Stripe Dashboard after checkout
✅ Subscription appears in database after checkout
✅ Webhook events show in Stripe Dashboard logs
✅ Edge function logs show successful webhook processing

---

## Next Steps After Setup

1. Complete a test purchase
2. Test subscription cancellation
3. Test subscription reactivation
4. Test customer portal
5. Review webhook logs
6. Test payment failure scenarios
7. Prepare for production deployment

---

**All set!** Your Stripe integration is ready to test. Run `npm run test:stripe` to begin.
