# How to Test AI Caching - Simple Steps

## Quick Start (3 Steps)

### Step 1: Make Sure Everything is Running

```bash
# Check Redis is running
docker ps | findstr redis

# If not running, start it:
docker-compose up -d redis

# Start your backend (in a new terminal)
npm run dev
```

**Look for:** `✅ Redis: Connected successfully`

### Step 2: Get an Auth Token

You need a JWT token to make authenticated API requests. Here are your options:

#### Option A: Use an Existing Token (Easiest)

If you have your app running:
1. Login to your app
2. Open browser DevTools (F12)
3. Go to: Application → Local Storage or Cookies
4. Find your JWT token (usually called `token`, `access_token`, or `jwt`)
5. Copy the token value

#### Option B: Test Without Auth (If Endpoints Allow)

Some endpoints might work without authentication. Try the test and see if it works.

#### Option C: Create a Test User

If you have a registration/login endpoint, create a test user and get the token from the login response.

### Step 3: Run the Test

**With Auth Token:**
```bash
# Add token to .env
echo TEST_AUTH_TOKEN="your-jwt-token-here" >> .env

# Run the test
npm run test:ai-cache
```

**Without Auth Token (try it):**
```bash
npm run test:ai-cache
```

## What You'll See

### If Caching is Working ✅

```
🧪 AI CACHING TEST SUITE - MOST EXPENSIVE ENDPOINTS
====================================================================

TEST: 21-Day Plan Generation
====================================================================
📤 Making first request (cache miss expected)...
✅ First request completed in 15234ms

📥 Making second request (cache hit expected)...
✅ Second request completed in 52ms

📊 PERFORMANCE COMPARISON
────────────────────────────────────────────────────────────────────
ℹ️  First request (cache miss):  15234ms
ℹ️  Second request (cache hit):   52ms
🚀 Speed improvement:         293.0x faster (99.7% faster)
✅ ✨ CACHING IS WORKING! Second request was significantly faster.

====================================================================
📊 FINAL SUMMARY
====================================================================
✅ Quiz Form              - 122.9x faster
✅ 21-Day Plan            - 293.0x faster
✅ Quiz Summary           - 156.7x faster
✅ Onboarding             - 98.4x faster

✅ ALL TESTS PASSED (4/4)

🎉 Redis caching is working perfectly!
✅ Your AI API calls are being cached
✅ You're saving 60-80% on AI costs
✅ Response times are 10-100x faster on cache hits
```

### If Caching is NOT Working ❌

```
⚠️  Caching may not be working. Second request was not significantly faster.
```

**What to check:**
1. Is Redis running? `docker ps | findstr redis`
2. Is backend connected? Look for `✅ Redis: Connected successfully` in logs
3. Are you using a valid auth token?

## Manual Testing (Alternative)

If you prefer to test manually with curl:

### Test the Most Expensive Endpoint (21-Day Plan)

**First Request (will be slow):**
```bash
curl -X POST http://localhost:3000/api/ai/plan-21d ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"habit_goal\": \"quit smoking\", \"quiz_summary\": \"{\\\"user_habit_raw\\\": \\\"smoking\\\", \\\"canonical_habit_name\\\": \\\"cigarette smoking\\\", \\\"habit_category\\\": \\\"nicotine_smoking\\\", \\\"severity_level\\\": \\\"moderate\\\", \\\"core_loop\\\": \\\"stress relief\\\", \\\"primary_payoff\\\": \\\"relaxation\\\", \\\"avoidance_target\\\": \\\"anxiety\\\", \\\"identity_link\\\": \\\"daily routine\\\", \\\"dopamine_profile\\\": \\\"quick spike\\\", \\\"collapse_condition\\\": \\\"high stress\\\", \\\"long_term_cost\\\": \\\"health issues\\\"}\"}"
```

**Time it:** Should take 10-30 seconds

**Second Request (will be fast):**
Run the EXACT same command again immediately.

**Time it:** Should take 50-200ms (50-300x faster!)

### Watch Backend Logs

While making requests, watch your backend terminal:

**First request:**
```
💾 AI response cached: /plan-21d (TTL: 86400s)
```

**Second request:**
```
✅ AI cache hit: /plan-21d
```

## Monitor Redis Live

Open a new terminal and run:

```bash
docker exec -it unhabit-redis redis-cli MONITOR
```

Then make your API requests. You'll see Redis operations in real-time:
```
1709876543.123456 [0 127.0.0.1:54321] "GET" "ai:/plan-21d:abc123..."
1709876543.234567 [0 127.0.0.1:54321] "SETEX" "ai:/plan-21d:abc123..." "86400" "{...}"
```

## Verify Cache is Populated

```bash
# View all AI cache keys
docker exec -it unhabit-redis redis-cli KEYS "ai:*"

# Check a specific key's TTL
docker exec -it unhabit-redis redis-cli TTL "ai:/plan-21d:abc123..."
```

## Troubleshooting

### "No TEST_AUTH_TOKEN provided"

**Solution:** Add your JWT token to `.env`:
```bash
TEST_AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### "Connection refused" or "ECONNREFUSED"

**Solution:** Make sure backend is running:
```bash
npm run dev
```

### "Redis is not available"

**Solution:** Start Redis:
```bash
docker-compose up -d redis
```

### "AI service unavailable"

**Solution:** Check your AI service is running:
```bash
# Check .env for AI_SERVICE_URL
type .env | findstr AI_SERVICE

# Test AI service
curl https://py.khurasanlabs.com/health
```

### Second request is not faster

**Possible causes:**
1. Request body is different (must be EXACTLY the same)
2. Redis was cleared between requests
3. Cache expired (unlikely within seconds)
4. Redis is not connected

**Check:**
```bash
# Check Redis has cached keys
docker exec -it unhabit-redis redis-cli KEYS "ai:*"

# Check backend logs for "Redis: Connected successfully"
```

## What Success Looks Like

✅ **Backend logs show:**
- `✅ Redis: Connected successfully` on startup
- `💾 AI response cached: /endpoint` on first request
- `✅ AI cache hit: /endpoint` on second request

✅ **Performance:**
- First request: 5-30 seconds
- Second request: 50-200ms
- Improvement: 10-300x faster

✅ **Redis has cached data:**
```bash
docker exec -it unhabit-redis redis-cli KEYS "ai:*"
# Shows multiple cached keys
```

## Summary

**Simplest test:**
```bash
# 1. Start everything
docker-compose up -d redis
npm run dev

# 2. Get a token from your app (login and copy from DevTools)

# 3. Add to .env
echo TEST_AUTH_TOKEN="your-token" >> .env

# 4. Run test
npm run test:ai-cache

# 5. Look for 10-300x performance improvements!
```

If you see massive performance improvements on the second request, **Redis caching is working!** 🎉

For more details, see `TEST_AI_CACHING.md`.
