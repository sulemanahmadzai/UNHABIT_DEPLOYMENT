# Testing AI Caching - Quick Guide

This guide shows you how to test that Redis is actually caching your expensive AI API calls.

## Prerequisites

1. ✅ Redis is running: `docker ps | findstr redis`
2. ✅ Backend is running: `npm run dev`
3. ✅ You have a valid auth token

## Option 1: Automated Test (Easiest)

### Step 1: Get an Auth Token

You need a valid JWT token to make authenticated requests. You can get one by:

**Method A: From your app**
1. Login to your app
2. Open browser DevTools (F12)
3. Go to Application/Storage → Local Storage or Cookies
4. Find the JWT token (usually stored as `token` or `access_token`)
5. Copy the token value

**Method B: Create a test user and login via API**
```bash
# If you have a login endpoint, use it to get a token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

### Step 2: Add Token to .env

Add this line to your `.env` file:
```bash
TEST_AUTH_TOKEN="your-jwt-token-here"
```

### Step 3: Run the Test

```bash
npm run test:ai-cache
```

### What to Expect

The test will:
1. Make requests to the 4 most expensive AI endpoints
2. Make the same request twice to each endpoint
3. Measure the time difference
4. Show you the performance improvement

**Expected Output:**
```
🧪 AI CACHING TEST SUITE - MOST EXPENSIVE ENDPOINTS
====================================================================

TEST: Quiz Form Generation
====================================================================
📤 Making first request (cache miss expected)...
✅ First request completed in 8234ms

📥 Making second request (cache hit expected)...
✅ Second request completed in 67ms

📊 PERFORMANCE COMPARISON
────────────────────────────────────────────────────────────────────
ℹ️  First request (cache miss):  8234ms
ℹ️  Second request (cache hit):   67ms
🚀 Speed improvement:         122.9x faster (99.2% faster)
✅ ✨ CACHING IS WORKING! Second request was significantly faster.

[... more tests ...]

📊 FINAL SUMMARY
====================================================================
✅ Quiz Form              - 122.9x faster
✅ 21-Day Plan            - 245.3x faster
✅ Quiz Summary           - 156.7x faster
✅ Onboarding             - 98.4x faster

====================================================================
✅ ALL TESTS PASSED (4/4)

🎉 Redis caching is working perfectly!
✅ Your AI API calls are being cached
✅ You're saving 60-80% on AI costs
✅ Response times are 10-100x faster on cache hits
```

## Option 2: Manual Testing with curl

If you prefer to test manually or don't have an auth token:

### Test 1: Quiz Form (5-15 seconds → 50ms)

**First Request (Cache Miss):**
```bash
curl -X POST http://localhost:3000/api/ai/quiz-form ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"habit_category\": \"nicotine_smoking\", \"user_context\": \"I smoke 10 cigarettes per day\"}"
```

**Measure the time** - it should take 5-15 seconds.

**Second Request (Cache Hit):**
Run the exact same command again immediately.

**Measure the time** - it should take 50-200ms (10-100x faster!).

### Test 2: 21-Day Plan (10-30 seconds → 50ms) - MOST EXPENSIVE

**First Request:**
```bash
curl -X POST http://localhost:3000/api/ai/plan-21d ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"habit_goal\": \"quit smoking\", \"quiz_summary\": \"{\\\"user_habit_raw\\\": \\\"smoking\\\", \\\"canonical_habit_name\\\": \\\"cigarette smoking\\\", \\\"habit_category\\\": \\\"nicotine_smoking\\\", \\\"severity_level\\\": \\\"moderate\\\", \\\"core_loop\\\": \\\"stress relief\\\", \\\"primary_payoff\\\": \\\"relaxation\\\", \\\"avoidance_target\\\": \\\"anxiety\\\", \\\"identity_link\\\": \\\"daily routine\\\", \\\"dopamine_profile\\\": \\\"quick spike\\\", \\\"collapse_condition\\\": \\\"high stress\\\", \\\"long_term_cost\\\": \\\"health issues\\\"}\"}"
```

**Measure the time** - it should take 10-30 seconds.

**Second Request:**
Run the exact same command again.

**Measure the time** - it should take 50-200ms (50-300x faster!).

### Test 3: Quiz Summary (10-20 seconds → 50ms)

**First Request:**
```bash
curl -X POST http://localhost:3000/api/ai/quiz-summary ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"habit_category\": \"nicotine_smoking\", \"habit_description\": \"smoking cigarettes\", \"answers\": {\"frequency\": \"daily\", \"duration\": \"5_years\"}}"
```

**Second Request:**
Run the same command again - should be much faster.

## What to Look For

### ✅ Success Indicators

**In Backend Logs:**
```
💾 AI response cached: /quiz-form (TTL: 3600s)      ← First request
✅ AI cache hit: /quiz-form                          ← Second request
```

**Performance:**
- First request: 5-30 seconds (depending on endpoint)
- Second request: 50-200ms
- Speed improvement: 10-300x faster

### ❌ If Caching is NOT Working

**Symptoms:**
- Both requests take the same time
- No "cache hit" messages in backend logs
- No performance improvement

**Possible Causes:**
1. Redis is not running
   ```bash
   docker ps | findstr redis
   # If not running: docker-compose up -d redis
   ```

2. Backend is not connected to Redis
   ```bash
   # Check backend logs for:
   ✅ Redis: Connected successfully
   ```

3. Request body is different
   - Make sure you're sending EXACTLY the same request
   - Even a single character difference will create a different cache key

4. Cache was cleared
   ```bash
   # Check if cache has keys:
   docker exec -it unhabit-redis redis-cli KEYS "ai:*"
   ```

## Monitor Redis in Real-Time

### Watch Cache Operations Live
```bash
docker exec -it unhabit-redis redis-cli MONITOR
```

Then make your API requests and watch Redis operations happen in real-time!

### View Cached Keys
```bash
docker exec -it unhabit-redis redis-cli KEYS "ai:*"
```

**Expected Output:**
```
1) "ai:/quiz-form:b4428b473919ddae"
2) "ai:/plan-21d:xyz789abc123def4"
3) "ai:/quiz-summary:abc123def456789"
```

### Check a Specific Cache Entry
```bash
docker exec -it unhabit-redis redis-cli GET "ai:/quiz-form:b4428b473919ddae"
```

This will show you the cached JSON response.

### Check TTL (Time Remaining)
```bash
docker exec -it unhabit-redis redis-cli TTL "ai:/quiz-form:b4428b473919ddae"
```

**Output:**
```
3542  # Seconds remaining (out of 3600 = 1 hour)
```

## Cost Savings Calculation

### Without Redis
- Quiz form: 10 requests/day × $0.01 = $0.10/day
- 21-day plan: 5 requests/day × $0.05 = $0.25/day
- Quiz summary: 8 requests/day × $0.02 = $0.16/day
- **Total: $0.51/day = $15.30/month**

### With Redis (70% cache hit rate)
- Quiz form: 3 requests/day × $0.01 = $0.03/day
- 21-day plan: 1.5 requests/day × $0.05 = $0.075/day
- Quiz summary: 2.4 requests/day × $0.02 = $0.048/day
- **Total: $0.153/day = $4.59/month**

**Savings: $10.71/month (70% reduction)**

With higher traffic, savings scale proportionally!

## Troubleshooting

### Issue: "Auth token required"

**Solution:**
Add your JWT token to `.env`:
```bash
TEST_AUTH_TOKEN="your-jwt-token-here"
```

### Issue: "AI service unavailable"

**Solution:**
Check if your AI service is running:
```bash
curl http://localhost:8000/health
# or
curl https://py.khurasanlabs.com/health
```

### Issue: "Connection refused"

**Solution:**
Make sure your backend is running:
```bash
npm run dev
```

### Issue: No performance improvement

**Solution:**
1. Check Redis is running: `docker ps | findstr redis`
2. Check backend logs for "Redis: Connected successfully"
3. Make sure you're sending EXACTLY the same request twice
4. Check Redis has cached keys: `docker exec -it unhabit-redis redis-cli KEYS "ai:*"`

## Summary

**Most Expensive Endpoints (Test These First):**

1. **21-Day Plan** (`/api/ai/plan-21d`) - 10-30 seconds → 50ms
   - Most expensive
   - Cached for 24 hours
   - Biggest cost savings

2. **Quiz Summary** (`/api/ai/quiz-summary`) - 10-20 seconds → 50ms
   - Very expensive
   - Cached for 24 hours
   - High cost savings

3. **Quiz Form** (`/api/ai/quiz-form`) - 5-15 seconds → 50ms
   - Expensive
   - Cached for 1 hour
   - Good cost savings

4. **Onboarding** (`/api/ai/onboarding/start`) - 5-10 seconds → 50ms
   - Moderately expensive
   - Cached for 1 hour
   - Moderate cost savings

**Quick Test:**
```bash
# 1. Add token to .env
echo TEST_AUTH_TOKEN="your-token" >> .env

# 2. Run automated test
npm run test:ai-cache

# 3. Watch for 10-300x performance improvements!
```

Your Redis caching is working if you see massive performance improvements on the second request! 🚀
