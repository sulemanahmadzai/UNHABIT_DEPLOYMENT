# 💳 Stripe Payment Integration

Complete Stripe subscription payment integration for UnHabit.

## 🚀 Quick Start

```bash
# 1. Install Stripe
npm install stripe@latest

# 2. Run database migration (see STRIPE_SETUP_COMMANDS.md)

# 3. Deploy edge function
supabase functions deploy stripe-webhook

# 4. Test integration
npm run test:stripe
```

## 📁 Files Created

### Backend
- `src/services/stripe.service.ts` - Stripe service layer
- `src/routes/stripe.ts` - API routes
- `test-stripe-integration.ts` - Test suite

### Database
- `prisma/migrations/add_stripe_tables.sql` - Database schema

### Edge Function
- `supabase/functions/stripe-webhook/index.ts` - Webhook handler

### Documentation
- `STRIPE_QUICK_START.md` - 5-minute setup guide ⭐ **START HERE**
- `STRIPE_SETUP_COMMANDS.md` - All commands in order
- `STRIPE_INTEGRATION_GUIDE.md` - Complete documentation
- `STRIPE_IMPLEMENTATION_SUMMARY.md` - What was built

## 🔑 Environment Variables (Already Set ✅)

```

## 🧪 Testing

### Run Test Suite
```bash
npm run test:stripe
```

### Test Card
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any ZIP code
```

## 📡 API Endpoints

```
GET  /api/stripe/config                    - Get publishable key
POST /api/stripe/create-payment-sheet      - PaymentIntent + ephemeral key (one-time Price, React Native PaymentSheet)
POST /api/stripe/create-checkout-session   - Hosted Stripe Checkout URL (subscription; web redirect flow)
GET  /api/stripe/subscription              - Get subscription
POST /api/stripe/create-portal-session     - Customer portal
POST /api/stripe/cancel-subscription       - Cancel subscription
POST /api/stripe/reactivate-subscription   - Reactivate subscription
```

### React Native (one-time)

- Use **`POST /api/stripe/create-payment-sheet`** with body `{ "priceId": "<Stripe one_time Price id>" }` (authenticated).
- Amount and currency are taken from the Price in Stripe, not from the client.
- Optional env **`STRIPE_ALLOWED_ONE_TIME_PRICE_IDS`**: comma-separated Price IDs. If set, only those prices can be purchased.
- Response fields map to PaymentSheet: `paymentIntent` (client secret), `ephemeralKey`, `customer`, `publishableKey`.

## 🔒 Security Features

✅ Webhook signature verification
✅ Row Level Security (RLS)
✅ User authorization on all routes
✅ Environment variable protection
✅ Idempotent webhook handlers

## 📊 Database Tables

- `stripe_customers` - User to Stripe customer mapping
- `subscriptions` - Subscription data
- `payment_history` - Payment records

## 🎯 Webhook Events

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `checkout.session.completed`
- `payment_intent.succeeded` (one-time PaymentSheet flow; writes `payment_history` when `metadata.flow` is `one_time_payment_sheet`)
- `payment_intent.payment_failed` (same flow)

## 📚 Documentation

1. **Quick Start** → `STRIPE_QUICK_START.md` (5 min setup)
2. **Setup Commands** → `STRIPE_SETUP_COMMANDS.md` (step-by-step)
3. **Full Guide** → `STRIPE_INTEGRATION_GUIDE.md` (complete docs)
4. **Implementation** → `STRIPE_IMPLEMENTATION_SUMMARY.md` (what was built)

## ✅ Setup Checklist

- [ ] Install Stripe package
- [ ] Run database migration
- [ ] Deploy edge function
- [ ] Set edge function secrets
- [ ] Run test suite
- [ ] Complete test purchase
- [ ] Verify in Stripe Dashboard
- [ ] Verify in database

## 🆘 Troubleshooting

**Webhook not working?**
- Check webhook URL in Stripe Dashboard
- Verify webhook secret matches
- Check edge function logs: `supabase functions logs stripe-webhook`

**Subscription not in database?**
- Check webhook events in Stripe Dashboard
- Verify user_id in subscription metadata
- Check RLS policies

**Tests failing?**
- Ensure server is running: `npm run dev`
- Check AUTH_TOKEN in .env
- Verify Stripe keys are correct

## 🔗 Useful Links

- [Stripe Dashboard](https://dashboard.stripe.com/test/dashboard)
- [Supabase Dashboard](https://supabase.com/dashboard/project/kgvrycgrzhfqhklvjxso)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Webhook Events](https://stripe.com/docs/api/events/types)

## 🎉 Ready to Test!

Run the test suite to verify everything is working:

```bash
npm run test:stripe
```

Then complete a test purchase using the checkout URL provided in the test output.

---

**Need help?** Check `STRIPE_QUICK_START.md` for a 5-minute setup guide.
