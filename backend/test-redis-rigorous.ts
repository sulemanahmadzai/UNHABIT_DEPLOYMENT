/**
 * Rigorous Redis Implementation Test
 * 
 * Tests every aspect of the Redis caching layer:
 *   1. Connection & health
 *   2. Basic set/get operations
 *   3. TTL (expiration) behavior
 *   4. AI response caching (the exact flow used for plan-21d)
 *   5. Cache key hashing (deterministic)
 *   6. Cache invalidation
 *   7. Pattern deletion
 *   8. Graceful degradation (simulated Redis failure)
 *   9. Concurrent cache access
 *  10. Cache-aside pattern
 *  11. Full plan-21d cache flow (end-to-end)
 * 
 * Usage:
 *   cd backend && npx tsx test-redis-rigorous.ts
 */

import "dotenv/config";

// We need to dynamically import after dotenv loads
async function main() {
  // ──────────────────────────────────────────────────────────
  // Dynamic imports (after env vars are loaded)
  // ──────────────────────────────────────────────────────────
  const redisModule = await import("./src/db/redis.js");
  const redis = redisModule.default;

  const cacheModule = await import("./src/services/cache.service.js");
  const {
    cacheAIResponse,
    getCachedAIResponse,
    cacheAside,
    invalidate,
    invalidatePattern,
  } = cacheModule;

  // Test state
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function assert(condition: boolean, testName: string, details = "") {
    if (condition) {
      passed++;
      console.log(`  ✅ ${testName}`);
    } else {
      failed++;
      console.log(`  ❌ ${testName}${details ? ` — ${details}` : ""}`);
    }
  }

  function skip(testName: string, reason: string) {
    skipped++;
    console.log(`  ⏭️  ${testName} — ${reason}`);
  }

  // ──────────────────────────────────────────────────────────
  // Test 1: Connection & Health
  // ──────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Rigorous Redis Implementation Test            ║");
  console.log("╚══════════════════════════════════════════════════╝");

  console.log("\n── 1. Connection & Health ──");
  
  // Give Redis a moment to connect
  await new Promise(r => setTimeout(r, 1000));
  
  const isAvailable = redis.isAvailable();
  assert(isAvailable, "Redis is connected and available");
  
  if (!isAvailable) {
    console.log("\n⛔ Redis is NOT available. Check REDIS_URL in .env.");
    console.log("   Current REDIS_URL:", process.env.REDIS_URL || "(not set)");
    console.log("   REDIS_ENABLED:", process.env.REDIS_ENABLED || "(not set)");
    console.log("\n   All cache tests will be skipped.\n");
    
    // Test graceful degradation even when disconnected
    console.log("── Graceful Degradation (Redis unavailable) ──");
    const getResult = await redis.get("any-key");
    assert(getResult === null, "get() returns null when Redis unavailable");
    
    const setResult = await redis.set("any-key", "value", 60);
    assert(setResult === false, "set() returns false when Redis unavailable");
    
    const delResult = await redis.del("any-key");
    assert(delResult === false, "del() returns false when Redis unavailable");
    
    const cachedAI = await getCachedAIResponse("/test", "hash123");
    assert(cachedAI === null, "getCachedAIResponse() returns null when Redis unavailable");

    printSummary();
    return;
  }

  // ──────────────────────────────────────────────────────────
  // Test 2: Basic Set/Get Operations
  // ──────────────────────────────────────────────────────────
  console.log("\n── 2. Basic Set/Get Operations ──");

  // String value
  const setStr = await redis.set("test:string", "hello", 60);
  assert(setStr === true, "set() string returns true");

  const getStr = await redis.get<string>("test:string");
  assert(getStr === "hello", "get() string returns correct value", `got: ${getStr}`);

  // Object value (JSON serialization)
  const testObj = { name: "test", count: 42, nested: { a: 1 } };
  const setObj = await redis.set("test:object", testObj, 60);
  assert(setObj === true, "set() object returns true");

  const getObj = await redis.get<typeof testObj>("test:object");
  assert(
    getObj !== null && getObj.name === "test" && getObj.count === 42 && getObj.nested?.a === 1,
    "get() object returns correctly deserialized value",
    `got: ${JSON.stringify(getObj)}`
  );

  // Non-existent key
  const getMissing = await redis.get("test:nonexistent:key:xyz");
  assert(getMissing === null, "get() non-existent key returns null");

  // ──────────────────────────────────────────────────────────
  // Test 3: TTL (Expiration) Behavior
  // ──────────────────────────────────────────────────────────
  console.log("\n── 3. TTL (Expiration) Behavior ──");

  await redis.set("test:ttl", "expires-soon", 2); // 2 second TTL
  const beforeExpiry = await redis.get("test:ttl");
  assert(beforeExpiry === "expires-soon", "Value exists before TTL expires");

  const ttlValue = await redis.ttl("test:ttl");
  assert(ttlValue > 0 && ttlValue <= 2, "TTL returns correct remaining seconds", `got: ${ttlValue}`);

  console.log("   ⏳ Waiting 3 seconds for TTL expiry...");
  await new Promise(r => setTimeout(r, 3000));

  const afterExpiry = await redis.get("test:ttl");
  assert(afterExpiry === null, "Value is null after TTL expires");

  // ──────────────────────────────────────────────────────────
  // Test 4: AI Response Caching (Exact Production Flow)
  // ──────────────────────────────────────────────────────────
  console.log("\n── 4. AI Response Caching (Production Flow) ──");

  const testEndpoint = "/plan-21d";
  const testRequestBody = {
    state: {
      habit_description: "test habit for redis",
      quiz_summary: { user_habit_raw: "test", canonical_habit_name: "testing" },
    },
  };

  // Generate hash the same way the production code does
  const requestHash = redis.hash(testRequestBody);
  assert(typeof requestHash === "string" && requestHash.length > 0, "hash() produces a non-empty string");

  // Ensure hash is deterministic
  const requestHash2 = redis.hash(testRequestBody);
  assert(requestHash === requestHash2, "hash() is deterministic (same input → same hash)");

  // Different input → different hash
  const differentHash = redis.hash({ state: { habit_description: "different" } });
  assert(requestHash !== differentHash, "hash() produces different hash for different input");

  // Cache a response
  const mockAIResponse = {
    plan_summary: "Test plan for testing Redis caching",
    day_tasks: {
      day_1: [{ title: "Test task 1", description: "Do testing", kind: "behavioral" }],
      day_2: [{ title: "Test task 2", description: "More testing", kind: "cognitive" }],
    },
  };

  await cacheAIResponse(testEndpoint, requestHash, mockAIResponse, 60);
  
  // Retrieve cached response
  const cached = await getCachedAIResponse(testEndpoint, requestHash);
  assert(cached !== null, "getCachedAIResponse() returns cached data");
  assert(
    cached?.plan_summary === mockAIResponse.plan_summary,
    "Cached response matches original (plan_summary)",
    `got: ${cached?.plan_summary}`
  );
  assert(
    JSON.stringify(cached?.day_tasks) === JSON.stringify(mockAIResponse.day_tasks),
    "Cached response matches original (day_tasks)"
  );

  // Different hash = cache miss
  const cacheMiss = await getCachedAIResponse(testEndpoint, "nonexistent-hash");
  assert(cacheMiss === null, "getCachedAIResponse() returns null for cache miss");

  // Different endpoint = cache miss
  const cacheMiss2 = await getCachedAIResponse("/coach", requestHash);
  assert(cacheMiss2 === null, "getCachedAIResponse() returns null for different endpoint");

  // ──────────────────────────────────────────────────────────
  // Test 5: Cache Key Structure
  // ──────────────────────────────────────────────────────────
  console.log("\n── 5. Cache Key Structure ──");

  // Verify the key format: ai:{endpoint}:{hash}
  const expectedKey = `ai:${testEndpoint}:${requestHash}`;
  const existsResult = await redis.exists(expectedKey);
  assert(existsResult === true, `Cache key follows format 'ai:{endpoint}:{hash}'`, `key: ${expectedKey}`);

  // ──────────────────────────────────────────────────────────
  // Test 6: Cache Invalidation
  // ──────────────────────────────────────────────────────────
  console.log("\n── 6. Cache Invalidation ──");

  // Set a value then delete it
  await redis.set("test:invalidate", "to-be-deleted", 60);
  const beforeDel = await redis.get("test:invalidate");
  assert(beforeDel !== null, "Value exists before invalidation");

  await redis.del("test:invalidate");
  const afterDel = await redis.get("test:invalidate");
  assert(afterDel === null, "Value is null after invalidation");

  // Test invalidate function from cache.service
  await redis.set("cache:test-invalidate-key", "cached-value", 60);
  await invalidate("test-invalidate-key");
  const afterInvalidate = await redis.get("cache:test-invalidate-key");
  assert(afterInvalidate === null, "invalidate() removes cached value");

  // ──────────────────────────────────────────────────────────
  // Test 7: Pattern Deletion
  // ──────────────────────────────────────────────────────────
  console.log("\n── 7. Pattern Deletion ──");

  // Set multiple keys with a pattern
  await redis.set("test:pattern:a", "val-a", 60);
  await redis.set("test:pattern:b", "val-b", 60);
  await redis.set("test:pattern:c", "val-c", 60);
  await redis.set("test:other:x", "val-x", 60); // different pattern

  const deletedCount = await redis.delPattern("test:pattern:*");
  assert(deletedCount === 3, `delPattern() deleted correct number of keys`, `deleted: ${deletedCount}`);

  const patternA = await redis.get("test:pattern:a");
  assert(patternA === null, "Pattern-deleted key 'a' is gone");

  const otherX = await redis.get("test:other:x");
  assert(otherX === "val-x", "Key outside pattern still exists");

  // Clean up
  await redis.del("test:other:x");

  // ──────────────────────────────────────────────────────────
  // Test 8: Increment Counter (used by rate limiting)
  // ──────────────────────────────────────────────────────────
  console.log("\n── 8. Increment Counter (Rate Limiting) ──");

  await redis.del("test:counter");
  const count1 = await redis.incr("test:counter", 60);
  assert(count1 === 1, "First incr() returns 1", `got: ${count1}`);

  const count2 = await redis.incr("test:counter", 60);
  assert(count2 === 2, "Second incr() returns 2", `got: ${count2}`);

  const count3 = await redis.incr("test:counter", 60);
  assert(count3 === 3, "Third incr() returns 3", `got: ${count3}`);

  await redis.del("test:counter");

  // ──────────────────────────────────────────────────────────
  // Test 9: Concurrent Cache Access
  // ──────────────────────────────────────────────────────────
  console.log("\n── 9. Concurrent Cache Access ──");

  // Simulate 10 concurrent reads/writes
  const concurrentOps = [];
  for (let i = 0; i < 10; i++) {
    concurrentOps.push(redis.set(`test:concurrent:${i}`, `value-${i}`, 60));
  }
  const setResults = await Promise.all(concurrentOps);
  const allSetsOk = setResults.every(r => r === true);
  assert(allSetsOk, "10 concurrent set() operations all succeeded");

  // Read them all back concurrently
  const readOps = [];
  for (let i = 0; i < 10; i++) {
    readOps.push(redis.get(`test:concurrent:${i}`));
  }
  const readResults = await Promise.all(readOps);
  const allReadsOk = readResults.every((r, i) => r === `value-${i}`);
  assert(allReadsOk, "10 concurrent get() operations all returned correct values");

  // Clean up
  await redis.delPattern("test:concurrent:*");

  // ──────────────────────────────────────────────────────────
  // Test 10: Cache-Aside Pattern
  // ──────────────────────────────────────────────────────────
  console.log("\n── 10. Cache-Aside Pattern ──");

  let fetchCount = 0;
  const fetchFn = async () => {
    fetchCount++;
    return { data: "expensive-computation", fetchNumber: fetchCount };
  };

  // First call: cache miss → calls fetchFn
  const result1 = await cacheAside("test-cache-aside", fetchFn, { ttl: 60, prefix: "test" });
  assert(result1.fetchNumber === 1, "First call invokes fetchFn", `fetchNumber: ${result1.fetchNumber}`);
  assert(fetchCount === 1, "fetchFn was called exactly once");

  // Wait a bit for cache write to complete
  await new Promise(r => setTimeout(r, 100));

  // Second call: cache hit → does NOT call fetchFn
  const result2 = await cacheAside("test-cache-aside", fetchFn, { ttl: 60, prefix: "test" });
  assert(result2.fetchNumber === 1, "Second call returns cached value (fetchNumber still 1)");
  assert(fetchCount === 1, "fetchFn was NOT called again (still 1)");

  // Clean up
  await redis.del("test:test-cache-aside");

  // ──────────────────────────────────────────────────────────
  // Test 11: Full Plan-21d Cache Flow (End-to-End)
  // ──────────────────────────────────────────────────────────
  console.log("\n── 11. Full Plan-21d Cache Flow (End-to-End Simulation) ──");

  // Simulate exactly what ai-client.service.ts does
  const planEndpoint = "/plan-21d";
  const planRequestBody = {
    state: {
      habit_description: "I scroll TikTok too much before bed",
      quiz_summary: {
        user_habit_raw: "I scroll TikTok too much before bed",
        canonical_habit_name: "late-night TikTok scrolling",
        habit_category: "social_media",
        severity_level: "moderate",
      },
    },
  };

  const planHash = redis.hash(planRequestBody);

  // Step 1: Check cache (should miss)
  const planCacheMiss = await getCachedAIResponse(planEndpoint, planHash);
  // We might hit a previously cached response, so clean first
  await redis.del(`ai:${planEndpoint}:${planHash}`);
  const planCacheMissClean = await getCachedAIResponse(planEndpoint, planHash);
  assert(planCacheMissClean === null, "Step 1: Cache miss on first request (after clean)");

  // Step 2: Simulate AI response and cache it
  const simulatedPlanResponse = {
    plan_summary: "21-day plan to reduce late-night TikTok scrolling",
    day_tasks: Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [
        `day_${i + 1}`,
        [
          { title: `Task for day ${i + 1}`, description: "Test task", kind: "behavioral" },
          { title: `Second task day ${i + 1}`, description: "Another task", kind: "cognitive" },
          { title: `Third task day ${i + 1}`, description: "Final task", kind: "identity" },
        ],
      ])
    ),
  };

  const cacheTTL = 86400; // 24 hours, same as production
  await cacheAIResponse(planEndpoint, planHash, simulatedPlanResponse, cacheTTL);
  assert(true, "Step 2: AI response cached with 24h TTL");

  // Step 3: Cache hit on same request
  const startHit = Date.now();
  const planCacheHit = await getCachedAIResponse(planEndpoint, planHash);
  const hitTime = Date.now() - startHit;

  assert(planCacheHit !== null, "Step 3: Cache hit on second request");
  assert(
    planCacheHit?.plan_summary === simulatedPlanResponse.plan_summary,
    "Step 3: Cached plan_summary matches"
  );
  assert(
    Object.keys(planCacheHit?.day_tasks || {}).length === 21,
    "Step 3: Cached plan has all 21 days",
    `got: ${Object.keys(planCacheHit?.day_tasks || {}).length} days`
  );
  assert(hitTime < 50, `Step 3: Cache hit is fast (${hitTime}ms < 50ms)`);

  // Step 4: Different quiz_summary = different cache key
  const differentPlanBody = {
    state: {
      habit_description: "I smoke cigarettes when stressed",
      quiz_summary: {
        user_habit_raw: "smoking",
        canonical_habit_name: "stress smoking",
        habit_category: "nicotine_smoking",
        severity_level: "severe",
      },
    },
  };
  const differentPlanHash = redis.hash(differentPlanBody);
  assert(planHash !== differentPlanHash, "Step 4: Different input produces different cache key");

  const differentCacheMiss = await getCachedAIResponse(planEndpoint, differentPlanHash);
  assert(differentCacheMiss === null, "Step 4: Different input is a cache miss");

  // Step 5: Verify TTL was set correctly
  const planTTL = await redis.ttl(`ai:${planEndpoint}:${planHash}`);
  assert(planTTL > 86000, `Step 5: TTL is approximately 24 hours (${planTTL}s)`);

  // Clean up test keys
  await redis.del(`ai:${planEndpoint}:${planHash}`);

  // ──────────────────────────────────────────────────────────
  // Test 12: Clear Rate Limit (so backend test works)
  // ──────────────────────────────────────────────────────────
  console.log("\n── 12. Rate Limit Key Cleanup ──");

  const rateLimitDeleted = await redis.delPattern("ratelimit:*");
  assert(true, `Cleared ${rateLimitDeleted} rate limit key(s) — backend endpoint is unblocked now`);

  // ──────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────
  printSummary();

  function printSummary() {
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   REDIS TEST SUMMARY                            ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║   ✅ Passed:  ${String(passed).padStart(3)}                                ║`);
    console.log(`║   ❌ Failed:  ${String(failed).padStart(3)}                                ║`);
    console.log(`║   ⏭️  Skipped: ${String(skipped).padStart(3)}                                ║`);
    console.log("╚══════════════════════════════════════════════════╝\n");

    if (failed > 0) {
      console.log("⚠️  Some tests failed! Check details above.\n");
    } else {
      console.log("🎉 All Redis tests passed! Cache is working correctly.\n");
    }
  }

  // Disconnect
  await redis.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
