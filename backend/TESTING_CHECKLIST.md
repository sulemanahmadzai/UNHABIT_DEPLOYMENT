# Testing Checklist

## ✅ Pre-Testing Setup

### 1. Environment Variables
Check `.env` file has:
- [ ] `REDIS_ENABLED=true`
- [ ] `REDIS_URL=redis://localhost:6379`
- [ ] `STRIPE_SECRET_KEY=sk_test_...`
- [ ] `STRIPE_PUBLISHABLE_KEY=pk_test_...`
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...`
- [ ] `STRIPE_PRICE_ID=price_...`
- [ ] `TEST_AUTH_TOKEN=eyJ...`
- [ ] `DATABASE_URL` (Supabase connection)

### 2. Services Running
- [ ] Redis server running on port 6379
  ```cmd
  redis-server
  ```
- [ ] Backend server running on port 3000
  ```cmd
  npm run dev
  ```

### 3. Database
- [ ] Database migrated
  ```cmd
  npm run db:migrate
  ```
- [ ] Stripe tables exist (subscriptions, stripe_customers)

---

## 🧪 Performance Testing

### Test 1: Basic Performance
- [ ] Run: `npx tsx test-performance.ts`
- [ ] First completion: < 200ms ✅
- [ ] Second completion: < 100ms ✅
- [ ] Average of 5 completions: < 150ms ✅

### Test 2: Redis Cache Verification
- [ ] Open Redis CLI: `redis-cli`
- [ ] Check keys exist: `KEYS user:*:badge_stats`
- [ ] View cached data: `GET user:YOUR_USER_ID:badge_stats`
- [ ] Check TTL: `TTL user:YOUR_USER_ID:badge_stats` (should be ~300)

### Test 3: Cache Expiration
- [ ] Complete a task
- [ ] Wait 6 minutes
- [ ] Complete another task
- [ ] Verify cache was refreshed (check Redis)

### Test 4: Graceful Degradation
- [ ] Stop Redis server
- [ ] Complete a task (should still work, just slower)
- [ ] Check backend logs for Redis warnings
- [ ] Restart Redis
- [ ] Verify caching resumes

---

## 💳 Stripe Testing

### Test 1: Get Config (No Auth)
- [ ] Run: `curl http://localhost:3000/api/stripe/config`
- [ ] Response has `publishableKey` ✅
- [ ] Response has `success: true` ✅

### Test 2: Get Subscription (With Auth)
- [ ] Run: `curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/stripe/subscription`
- [ ] Response has `success: true` ✅
- [ ] Response has `subscription` field ✅
- [ ] Response has `hasActiveSubscription` field ✅

### Test 3: Create Checkout Session
- [ ] Run: `npx tsx test-stripe-integration.ts`
- [ ] Checkout session created ✅
- [ ] Session ID returned ✅
- [ ] Checkout URL returned ✅

### Test 4: Complete Checkout (Manual)
- [ ] Open checkout URL in browser
- [ ] Use test card: `4242 4242 4242 4242`
- [ ] Complete checkout
- [ ] Verify subscription created in database
- [ ] Check Stripe dashboard for subscription

### Test 5: Create Portal Session
- [ ] Ensure active subscription exists
- [ ] Run portal session test
- [ ] Portal URL returned ✅
- [ ] Open portal URL in browser
- [ ] Verify can manage subscription

### Test 6: Cancel Subscription
- [ ] Run cancel subscription test
- [ ] Subscription marked for cancellation ✅
- [ ] `cancel_at_period_end` set to true ✅
- [ ] Check Stripe dashboard

### Test 7: Reactivate Subscription
- [ ] Run reactivate subscription test
- [ ] Subscription reactivated ✅
- [ ] `cancel_at_period_end` set to false ✅
- [ ] Check Stripe dashboard

### Test 8: Automated Test Suite
- [ ] Run: `npx tsx test-stripe-integration.ts`
- [ ] All tests pass ✅
- [ ] No errors in console ✅

---

## 🔍 Integration Testing

### Test 1: Complete Task Flow
- [ ] Get today's tasks: `GET /api/progress/today`
- [ ] Complete a task: `POST /api/progress/tasks/:id/complete`
- [ ] Response time < 200ms ✅
- [ ] XP awarded ✅
- [ ] Streak updated ✅
- [ ] Badges checked ✅

### Test 2: Multiple Task Completions
- [ ] Complete 5 tasks in rapid succession
- [ ] All complete in < 200ms each ✅
- [ ] Cache is being used (check Redis) ✅
- [ ] No database errors ✅

### Test 3: Badge Awarding
- [ ] Complete enough tasks to earn a badge
- [ ] Badge awarded ✅
- [ ] Push notification sent (if configured) ✅
- [ ] Badge appears in user profile ✅

---

## 📊 Performance Benchmarks

### Expected Results

| Test | Target | Status |
|------|--------|--------|
| First task completion | < 200ms | [ ] |
| Cached task completion | < 100ms | [ ] |
| Average of 5 completions | < 150ms | [ ] |
| Stripe config endpoint | < 50ms | [ ] |
| Stripe subscription check | < 100ms | [ ] |
| Create checkout session | < 500ms | [ ] |

### Actual Results (Fill in after testing)

| Test | Result | Pass/Fail |
|------|--------|-----------|
| First task completion | ___ms | [ ] |
| Cached task completion | ___ms | [ ] |
| Average of 5 completions | ___ms | [ ] |
| Stripe config endpoint | ___ms | [ ] |
| Stripe subscription check | ___ms | [ ] |
| Create checkout session | ___ms | [ ] |

---

## 🐛 Troubleshooting

### Issue: Redis not connecting
**Symptoms**: `⚠️ Redis: REDIS_URL not configured`
**Fix**:
- [ ] Check Redis is running: `redis-cli ping`
- [ ] Check `.env` has `REDIS_URL`
- [ ] Restart backend

### Issue: Performance still slow
**Symptoms**: Task completion > 500ms
**Fix**:
- [ ] Verify Redis is connected (check backend logs)
- [ ] Check Redis cache: `redis-cli KEYS user:*`
- [ ] Clear cache and retry: `redis-cli FLUSHALL`
- [ ] Restart backend

### Issue: Stripe tests failing
**Symptoms**: `❌ TEST_AUTH_TOKEN not found`
**Fix**:
- [ ] Check all Stripe keys in `.env`
- [ ] Verify `TEST_AUTH_TOKEN` is valid
- [ ] Check backend is running
- [ ] Run database migrations

### Issue: Database errors
**Symptoms**: Prisma errors in console
**Fix**:
- [ ] Run migrations: `npm run db:migrate`
- [ ] Check database connection
- [ ] Verify Stripe tables exist

---

## ✅ Final Verification

### Code Quality
- [x] Code compiles without errors
- [x] No TypeScript errors
- [x] No linting errors
- [x] All imports resolved

### Documentation
- [x] Performance analysis documented
- [x] Testing guides created
- [x] Quick start guide provided
- [x] Project manager summary created

### Testing
- [ ] Performance tests pass
- [ ] Stripe tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

### Production Readiness
- [ ] Redis configured for production
- [ ] Environment variables documented
- [ ] Monitoring plan in place
- [ ] Rollback plan documented

---

## 📝 Sign-Off

### Tested By
- Name: _______________
- Date: _______________
- Environment: [ ] Local [ ] Staging [ ] Production

### Test Results
- Performance Tests: [ ] Pass [ ] Fail
- Stripe Tests: [ ] Pass [ ] Fail
- Integration Tests: [ ] Pass [ ] Fail

### Notes
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Approved for Production
- [ ] Yes, ready to deploy
- [ ] No, issues found (see notes)

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Redis available in production
- [ ] Environment variables set
- [ ] Database migrated
- [ ] Backup created

### Deployment
- [ ] Code deployed
- [ ] Services restarted
- [ ] Health check passed
- [ ] Redis connected
- [ ] Logs monitored

### Post-Deployment
- [ ] Performance verified
- [ ] Stripe endpoints tested
- [ ] User testing completed
- [ ] Monitoring alerts configured
- [ ] Team notified

---

## 📞 Support Contacts

### Technical Issues
- Backend Developer: _______________
- DevOps: _______________

### Business Issues
- Project Manager: _______________
- Product Owner: _______________

---

**Last Updated**: [Date]  
**Version**: 1.0  
**Status**: Ready for Testing
