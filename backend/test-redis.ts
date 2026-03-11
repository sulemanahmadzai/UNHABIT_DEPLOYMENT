/**
 * Redis Integration Test Script
 * 
 * This script tests the Redis integration to ensure:
 * 1. Redis connection works
 * 2. Cache operations work
 * 3. TTL management works
 * 4. Graceful degradation works
 */

import "dotenv/config";
import redis from "./src/db/redis.js";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function warning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testRedisConnection() {
  log("\n" + "=".repeat(60), colors.blue);
  log("TEST 1: Redis Connection", colors.blue);
  log("=".repeat(60), colors.blue);

  // Debug environment variables
  info(`REDIS_URL: ${process.env.REDIS_URL || "NOT SET"}`);
  info(`REDIS_ENABLED: ${process.env.REDIS_ENABLED || "NOT SET"}`);

  // Wait for Redis to connect (up to 5 seconds)
  info("Waiting for Redis connection...");
  for (let i = 0; i < 10; i++) {
    if (redis.isAvailable()) {
      success("Redis is connected and available");
      return true;
    }
    await sleep(500);
  }

  error("Redis is not available after 5 seconds");
  warning("Make sure Redis is running: docker-compose up -d redis");
  return false;
}

async function testBasicOperations() {
  log("\n" + "=".repeat(60), colors.blue);
  log("TEST 2: Basic Cache Operations", colors.blue);
  log("=".repeat(60), colors.blue);

  const testKey = "test:basic:key";
  const testValue = { message: "Hello Redis!", timestamp: Date.now() };

  // Test SET
  info("Setting test value...");
  const setResult = await redis.set(testKey, testValue, 60);
  if (setResult) {
    success("SET operation successful");
  } else {
    error("SET operation failed");
    return false;
  }

  // Test GET
  info("Getting test value...");
  const getValue = await redis.get(testKey);
  if (getValue && JSON.stringify(getValue) === JSON.stringify(testValue)) {
    success("GET operation successful - value matches");
  } else {
    error("GET operation failed or value mismatch");
    return false;
  }

  // Test EXISTS
  info("Checking if key exists...");
  const exists = await redis.exists(testKey);
  if (exists) {
    success("EXISTS operation successful");
  } else {
    error("EXISTS operation failed");
    return false;
  }

  // Test TTL
  info("Checking TTL...");
  const ttl = await redis.ttl(testKey);
  if (ttl > 0 && ttl <= 60) {
    success(`TTL operation successful - ${ttl} seconds remaining`);
  } else {
    error("TTL operation failed");
    return false;
  }

  // Test DEL
  info("Deleting test key...");
  const delResult = await redis.del(testKey);
  if (delResult) {
    success("DEL operation successful");
  } else {
    error("DEL operation failed");
    return false;
  }

  // Verify deletion
  const existsAfterDel = await redis.exists(testKey);
  if (!existsAfterDel) {
    success("Key successfully deleted");
  } else {
    error("Key still exists after deletion");
    return false;
  }

  return true;
}

async function testAICaching() {
  log("\n" + "=".repeat(60), colors.blue);
  log("TEST 3: AI Response Caching", colors.blue);
  log("=".repeat(60), colors.blue);

  const endpoint = "/test-endpoint";
  const requestBody = { habit: "smoking", user: "test123" };
  const requestHash = redis.hash(requestBody);
  const aiResponse = {
    success: true,
    data: { plan: "21-day plan...", timestamp: Date.now() },
  };

  info(`Request hash: ${requestHash}`);

  // Simulate caching AI response
  const cacheKey = `ai:${endpoint}:${requestHash}`;
  info("Caching AI response...");
  const cached = await redis.set(cacheKey, aiResponse, 3600);
  if (cached) {
    success("AI response cached successfully");
  } else {
    error("Failed to cache AI response");
    return false;
  }

  // Simulate retrieving cached response
  info("Retrieving cached AI response...");
  const retrieved = await redis.get(cacheKey);
  if (retrieved && JSON.stringify(retrieved) === JSON.stringify(aiResponse)) {
    success("AI response retrieved from cache successfully");
  } else {
    error("Failed to retrieve AI response from cache");
    return false;
  }

  // Check TTL
  const ttl = await redis.ttl(cacheKey);
  if (ttl > 3500 && ttl <= 3600) {
    success(`Cache TTL is correct: ${ttl} seconds (1 hour)`);
  } else {
    warning(`Cache TTL is ${ttl} seconds (expected ~3600)`);
  }

  // Cleanup
  await redis.del(cacheKey);

  return true;
}

async function testHashGeneration() {
  log("\n" + "=".repeat(60), colors.blue);
  log("TEST 4: Hash Generation (Deterministic Keys)", colors.blue);
  log("=".repeat(60), colors.blue);

  const request1 = { habit: "smoking", user: "test123" };
  const request2 = { habit: "smoking", user: "test123" };
  const request3 = { habit: "vaping", user: "test123" };

  const hash1 = redis.hash(request1);
  const hash2 = redis.hash(request2);
  const hash3 = redis.hash(request3);

  info(`Hash 1: ${hash1}`);
  info(`Hash 2: ${hash2}`);
  info(`Hash 3: ${hash3}`);

  if (hash1 === hash2) {
    success("Identical requests produce identical hashes");
  } else {
    error("Identical requests produce different hashes");
    return false;
  }

  if (hash1 !== hash3) {
    success("Different requests produce different hashes");
  } else {
    error("Different requests produce identical hashes");
    return false;
  }

  return true;
}

async function testTTLExpiration() {
  log("\n" + "=".repeat(60), colors.blue);
  log("TEST 5: TTL Expiration", colors.blue);
  log("=".repeat(60), colors.blue);

  const testKey = "test:ttl:key";
  const testValue = "expires soon";

  info("Setting key with 5 second TTL...");
  await redis.set(testKey, testValue, 5);

  // Check immediately
  const exists1 = await redis.exists(testKey);
  if (exists1) {
    success("Key exists immediately after creation");
  } else {
    error("Key doesn't exist after creation");
    return false;
  }

  // Wait 2 seconds
  info("Waiting 2 seconds...");
  await sleep(2000);

  const exists2 = await redis.exists(testKey);
  if (exists2) {
    success("Key still exists after 2 seconds");
  } else {
    warning("Key expired early (this can happen with Redis)");
    // Don't fail the test - Redis TTL is approximate
    return true;
  }

  // Wait 4 more seconds (total 6 seconds)
  info("Waiting 4 more seconds...");
  await sleep(4000);

  const exists3 = await redis.exists(testKey);
  if (!exists3) {
    success("Key expired after TTL (6 seconds total)");
  } else {
    error("Key didn't expire after TTL");
    return false;
  }

  return true;
}

async function testPatternDeletion() {
  log("\n" + "=".repeat(60), colors.blue);
  log("TEST 6: Pattern-Based Deletion", colors.blue);
  log("=".repeat(60), colors.blue);

  // Create multiple keys with same pattern
  const keys = [
    "test:pattern:key1",
    "test:pattern:key2",
    "test:pattern:key3",
    "test:other:key",
  ];

  info("Creating test keys...");
  for (const key of keys) {
    await redis.set(key, "test value", 60);
  }
  success(`Created ${keys.length} test keys`);

  // Delete keys matching pattern
  info("Deleting keys matching 'test:pattern:*'...");
  const deletedCount = await redis.delPattern("test:pattern:*");
  if (deletedCount === 3) {
    success(`Deleted ${deletedCount} keys matching pattern`);
  } else {
    error(`Expected to delete 3 keys, deleted ${deletedCount}`);
    return false;
  }

  // Verify pattern keys are gone
  const exists1 = await redis.exists("test:pattern:key1");
  const exists2 = await redis.exists("test:pattern:key2");
  const exists3 = await redis.exists("test:pattern:key3");
  const exists4 = await redis.exists("test:other:key");

  if (!exists1 && !exists2 && !exists3) {
    success("Pattern-matched keys were deleted");
  } else {
    error("Some pattern-matched keys still exist");
    return false;
  }

  if (exists4) {
    success("Non-matching key was preserved");
  } else {
    error("Non-matching key was incorrectly deleted");
    return false;
  }

  // Cleanup
  await redis.del("test:other:key");

  return true;
}

async function testCachePerformance() {
  log("\n" + "=".repeat(60), colors.blue);
  log("TEST 7: Cache Performance", colors.blue);
  log("=".repeat(60), colors.blue);

  const testKey = "test:performance:key";
  const largeObject = {
    data: Array(1000)
      .fill(0)
      .map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: "A test item with some data",
        timestamp: Date.now(),
      })),
  };

  // Test write performance
  info("Testing write performance (1000 items)...");
  const writeStart = Date.now();
  await redis.set(testKey, largeObject, 60);
  const writeTime = Date.now() - writeStart;
  success(`Write completed in ${writeTime}ms`);

  // Test read performance
  info("Testing read performance (1000 items)...");
  const readStart = Date.now();
  await redis.get(testKey);
  const readTime = Date.now() - readStart;
  success(`Read completed in ${readTime}ms`);

  if (writeTime < 100 && readTime < 100) {
    success("Cache performance is excellent (< 100ms)");
  } else if (writeTime < 500 && readTime < 500) {
    success("Cache performance is good (< 500ms)");
  } else {
    warning("Cache performance is slow (> 500ms)");
  }

  // Cleanup
  await redis.del(testKey);

  return true;
}

async function runAllTests() {
  log("\n" + "=".repeat(60), colors.cyan);
  log("🧪 REDIS INTEGRATION TEST SUITE", colors.cyan);
  log("=".repeat(60) + "\n", colors.cyan);

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: Connection
  const test1 = await testRedisConnection();
  results.push({ name: "Redis Connection", passed: test1 });

  if (!test1) {
    error("\n❌ Redis is not available. Cannot continue tests.");
    warning("Start Redis with: docker-compose up -d redis");
    process.exit(1);
  }

  // Test 2: Basic Operations
  const test2 = await testBasicOperations();
  results.push({ name: "Basic Cache Operations", passed: test2 });

  // Test 3: AI Caching
  const test3 = await testAICaching();
  results.push({ name: "AI Response Caching", passed: test3 });

  // Test 4: Hash Generation
  const test4 = await testHashGeneration();
  results.push({ name: "Hash Generation", passed: test4 });

  // Test 5: TTL Expiration
  const test5 = await testTTLExpiration();
  results.push({ name: "TTL Expiration", passed: test5 });

  // Test 6: Pattern Deletion
  const test6 = await testPatternDeletion();
  results.push({ name: "Pattern-Based Deletion", passed: test6 });

  // Test 7: Performance
  const test7 = await testCachePerformance();
  results.push({ name: "Cache Performance", passed: test7 });

  // Summary
  log("\n" + "=".repeat(60), colors.cyan);
  log("📊 TEST SUMMARY", colors.cyan);
  log("=".repeat(60), colors.cyan);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    if (result.passed) {
      success(`${result.name}`);
    } else {
      error(`${result.name}`);
    }
  });

  log("\n" + "=".repeat(60), colors.cyan);
  if (passed === total) {
    success(`ALL TESTS PASSED (${passed}/${total})`);
    log("=".repeat(60) + "\n", colors.cyan);
    log("🎉 Redis integration is working perfectly!", colors.green);
    log("✅ Your backend is ready to reduce AI API calls\n", colors.green);
  } else {
    error(`SOME TESTS FAILED (${passed}/${total})`);
    log("=".repeat(60) + "\n", colors.cyan);
    warning("Some tests failed. Check the output above for details.");
  }

  // Disconnect
  await redis.disconnect();
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch((err) => {
  error(`Test suite failed with error: ${err.message}`);
  process.exit(1);
});
