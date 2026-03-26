# Redis Quick Reference Card

## 🚀 Quick Start (3 Commands)

```bash
# 1. Start Redis
docker-compose up -d redis

# 2. Start Backend
npm run dev

# 3. Test Redis
npm run test:redis
```

## ✅ Check if Redis is Working

### Look for this in backend logs:
```
✅ Redis: Connected successfully
```

### Test with CLI:
```bash
docker exec -it unhabit-redis redis-cli ping
# Should return: PONG
```

## 📊 Monitor Cache Performance

### View all cached keys:
```bash
docker exec -it unhabit-redis redis-cli KEYS "*"
```

### Watch Redis in real-time:
```bash
docker exec -it unhabit-redis redis-cli MONITOR
```

### Check memory usage:
```bash
docker exec -it unhabit-redis redis-cli INFO memory
```

## 🔍 What Gets Cached?

| Endpoint | TTL | Impact |
|----------|-----|--------|
| Quiz Form | 1 hour | 5-15s → 50ms |
| Quiz Summary | 24 hours | 10-20s → 50ms |
| 21-Day Plan | 24 hours | 10-30s → 50ms |
| Dashboard | 2 minutes | 500ms → 10ms |
| Leaderboard | 5 minutes | 300ms → 5ms |
| Coach Chat | No cache | Conversational |

## 🛠️ Common Commands

### Start/Stop Redis
```bash
docker-compose up -d redis      # Start
docker-compose stop redis       # Stop
docker-compose restart redis    # Restart
docker-compose logs -f redis    # View logs
```

### Clear Cache (Development Only!)
```bash
# Clear all cache
docker exec -it unhabit-redis redis-cli FLUSHDB

# Clear AI cache only
docker exec -it unhabit-redis redis-cli KEYS "ai:*" | xargs docker exec -i unhabit-redis redis-cli DEL

# Clear specific key
docker exec -it unhabit-redis redis-cli DEL "ai:/quiz-form:abc123"
```

### Check Specific Cache
```bash
# Check if key exists
docker exec -it unhabit-redis redis-cli EXISTS "ai:/quiz-form:abc123"

# Get key value
docker exec -it unhabit-redis redis-cli GET "ai:/quiz-form:abc123"

# Check TTL (time remaining)
docker exec -it unhabit-redis redis-cli TTL "ai:/quiz-form:abc123"
```

## 🧪 Test Cache is Working

### Test 1: Make same request twice
```bash
# First request (slow - cache miss)
curl -X POST http://localhost:3000/api/ai/quiz-form \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"habit_category": "nicotine_smoking"}'

# Second request (fast - cache hit)
# Run same command again immediately
```

**Look for in logs:**
- First: `💾 AI response cached: /quiz-form (TTL: 3600s)`
- Second: `✅ AI cache hit: /quiz-form`

### Test 2: Run automated tests
```bash
npm run test:redis
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "REDIS_URL not configured" | Add `REDIS_URL="redis://localhost:6379"` to `.env` |
| "connect ECONNREFUSED" | Run `docker-compose up -d redis` |
| No cache hits | Check request body is identical |
| Rate limiting not working | Redis must be running |
| App crashes without Redis | Check graceful degradation code |

## 📈 Performance Expectations

### Cache Hit (Good!)
- Response time: 50-200ms
- Log message: `✅ AI cache hit: /endpoint`
- No AI API call made
- No cost incurred

### Cache Miss (Normal for first request)
- Response time: 5-30 seconds
- Log message: `💾 AI response cached: /endpoint`
- AI API call made
- Cost incurred

### Expected Hit Rates
- AI responses: 60-80%
- Dashboard: 70-90%
- Leaderboards: 80-95%

## 🔒 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| AI Onboarding | 5 requests | 1 hour |
| AI Quiz | 10 requests | 1 hour |
| AI Plan | 3 requests | 1 hour |
| AI Coach | 30 requests | 1 hour |
| Auth Login | 5 requests | 5 minutes |
| General API | 100 requests | 1 minute |

## 📝 Environment Variables

```bash
# Required
REDIS_URL="redis://localhost:6379"
REDIS_ENABLED="true"

# Production (with TLS)
REDIS_URL="rediss://username:password@host:port"
```

## 🎯 Success Indicators

✅ Backend logs show "Redis: Connected successfully"
✅ Second identical request is 10-100x faster
✅ Logs show "AI cache hit" messages
✅ Rate limiting returns 429 after limit
✅ App works even if Redis is stopped

## 📚 More Information

- Full guide: `REDIS_TESTING_GUIDE.md`
- Architecture: `REDIS_ARCHITECTURE.md`
- Quick start: `REDIS_QUICK_START.md`
- Summary: `REDIS_SUMMARY.md`
