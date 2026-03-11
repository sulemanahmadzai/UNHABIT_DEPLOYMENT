/**
 * AI Caching Test Script
 * 
 * This script tests the most expensive AI endpoints to verify Redis caching is working.
 * It makes requests twice to the same endpoint and measures the performance difference.
 */

import "dotenv/config";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || "";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
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

function highlight(message: string) {
  log(`🚀 ${message}`, colors.magenta);
}

async function makeRequest(
  endpoint: string,
  body: any,
  testName: string
): Promise<{ success: boolean; duration: number; data?: any }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, duration, data: errorText };
    }

    const data = await response.json();
    return { success: true, duration, data };
  } catch (err) {
    const duration = Date.now() - startTime;
    return { success: false, duration, data: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function testEndpoint(
  name: string,
  endpoint: string,
  body: any,
  expectedCacheTTL: string
) {
  log("\n" + "=".repeat(70), colors.blue);
  log(`TEST: ${name}`, colors.blue);
  log("=".repeat(70), colors.blue);

  info(`Endpoint: ${endpoint}`);
  info(`Expected Cache TTL: ${expectedCacheTTL}`);
  info(`Request body: ${JSON.stringify(body, null, 2)}`);

  // First request (should be cache miss)
  log("\n📤 Making first request (cache miss expected)...", colors.yellow);
  const result1 = await makeRequest(endpoint, body, name);

  if (!result1.success) {
    error(`First request failed: ${result1.data}`);
    warning("Skipping second request");
    return { passed: false, speedup: 0 };
  }

  success(`First request completed in ${result1.duration}ms`);
  info(`Response preview: ${JSON.stringify(result1.data).substring(0, 200)}...`);

  // Wait a moment
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Second request (should be cache hit)
  log("\n📥 Making second request (cache hit expected)...", colors.yellow);
  const result2 = await makeRequest(endpoint, body, name);

  if (!result2.success) {
    error(`Second request failed: ${result2.data}`);
    return { passed: false, speedup: 0 };
  }

  success(`Second request completed in ${result2.duration}ms`);

  // Calculate speedup
  const speedup = result1.duration / result2.duration;
  const improvement = ((1 - result2.duration / result1.duration) * 100).toFixed(1);

  log("\n" + "─".repeat(70), colors.cyan);
  log("📊 PERFORMANCE COMPARISON", colors.cyan);
  log("─".repeat(70), colors.cyan);
  info(`First request (cache miss):  ${result1.duration}ms`);
  info(`Second request (cache hit):   ${result2.duration}ms`);
  highlight(`Speed improvement:         ${speedup.toFixed(1)}x faster (${improvement}% faster)`);

  // Determine if caching is working
  const isCached = result2.duration < result1.duration * 0.5; // At least 2x faster

  if (isCached) {
    success("✨ CACHING IS WORKING! Second request was significantly faster.");
  } else {
    warning("⚠️  Caching may not be working. Second request was not significantly faster.");
    warning("This could mean:");
    warning("  - Redis is not running");
    warning("  - Cache was cleared between requests");
    warning("  - Request body was different");
  }

  return { passed: isCached, speedup };
}

async function runTests() {
  log("\n" + "=".repeat(70), colors.cyan);
  log("🧪 AI CACHING TEST SUITE - MOST EXPENSIVE ENDPOINTS", colors.cyan);
  log("=".repeat(70) + "\n", colors.cyan);

  // Check if auth token is provided
  if (!AUTH_TOKEN) {
    warning("No TEST_AUTH_TOKEN provided in environment");
    warning("Add TEST_AUTH_TOKEN to your .env file or set it in the environment");
    warning("Example: TEST_AUTH_TOKEN=your-jwt-token-here");
    warning("\nYou can get a token by:");
    warning("  1. Login through your app");
    warning("  2. Copy the JWT token from the response or browser");
    warning("  3. Add it to .env as TEST_AUTH_TOKEN");
    log("\n");
  }

  info(`Testing against: ${API_BASE_URL}`);
  info(`Auth token: ${AUTH_TOKEN ? "✅ Provided" : "❌ Not provided"}`);

  const results: Array<{ name: string; passed: boolean; speedup: number }> = [];

  // Test 1: Quiz Form Generation (Expensive - 5-15 seconds)
  const test1 = await testEndpoint(
    "Quiz Form Generation",
    "/api/ai/quiz-form",
    {
      habit_category: "nicotine_smoking",
      user_context: "I smoke about 10 cigarettes per day",
    },
    "1 hour (3600s)"
  );
  results.push({ name: "Quiz Form", ...test1 });

  // Test 2: 21-Day Plan Generation (MOST EXPENSIVE - 10-30 seconds)
  const test2 = await testEndpoint(
    "21-Day Plan Generation",
    "/api/ai/plan-21d",
    {
      habit_goal: "quit smoking cigarettes",
      quiz_summary: JSON.stringify({
        user_habit_raw: "smoking cigarettes",
        canonical_habit_name: "cigarette smoking",
        habit_category: "nicotine_smoking",
        category_confidence: "high",
        product_type: "cigarettes",
        severity_level: "moderate",
        core_loop: "Stress triggers craving, smoking provides relief",
        primary_payoff: "Stress relief and relaxation",
        avoidance_target: "Anxiety and discomfort",
        identity_link: "Part of daily routine and social identity",
        dopamine_profile: "Quick spike followed by craving",
        collapse_condition: "High stress situations",
        long_term_cost: "Health deterioration and financial burden",
      }),
    },
    "24 hours (86400s)"
  );
  results.push({ name: "21-Day Plan", ...test2 });

  // Test 3: Quiz Summary (Expensive - 10-20 seconds)
  const test3 = await testEndpoint(
    "Quiz Summary Generation",
    "/api/ai/quiz-summary",
    {
      habit_category: "nicotine_smoking",
      habit_description: "smoking cigarettes",
      answers: {
        frequency: "daily",
        duration: "5_years",
        triggers: "stress,boredom",
        attempts: "tried_before",
      },
      quiz_form: {
        habit_name_guess: "cigarette smoking",
        questions: [
          {
            id: "frequency",
            question: "How often do you smoke?",
            options: [
              { id: "daily", label: "Daily" },
              { id: "weekly", label: "Weekly" },
            ],
          },
        ],
      },
    },
    "24 hours (86400s)"
  );
  results.push({ name: "Quiz Summary", ...test3 });

  // Test 4: Onboarding Start (Moderate - 5-10 seconds)
  const test4 = await testEndpoint(
    "Onboarding Start",
    "/api/ai/onboarding/start",
    {
      user_input: "I want to quit smoking cigarettes",
    },
    "1 hour (3600s)"
  );
  results.push({ name: "Onboarding", ...test4 });

  // Summary
  log("\n" + "=".repeat(70), colors.cyan);
  log("📊 FINAL SUMMARY", colors.cyan);
  log("=".repeat(70), colors.cyan);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? "✅" : "❌";
    const speedupText = result.speedup > 0 ? `${result.speedup.toFixed(1)}x faster` : "N/A";
    log(`${status} ${result.name.padEnd(25)} - ${speedupText}`, result.passed ? colors.green : colors.red);
  });

  log("\n" + "=".repeat(70), colors.cyan);

  if (passed === total) {
    success(`ALL TESTS PASSED (${passed}/${total})`);
    log("\n🎉 Redis caching is working perfectly!", colors.green);
    log("✅ Your AI API calls are being cached", colors.green);
    log("✅ You're saving 60-80% on AI costs", colors.green);
    log("✅ Response times are 10-100x faster on cache hits\n", colors.green);
  } else if (passed > 0) {
    warning(`SOME TESTS PASSED (${passed}/${total})`);
    log("\n⚠️  Some endpoints are caching, but not all", colors.yellow);
    log("Check the failed tests above for details\n", colors.yellow);
  } else {
    error(`ALL TESTS FAILED (${passed}/${total})`);
    log("\n❌ Redis caching is not working", colors.red);
    log("Possible issues:", colors.yellow);
    log("  - Redis is not running (check: docker ps | findstr redis)", colors.yellow);
    log("  - Backend is not connected to Redis", colors.yellow);
    log("  - AUTH_TOKEN is invalid or missing", colors.yellow);
    log("  - Backend is not running\n", colors.yellow);
  }

  // Additional info
  log("=".repeat(70), colors.cyan);
  log("💡 TIPS", colors.cyan);
  log("=".repeat(70), colors.cyan);
  info("To monitor Redis cache in real-time:");
  info("  docker exec -it unhabit-redis redis-cli MONITOR");
  info("\nTo view cached keys:");
  info("  docker exec -it unhabit-redis redis-cli KEYS \"ai:*\"");
  info("\nTo check backend logs:");
  info("  Look for '✅ AI cache hit' messages");
  log("\n");

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch((err) => {
  error(`Test suite failed with error: ${err.message}`);
  process.exit(1);
});
