# Stripe Integration Guide

## Overview
This guide covers the complete Stripe payment integration for UnHabit, including setup, testing, and security best practices.

## Table of Contents
1. [Installation](#installation)
2. [Database Setup](#database-setup)
3. [Environment Variables](#environment-variables)
4. [Supabase Edge Function Setup](#supabase-edge-function-setup)
5. [API Endpoints](#api-endpoints)
6. [Testing](#testing)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### 1. Install Stripe SDK
```bash
cd UnHabit/UNHABIT/backend
npm install stripe@latest
npm install --save-dev @types/stripe
```

### 2. Install Supabase CLI (for edge functions)
```bash
npm install -g supabase
```

---

## Database Setup

### 1. Run the Migration
Execute the SQL migration to create the necessary tables:

```bash
# Using Supabase SQL Editor
# Copy the contents of prisma/migrations/add_stripe_tables.sql
# and run it in your Supabase SQL Editor
```

Or use psql:
```bash
psql $DATABASE_URL < prisma/migrations/add_stripe_tables.sql
```

### 2. Update Prisma Schema
Add these models to your `prisma/schema.prisma`:

```prisma
model stripe_customers {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id              String   @unique @db.Uuid
  stripe_customer_id   String   @unique
  email                String?
  created_at           DateTime @default(now()) @db.Timestamptz(6)
  updated_at           DateTime @default(now()) @db.Timestamptz(6)
  users                users    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@schema("public")
}

model subscriptions {
  id                      String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id                 String    @db.Uuid
  stripe_subscription_id  String    @unique
  stripe_customer_id      String
  status                  String
  price_id                String
  quantity                Int       @default(1)
  cancel_at_period_end    Boolean   @default(false)
  current_period_start    DateTime? @db.Timestamptz(6)
  current_period_end      DateTime? @db.Timestamptz(6)
  ended_at                DateTime? @db.Timestamptz(6)
  canceled_at             DateTime? @db.Timestamptz(6)
  trial_start             DateTime? @db.Timestamptz(6)
  trial_end               DateTime? @db.Timestamptz(6)
  created_at              DateTime  @default(now()) @db.Timestamptz(6)
  updated_at              DateTime  @default(now()) @db.Timestamptz(6)
  users                   users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([status])
  @@index([stripe_subscription_id])
  @@schema("public")
}

model payment_history {
  id                        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id                   String   @db.Uuid
  stripe_payment_intent_id  String   @unique
  stripe_invoice_id         String?
  amount                    Int
  currency                  String   @default("usd")
  status                    String
  payment_method_type       String?
  created_at                DateTime @default(now()) @db.Timestamptz(6)
  users                     users    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([created_at(sort: Desc)])
  @@schema("public")
}
```

Then regenerate Prisma client:
```bash
npx prisma generate
```

---

## Environment Variables

Add these to your `.env` file:


```

---

## Supabase Edge Function Setup

### 1. Initialize Supabase Project (if not already done)
```bash
supabase init
```

### 2. Link to Your Supabase Project
```bash
supabase link --project-ref kgvrycgrzhfqhklvjxso
```

### 3. Deploy the Webhook Function
```bash
supabase functions deploy stripe-webhook
```

### 4. Set Environment Variables for Edge Function
```bash

```

### 5. Configure Stripe Webhook
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://kgvrycgrzhfqhklvjxso.supabase.co/functions/v1/stripe-webhook`
3. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
4. Copy the webhook signing secret and update 



---

## API Endpoints

### 1. Get Stripe Config
```http
GET /api/stripe/config
```
Returns the publishable key for client-side Stripe initialization.

### 2. Create Checkout Session
```http
POST /api/stripe/create-checkout-session
Authorization: Bearer <token>
Content-Type: application/json

{
  "priceId": "price_1TEa2lEoULduCiVK8c4Q8lFk",
  "successUrl": "https://yourapp.com/success",
  "cancelUrl": "https://yourapp.com/cancel"
}
```

### 3. Get Subscription Status
```http
GET /api/stripe/subscription
Authorization: Bearer <token>
```

### 4. Create Portal Session
```http
POST /api/stripe/create-portal-session
Authorization: Bearer <token>
Content-Type: application/json

{
  "returnUrl": "https://yourapp.com/settings"
}
```

### 5. Cancel Subscription
```http
POST /api/stripe/cancel-subscription
Authorization: Bearer <token>
```

### 6. Reactivate Subscription
```http
POST /api/stripe/reactivate-subscription
Authorization: Bearer <token>
```

---

## Testing

### 1. Test with Stripe CLI
Install Stripe CLI:
```bash
# Windows (using Scoop)
scoop install stripe

# Or download from https://stripe.com/docs/stripe-cli
```

Forward webhooks to local development:
```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

### 2. Test Card Numbers
Use these test cards in Stripe Checkout:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

Use any future expiry date, any 3-digit CVC, and any ZIP code.

### 3. Test Subscription Flow

#### Step 1: Get Config
```bash
curl http://localhost:3000/api/stripe/config
```

#### Step 2: Create Checkout Session
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

#### Step 3: Complete Checkout
Visit the returned `url` and complete the checkout with test card `4242 4242 4242 4242`.

#### Step 4: Verify Subscription
```bash
curl http://localhost:3000/api/stripe/subscription \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Step 5: Test Customer Portal
```bash
curl -X POST http://localhost:3000/api/stripe/create-portal-session \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "returnUrl": "http://localhost:3000/settings"
  }'
```

### 4. Test Webhooks

Trigger test webhooks from Stripe Dashboard:
1. Go to Developers → Webhooks
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select event type and send

Or use Stripe CLI:
```bash
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted
```

---

## Security Considerations

### 1. API Key Security
- ✅ Never commit API keys to version control
- ✅ Use environment variables for all keys
- ✅ Rotate keys regularly
- ✅ Use test keys in development, live keys only in production

### 2. Webhook Security
- ✅ Always verify webhook signatures using `stripe.webhooks.constructEvent()`
- ✅ Use HTTPS for webhook endpoints
- ✅ Keep webhook secret secure
- ✅ Implement idempotency for webhook handlers

### 3. User Authorization
- ✅ Always verify user owns the subscription before operations
- ✅ Use `requireAuth` middleware on all protected routes
- ✅ Validate user_id matches authenticated user

### 4. Database Security
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Users can only access their own data
- ✅ Service role used only for webhook operations

### 5. Error Handling
- ✅ Never expose Stripe errors directly to clients
- ✅ Log errors securely for debugging
- ✅ Return generic error messages to users

---

## Troubleshooting

### Issue: Webhook not receiving events
**Solution:**
1. Check webhook URL is correct in Stripe Dashboard
2. Verify webhook secret matches in environment variables
3. Check Supabase edge function logs: `supabase functions logs stripe-webhook`
4. Test with Stripe CLI: `stripe listen --forward-to YOUR_URL`

### Issue: "No signature" error
**Solution:**
- Ensure `stripe-signature` header is being passed
- Verify webhook secret is correct
- Check request body is raw (not parsed JSON)

### Issue: Subscription not created in database
**Solution:**
1. Check webhook is receiving events
2. Verify `user_id` is in subscription metadata
3. Check database permissions for service role
4. Review edge function logs for errors

### Issue: Customer already has subscription
**Solution:**
- Check for existing active subscriptions before creating new checkout session
- Use customer portal for subscription management instead

### Issue: Payment fails
**Solution:**
1. Check Stripe Dashboard for payment details
2. Verify card details are correct
3. Check for 3D Secure requirements
4. Review payment_history table for failed attempts

---

## Production Checklist

Before going live:

- [ ] Replace all test API keys with live keys
- [ ] Update webhook endpoint to production URL
- [ ] Test complete subscription flow in production
- [ ] Set up monitoring and alerts for failed payments
- [ ] Configure email notifications for subscription events
- [ ] Review and test all error scenarios
- [ ] Implement proper logging and monitoring
- [ ] Set up backup webhook endpoint
- [ ] Document subscription cancellation policy
- [ ] Test refund process

---

## Support

For issues or questions:
- Stripe Documentation: https://stripe.com/docs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- UnHabit Support: [Your support channel]
