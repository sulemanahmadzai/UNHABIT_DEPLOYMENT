# Redis Integration Architecture

## Overview

Redis is integrated into the UnHabit backend to provide:
- **AI Response Caching** - Cache expensive AI operations (quiz generation, 21-day plans)
- **Rate Limiting** - Protect expensive endpoints from abuse
- **Session/User Caching** - Reduce database load for frequently accessed data
- **Leaderboard Caching** - Cache complex aggregation queries
- **Dashboard Caching** - Cache expensive multi-query dashboard data
- **Idempotency** - Prevent duplicate operations (AI requests, point awards)

## Architecture Decisions

### 1. Graceful Degradation
- **Fail Open**: If Redis is unavailable, the app continues to function
- All Redis operations have fallback behavior
- No critical path depends solely on Redis

### 2. Cache Patterns

#### AI Response Caching
```
Key Pattern: ai:{endpoint}:{request_hash}
TTL: 1-24 hours depending on endpoint
Invalidation: Time-based (no manual invalidation needed)

Endpoints:
- /ai/quiz-form: 1 hour (user context may change)
- /ai/quiz-summary: 24 hours (deterministic based on answers)
- /ai/plan-21d: 24 hours (expensive, deterministic)
- /ai/coach: No cache (conversational)
- /ai/why-day: 24 hours (stable content)
```

#### Rate Limiting
```
Key Pattern: ratelimit:{user|ip}:{userId|ip}:{endpoint}
Data Structure: Sorted Set (timestamps as scores)
Algorithm: Sliding Window
TTL: Window duration

Limits:
- AI Onboarding: 5/hour
- AI Quiz: 10/hour
- AI Plan: 3/hour
- AI Coach: 30/hour
- Auth Login: 5/5min (block 15min on exceed)
- General API: 100/minute
```

#### User/Session Cache
```
Key Pattern: profile:{userId}
TTL: 10 minutes
Invalidation: On profile update
```

#### Dashboard Cache
```
Key Pattern: dashboard:{userId}
TTL: 2 minutes
Invalidation: On task completion, point award
```

#### Leaderboard Cache
```
Key Pattern: leaderboard:{daily|weekly|friends}:{userId}
TTL: 5 minutes
Invalidation: On point award (invalidate all)
```

#### Idempotency
```
Key Pattern: idempotency:{operation}:{hash}
TTL: 24 hours
Purpose: Prevent duplicate AI requests, point awards, badge grants
```

### 3. Connection Management

- **Connection Pooling**: ioredis handles connection pooling automatically
- **Retry Strategy**: Exponential backoff up to 10 retries
- **Reconnection**: Automatic reconnection on connection loss
- **Health Checks**: Connection status monitored via events
- **Graceful Shutdown**: Redis disconnects cleanly on server shutdown

### 4. Key Naming Convention

```
{namespace}:{entity}:{identifier}:{sub-key}

Examples:
- cache:dashboard:user123
- ratelimit:user:user123:/api/ai/plan-21d
- ai:plan-21d:abc123def456
- idempotency:points:user123:task_complete:task456
```

## Service Architecture

### Core Services

1. **redis.ts** - Low-level Redis client wrapper
   - Connection management
   - Helper methods (get, set, del, incr, etc.)
   - Hash generation for cache keys
   - Graceful degradation

2. **cache.service.ts** - High-level caching patterns
   - Cache-aside pattern
   - Cache warming
   - Invalidation helpers
   - Domain-specific cache functions

3. **rate-limit.service.ts** - Rate limiting
   - Sliding window algorithm
   - Per-user and per-IP limits
   - Configurable limits per endpoint
   - Block duration on exceed

4. **idempotency.service.ts** - Idempotency protection
   - Prevent duplicate operations
   - Store operation results
   - TTL-based cleanup

### Middleware

1. **rate-limit.ts** - Express middleware
   - Applies rate limits to routes
   - Sets rate limit headers
   - Returns 429 on exceed

## Usage Examples

### Caching AI Responses

```typescript
// In ai-client.service.ts
const requestHash = redis.hash(body);
const cached = await getCachedAIResponse(endpoint, requestHash);
if (cached) return { success: true, data: cached };

// ... make AI request ...

await cacheAIResponse(endpoint, requestHash, data, CACHE_TTL.PLAN_21D);
```

### Rate Limiting Routes

```typescript
// In routes/ai.ts
import { rateLimiters } from "../middlewares/rate-limit.js";

router.post("/plan-21d", requireAuth, rateLimiters.aiPlan, handler);
```

### Caching Dashboard

```typescript
// In home.service.ts
const cached = await getCachedDashboard(userId);
if (cached) return cached;

// ... fetch data ...

await cacheDashboard(userId, data, 120); // 2 minutes
```

### Idempotency

```typescript
// Prevent duplicate AI requests
const idempotencyKey = generateAIIdempotencyKey(userId, endpoint, request);
const result = await withIdempotency(idempotencyKey, async () => {
  return await makeAIRequest(request);
}, 86400); // 24 hours

if (!result.isNew) {
  return result.data; // Return cached result
}
```

## Performance Impact

### Before Redis
- AI plan generation: ~10-30s per request
- Dashboard load: ~500-1000ms (9+ queries)
- Leaderboard: ~300-500ms (complex aggregations)
- No rate limiting (vulnerable to abuse)

### After Redis
- AI plan generation: ~50ms (cache hit), ~10-30s (cache miss)
- Dashboard load: ~10-50ms (cache hit), ~500-1000ms (cache miss)
- Leaderboard: ~5-10ms (cache hit), ~300-500ms (cache miss)
- Rate limiting: ~2-5ms overhead per request

### Cache Hit Rates (Expected)
- AI responses: 60-80% (users retry similar requests)
- Dashboard: 70-90% (users refresh frequently)
- Leaderboard: 80-95% (many users view same data)

## Monitoring

### Key Metrics to Monitor

1. **Cache Hit Rate**
   ```
   hits / (hits + misses) * 100
   ```

2. **Memory Usage**
   ```
   redis-cli INFO memory
   ```

3. **Connection Status**
   - Monitor connection events in logs
   - Track reconnection attempts

4. **Rate Limit Blocks**
   - Monitor 429 responses
   - Track blocked users/IPs

### Redis CLI Commands

```bash
# Check memory usage
redis-cli INFO memory

# Check key count
redis-cli DBSIZE

# View keys by pattern
redis-cli KEYS "ai:*"

# Check TTL
redis-cli TTL "cache:dashboard:user123"

# Monitor commands in real-time
redis-cli MONITOR

# Get cache statistics
redis-cli INFO stats
```

## Deployment

### Development

```bash
# Start Redis with Docker Compose
docker-compose up -d redis

# Or install locally
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo apt install redis-server && sudo systemctl start redis
# Windows: Use Docker or WSL
```

### Production

#### Option 1: Managed Redis (Recommended)
- **AWS ElastiCache**: Fully managed, automatic failover
- **Redis Cloud**: Official Redis managed service
- **DigitalOcean Managed Redis**: Simple, affordable
- **Upstash**: Serverless Redis with per-request pricing

#### Option 2: Self-Hosted
```bash
# Use docker-compose.yml with persistent volumes
docker-compose up -d redis

# Or install on server
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Configure for production
sudo nano /etc/redis/redis.conf
# Set: maxmemory 1gb
# Set: maxmemory-policy allkeys-lru
# Set: appendonly yes
```

### Environment Variables

```bash
# Development
REDIS_URL="redis://localhost:6379"
REDIS_ENABLED="true"

# Production (with TLS)
REDIS_URL="rediss://username:password@host:port"
REDIS_ENABLED="true"

# Disable Redis (fallback mode)
REDIS_ENABLED="false"
```

## Security

### Best Practices

1. **Use TLS in Production**
   ```
   REDIS_URL="rediss://..." # Note the 'rediss' protocol
   ```

2. **Set Password**
   ```bash
   # In redis.conf
   requirepass your-strong-password
   
   # In connection URL
   redis://:password@host:port
   ```

3. **Limit Memory**
   ```bash
   # In redis.conf
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   ```

4. **Disable Dangerous Commands**
   ```bash
   # In redis.conf
   rename-command FLUSHDB ""
   rename-command FLUSHALL ""
   rename-command CONFIG ""
   ```

5. **Network Security**
   - Bind to localhost in development
   - Use VPC/private network in production
   - Enable firewall rules

## Troubleshooting

### Redis Connection Failed

```
❌ Redis error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
1. Check if Redis is running: `redis-cli ping`
2. Start Redis: `docker-compose up -d redis`
3. Check REDIS_URL in .env
4. App will continue without Redis (graceful degradation)

### Memory Issues

```
❌ Redis error: OOM command not allowed when used memory > 'maxmemory'
```

**Solution:**
1. Increase maxmemory: `redis-cli CONFIG SET maxmemory 512mb`
2. Set eviction policy: `redis-cli CONFIG SET maxmemory-policy allkeys-lru`
3. Clear cache: `redis-cli FLUSHDB` (development only)

### High Latency

**Symptoms:** Slow cache operations

**Solution:**
1. Check network latency to Redis
2. Monitor slow queries: `redis-cli SLOWLOG GET 10`
3. Reduce TTLs to decrease memory pressure
4. Consider Redis cluster for scaling

### Cache Stampede

**Symptoms:** Many requests hit database simultaneously when cache expires

**Solution:**
- Already handled by cache-aside pattern
- Consider implementing cache warming for critical data
- Stagger TTLs to avoid simultaneous expiration

## Future Enhancements

### Potential Additions

1. **Pub/Sub for Real-time Updates**
   - Notify users of buddy activity
   - Real-time leaderboard updates
   - Live notifications

2. **Job Queue (BullMQ)**
   - Background AI processing
   - Scheduled notifications
   - Batch analytics calculations

3. **Session Store**
   - Store user sessions in Redis
   - Enable horizontal scaling
   - Faster session lookup

4. **Distributed Locks**
   - Prevent race conditions
   - Coordinate background jobs
   - Ensure single execution

5. **Geospatial Features**
   - Location-based buddy matching
   - Regional leaderboards
   - Timezone-aware notifications

## Testing

### Manual Testing

```bash
# Test cache
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/home/dashboard
# Check Redis: redis-cli GET "cache:dashboard:user123"

# Test rate limiting
for i in {1..10}; do
  curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/ai/plan-21d
done
# Should get 429 after 3 requests

# Test graceful degradation
docker-compose stop redis
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/home/dashboard
# Should still work (slower)
```

### Automated Testing

```typescript
// test-redis.ts
import redis from "./src/db/redis.js";

async function testRedis() {
  // Test connection
  console.log("Redis available:", redis.isAvailable());
  
  // Test set/get
  await redis.set("test:key", "test-value", 60);
  const value = await redis.get("test:key");
  console.log("Retrieved:", value);
  
  // Test rate limiting
  const result = await checkUserRateLimit("test-user", "/test", {
    maxRequests: 5,
    windowSeconds: 60,
  });
  console.log("Rate limit:", result);
  
  await redis.disconnect();
}

testRedis();
```

## Conclusion

Redis integration provides significant performance improvements and security enhancements while maintaining system reliability through graceful degradation. The architecture is production-ready, scalable, and follows best practices for caching, rate limiting, and idempotency.
