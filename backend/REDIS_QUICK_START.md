# Redis Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Redis

**Option A: Docker (Recommended)**
```bash
cd UNHABIT/backend
docker-compose up -d redis
```

**Option B: Local Installation**

macOS:
```bash
brew install redis
brew services start redis
```

Ubuntu/Debian:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

Windows:
```bash
# Use Docker or WSL
docker run -d -p 6379:6379 redis:7-alpine
```

### 2. Configure Environment

Add to `.env`:
```bash
REDIS_URL="redis://localhost:6379"
REDIS_ENABLED="true"
```

### 3. Start Backend

```bash
npm run dev
```

You should see:
```
✅ Redis: Connected successfully
🚀 API listening on http://localhost:3000
```

### 4. Test It Works

```bash
# Test AI caching (make same request twice)
curl -X POST http://localhost:3000/api/ai/canonicalize-habit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_input": "smoking cigarettes"}'

# Second request should be instant (cache hit)
# Check logs for: ✅ AI cache hit: /canonicalize-habit
```

### 5. Monitor Redis

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# View cached keys
redis-cli KEYS "*"

# Monitor commands in real-time
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory
```

## 🎯 What's Cached?

### AI Responses (Biggest Impact)
- Quiz forms: 1 hour
- Quiz summaries: 24 hours
- 21-day plans: 24 hours
- Day explanations: 24 hours

**Benefit:** 10-30s → 50ms on cache hit

### Dashboard Data
- User dashboard: 2 minutes
- Leaderboards: 5 minutes

**Benefit:** 500-1000ms → 10-50ms on cache hit

### Rate Limiting
- AI endpoints: 3-30 requests/hour
- Auth endpoints: 5 requests/5min
- General API: 100 requests/minute

**Benefit:** Protects against abuse

## 🔧 Common Commands

```bash
# Start Redis
docker-compose up -d redis

# Stop Redis
docker-compose stop redis

# View logs
docker-compose logs -f redis

# Clear all cache (development only!)
redis-cli FLUSHDB

# Clear specific pattern
redis-cli KEYS "ai:*" | xargs redis-cli DEL

# Check specific key
redis-cli GET "cache:dashboard:user123"

# Check TTL
redis-cli TTL "ai:plan-21d:abc123"
```

## 🐛 Troubleshooting

### Redis Not Connecting

```
⚠️ Redis: REDIS_URL not configured, running without cache
```

**Fix:** Add `REDIS_URL="redis://localhost:6379"` to `.env`

### Connection Refused

```
❌ Redis error: connect ECONNREFUSED 127.0.0.1:6379
```

**Fix:** Start Redis: `docker-compose up -d redis`

### App Still Works Without Redis?

**Yes!** The app gracefully degrades. It will:
- ✅ Continue to function normally
- ⚠️ Be slower (no caching)
- ⚠️ Have no rate limiting
- ⚠️ Make more AI requests

## 📊 Verify It's Working

### Check Logs

Look for these messages:
```
✅ Redis: Connected successfully
💾 AI response cached: /plan-21d (TTL: 86400s)
✅ AI cache hit: /quiz-summary
```

### Check Performance

```bash
# Without cache (first request)
time curl -X POST http://localhost:3000/api/ai/plan-21d ...
# ~10-30 seconds

# With cache (second request)
time curl -X POST http://localhost:3000/api/ai/plan-21d ...
# ~50ms
```

### Check Rate Limiting

```bash
# Make 4 requests quickly
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/ai/plan-21d ...
done

# 4th request should return:
# HTTP 429 Too Many Requests
# {"error": "Rate limit exceeded", "retry_after": 3600}
```

## 🚀 Production Setup

### Use Managed Redis

**Recommended Services:**
- AWS ElastiCache
- Redis Cloud
- DigitalOcean Managed Redis
- Upstash (serverless)

### Update Environment

```bash
# Production with TLS
REDIS_URL="rediss://username:password@your-redis-host:6380"
REDIS_ENABLED="true"
```

### Security Checklist

- ✅ Use TLS (rediss://)
- ✅ Set strong password
- ✅ Use private network/VPC
- ✅ Enable firewall rules
- ✅ Set maxmemory limit
- ✅ Monitor memory usage

## 📚 Learn More

- [Full Architecture Documentation](./REDIS_ARCHITECTURE.md)
- [Redis Official Docs](https://redis.io/docs/)
- [ioredis Documentation](https://github.com/redis/ioredis)

## 🎉 You're Done!

Redis is now:
- ✅ Caching expensive AI operations
- ✅ Rate limiting API endpoints
- ✅ Caching dashboard and leaderboards
- ✅ Protecting against duplicate operations
- ✅ Gracefully degrading if unavailable

Your API is now faster, more secure, and production-ready!
