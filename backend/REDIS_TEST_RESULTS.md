# Redis Testing Results Template

Use this document to record your Redis testing results.

## Test Date: _______________

## Environment
- [ ] Windows
- [ ] macOS
- [ ] Linux
- [ ] WSL

## Pre-Test Checklist

- [ ] Docker is installed
- [ ] `.env` has `REDIS_URL="redis://localhost:6379"`
- [ ] `.env` has `REDIS_ENABLED="true"`
- [ ] Backend dependencies installed (`npm install`)

## Test 1: Redis Connection

### Command:
```bash
docker-compose up -d redis
docker exec -it unhabit-redis redis-cli ping
```

### Expected Output:
```
PONG
```

### Actual Output:
```
[Write your output here]
```

### Status: ⬜ PASS ⬜ FAIL

---

## Test 2: Backend Connection to Redis

### Command:
```bash
npm run dev
```

### Expected Output in Logs:
```
✅ Redis: Connected successfully
🚀 API listening on http://localhost:3000
```

### Actual Output:
```
[Write your output here]
```

### Status: ⬜ PASS ⬜ FAIL

---

## Test 3: Automated Redis Tests

### Command:
```bash
npm run test:redis
```

### Expected Output:
```
ALL TESTS PASSED (7/7)
🎉 Redis integration is working perfectly!
```

### Actual Output:
```
[Write your output here]
```

### Test Results:
- [ ] Redis Connection
- [ ] Basic Cache Operations
- [ ] AI Response Caching
- [ ] Hash Generation
- [ ] TTL Expiration
- [ ] Pattern-Based Deletion
- [ ] Cache Performance

### Status: ⬜ PASS ⬜ FAIL

---

## Test 4: AI Response Caching (Manual)

### Test 4a: First Request (Cache Miss)

#### Command:
```bash
curl -X POST http://localhost:3000/api/ai/quiz-form ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"habit_category\": \"nicotine_smoking\"}"
```

#### Expected in Backend Logs:
```
💾 AI response cached: /quiz-form (TTL: 3600s)
```

#### Response Time: _______ seconds

#### Actual Log Output:
```
[Write your output here]
```

### Test 4b: Second Request (Cache Hit)

#### Command:
Same as above

#### Expected in Backend Logs:
```
✅ AI cache hit: /quiz-form
```

#### Response Time: _______ milliseconds

#### Actual Log Output:
```
[Write your output here]
```

### Performance Improvement:
- First request: _______ seconds
- Second request: _______ milliseconds
- Speed improvement: _______x faster

### Status: ⬜ PASS ⬜ FAIL

---

## Test 5: Cache Inspection

### Command:
```bash
docker exec -it unhabit-redis redis-cli KEYS "*"
```

### Expected Output:
```
1) "ai:/quiz-form:abc123..."
[other keys]
```

### Actual Output:
```
[Write your output here]
```

### Number of Cached Keys: _______

### Status: ⬜ PASS ⬜ FAIL

---

## Test 6: Rate Limiting

### Command:
Run the same AI request 4 times quickly

### Expected Behavior:
- Requests 1-3: Success (200 OK)
- Request 4: Rate limited (429 Too Many Requests)

### Actual Results:
- Request 1: ⬜ 200 ⬜ 429 ⬜ Other: _______
- Request 2: ⬜ 200 ⬜ 429 ⬜ Other: _______
- Request 3: ⬜ 200 ⬜ 429 ⬜ Other: _______
- Request 4: ⬜ 200 ⬜ 429 ⬜ Other: _______

### Status: ⬜ PASS ⬜ FAIL

---

## Test 7: Graceful Degradation

### Test 7a: Stop Redis

#### Command:
```bash
docker-compose stop redis
```

### Test 7b: Make API Request

#### Expected Behavior:
- Request still works (200 OK)
- Backend logs show: `⚠️ Redis: Connection closed`
- Response is slower (no caching)

#### Actual Behavior:
```
[Write your output here]
```

### Test 7c: Restart Redis

#### Command:
```bash
docker-compose up -d redis
```

#### Expected in Backend Logs:
```
🔄 Redis: Reconnecting...
✅ Redis: Connected successfully
```

#### Actual Log Output:
```
[Write your output here]
```

### Status: ⬜ PASS ⬜ FAIL

---

## Test 8: Memory Usage

### Command:
```bash
docker exec -it unhabit-redis redis-cli INFO memory
```

### Key Metrics:
- used_memory_human: _______
- used_memory_peak_human: _______
- maxmemory: _______

### Status: ⬜ PASS ⬜ FAIL

---

## Overall Test Summary

### Tests Passed: _____ / 8

### Issues Found:
```
[List any issues you encountered]
```

### Performance Metrics:
- Average cache hit response time: _______ ms
- Average cache miss response time: _______ seconds
- Cache hit rate (estimated): _______ %

### Recommendations:
```
[Any recommendations for optimization or fixes]
```

---

## Production Readiness Checklist

- [ ] All tests passed
- [ ] Redis connects successfully
- [ ] Cache hits are significantly faster than cache misses
- [ ] Rate limiting works correctly
- [ ] Graceful degradation works (app runs without Redis)
- [ ] Memory usage is reasonable
- [ ] No errors in Redis logs
- [ ] Backend logs show proper cache operations

### Ready for Production? ⬜ YES ⬜ NO

### Notes:
```
[Additional notes]
```

---

## Next Steps

If all tests passed:
- [ ] Deploy Redis to production environment
- [ ] Update production `.env` with Redis URL
- [ ] Monitor cache hit rates in production
- [ ] Set up Redis monitoring/alerts

If tests failed:
- [ ] Review error messages
- [ ] Check Docker is running
- [ ] Verify `.env` configuration
- [ ] Check Redis logs: `docker-compose logs redis`
- [ ] Consult `REDIS_TESTING_GUIDE.md`

---

## Support

If you need help:
1. Check `REDIS_TESTING_GUIDE.md` for detailed troubleshooting
2. Check `REDIS_QUICK_REFERENCE.md` for common commands
3. Review Redis logs: `docker-compose logs redis`
4. Review backend logs for Redis-related messages
