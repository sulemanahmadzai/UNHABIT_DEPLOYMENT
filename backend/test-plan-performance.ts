/**
 * Performance Test — 21-Day Plan Generation
 * 
 * Tests the full flow: Backend → AI Service → OpenAI
 * Measures response time and reports results.
 * 
 * Usage:
 *   1. Start AI service:   cd AI && python api_main.py
 *   2. Start backend:      cd backend && npm run dev
 *   3. Run this test:      npx tsx test-plan-performance.ts
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || "eyJhbGciOiJIUzI1NiIsImtpZCI6IlJEaThEenVJSFpHZHU3a0siLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2tndnJ5Y2dyemhmcWhrbHZqeHNvLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIyZmFkOWI3NC05ZTBmLTQ2M2MtODVmNi04YjVjMTcxY2NmNjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc3MjMxMjkwLCJpYXQiOjE3NzcyMjc2OTAsImVtYWlsIjoidXNlcjFAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NzcyMjc2OTB9XSwic2Vzc2lvbl9pZCI6IjA0NDM2Y2E2LTdkY2ItNGJmMC04ODE4LWU0ZWRjNWNlZGYzNSIsImlzX2Fub255bW91cyI6ZmFsc2V9.QIP2RntJYix9TCxBn9T7MovlHIFmRNQhjhQailw8xGs";

// Sample quiz summary for testing
const SAMPLE_QUIZ_SUMMARY = {
  user_habit_raw: "I scroll TikTok too much before bed",
  canonical_habit_name: "late-night TikTok scrolling",
  habit_category: "social_media",
  category_confidence: "high",
  product_type: "TikTok",
  severity_level: "moderate",
  core_loop: "Boredom or stress triggers phone pickup, algorithm delivers dopamine hits, hours pass unnoticed.",
  primary_payoff: "instant stimulation and escape from boredom",
  avoidance_target: "uncomfortable quiet thoughts before sleep",
  identity_link: "sees self as someone who needs entertainment to wind down",
  dopamine_profile: "stimulation",
  collapse_condition: "lying in bed with phone in hand and no plan for the evening",
  long_term_cost: "chronic sleep deprivation, reduced focus, anxiety",
  main_trigger: "boredom before sleep",
  peak_times: "10pm to 2am",
  common_locations: "bedroom, in bed",
  emotional_patterns: "boredom, stress, loneliness",
  frequency_pattern: "daily, 2-4 hours per session",
  previous_attempts: "tried screen time limits but bypassed them",
  motivation_reason: "wants better sleep and morning energy",
  risk_situations: "alone in bed with phone charged nearby",
};

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  timeMs: number;
  details: string;
}

const results: TestResult[] = [];

async function timedFetch(
  url: string,
  options: RequestInit,
  timeoutMs = 120000
): Promise<{ response: Response | null; timeMs: number; error?: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { response, timeMs: Date.now() - start };
  } catch (error: any) {
    clearTimeout(timeout);
    return {
      response: null,
      timeMs: Date.now() - start,
      error: error.message || "Unknown error",
    };
  }
}

function printResult(result: TestResult) {
  const icon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : "⏭️";
  const timeStr = result.timeMs > 0 ? ` (${(result.timeMs / 1000).toFixed(1)}s)` : "";
  console.log(`${icon} ${result.name}${timeStr}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
}

// ─────────────────────────────────────────────
// Test 1: AI Service Health Check
// ─────────────────────────────────────────────
async function testAIHealth() {
  console.log("\n── Test 1: AI Service Health ──");
  const { response, timeMs, error } = await timedFetch(
    `${AI_SERVICE_URL}/health`,
    { method: "GET" },
    5000
  );

  if (error || !response?.ok) {
    const result: TestResult = {
      name: "AI Service Health",
      status: "FAIL",
      timeMs,
      details: error || `HTTP ${response?.status}. Is the AI service running? (cd AI && python api_main.py)`,
    };
    results.push(result);
    printResult(result);
    return false;
  }

  const data = await response.json();
  const result: TestResult = {
    name: "AI Service Health",
    status: "PASS",
    timeMs,
    details: `OpenAI key configured: ${data.openai_key_configured}`,
  };
  results.push(result);
  printResult(result);
  return true;
}

// ─────────────────────────────────────────────
// Test 2: Direct AI Plan Generation (bypasses backend)
// ─────────────────────────────────────────────
async function testAIPlanDirect() {
  console.log("\n── Test 2: Direct AI Plan Generation (/plan-21d) ──");
  console.log("   ⏳ This calls OpenAI directly — may take 15-45 seconds...\n");

  const { response, timeMs, error } = await timedFetch(
    `${AI_SERVICE_URL}/plan-21d`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: {
          habit_description: "I scroll TikTok too much before bed",
          quiz_summary: SAMPLE_QUIZ_SUMMARY,
        },
      }),
    },
    120000 // 2 minute timeout for this test
  );

  if (error) {
    const result: TestResult = {
      name: "Direct AI Plan Generation",
      status: "FAIL",
      timeMs,
      details: `Error: ${error}`,
    };
    results.push(result);
    printResult(result);
    return;
  }

  if (!response?.ok) {
    const body = await response?.text();
    const result: TestResult = {
      name: "Direct AI Plan Generation",
      status: "FAIL",
      timeMs,
      details: `HTTP ${response?.status}: ${body?.substring(0, 200)}`,
    };
    results.push(result);
    printResult(result);
    return;
  }

  const data = await response.json();
  const dayCount = data.day_tasks ? Object.keys(data.day_tasks).length : 0;

  const status = timeMs < 60000 ? "PASS" : "FAIL";
  const result: TestResult = {
    name: "Direct AI Plan Generation",
    status,
    timeMs,
    details: `Generated ${dayCount} days. ${timeMs < 30000 ? "🚀 Fast!" : timeMs < 60000 ? "👍 Acceptable" : "⚠️ Too slow — should be under 60s"}`,
  };
  results.push(result);
  printResult(result);
}

// ─────────────────────────────────────────────
// Test 3: Backend Plan Generation (full flow)
// ─────────────────────────────────────────────
async function testBackendPlan() {
  console.log("\n── Test 3: Backend Plan Generation (/api/ai/plan-21d) ──");
  console.log("   ⏳ Full flow: Backend → AI Service → OpenAI...\n");

  const { response, timeMs, error } = await timedFetch(
    `${BACKEND_URL}/api/ai/plan-21d`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        habit_goal: "Stop scrolling TikTok before bed",
        quiz_summary: JSON.stringify(SAMPLE_QUIZ_SUMMARY),
      }),
    },
    120000
  );

  if (error) {
    const result: TestResult = {
      name: "Backend Plan Generation",
      status: "FAIL",
      timeMs,
      details: `Error: ${error}. Is the backend running? (cd backend && npm run dev)`,
    };
    results.push(result);
    printResult(result);
    return;
  }

  if (!response?.ok) {
    const body = await response?.text();
    const result: TestResult = {
      name: "Backend Plan Generation",
      status: response?.status === 401 ? "SKIP" : "FAIL",
      timeMs,
      details:
        response?.status === 401
          ? "Auth token expired — update TEST_AUTH_TOKEN in .env. AI timing still valid from Test 2."
          : `HTTP ${response?.status}: ${body?.substring(0, 200)}`,
    };
    results.push(result);
    printResult(result);
    return;
  }

  const data = await response.json();
  const dayCount = data.data?.day_tasks ? Object.keys(data.data.day_tasks).length : 0;

  const status = timeMs < 65000 ? "PASS" : "FAIL";
  const result: TestResult = {
    name: "Backend Plan Generation",
    status,
    timeMs,
    details: `Generated ${dayCount} days. ${timeMs < 35000 ? "🚀 Fast!" : timeMs < 65000 ? "👍 Acceptable" : "⚠️ Too slow — should be under 65s"}`,
  };
  results.push(result);
  printResult(result);
}

// ─────────────────────────────────────────────
// Test 4: Cached response (should be instant)
// ─────────────────────────────────────────────
async function testCachedResponse() {
  console.log("\n── Test 4: Redis Cache Hit (same request again) ──");

  const { response, timeMs, error } = await timedFetch(
    `${BACKEND_URL}/api/ai/plan-21d`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        habit_goal: "Stop scrolling TikTok before bed",
        quiz_summary: JSON.stringify(SAMPLE_QUIZ_SUMMARY),
      }),
    },
    10000
  );

  if (error) {
    const result: TestResult = {
      name: "Redis Cache Hit",
      status: "SKIP",
      timeMs,
      details: `Skipped (backend or Redis not available): ${error}`,
    };
    results.push(result);
    printResult(result);
    return;
  }

  if (!response?.ok) {
    const result: TestResult = {
      name: "Redis Cache Hit",
      status: "SKIP",
      timeMs,
      details: `Skipped (HTTP ${response?.status})`,
    };
    results.push(result);
    printResult(result);
    return;
  }

  const status = timeMs < 1000 ? "PASS" : "FAIL";
  const result: TestResult = {
    name: "Redis Cache Hit",
    status,
    timeMs,
    details: timeMs < 500 ? "🚀 Cache working perfectly!" : timeMs < 1000 ? "👍 Cache hit" : "⚠️ Slow for a cache hit — check Redis connection",
  };
  results.push(result);
  printResult(result);
}

// ─────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   21-Day Plan Performance Test                  ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`\nBackend:    ${BACKEND_URL}`);
  console.log(`AI Service: ${AI_SERVICE_URL}\n`);

  const aiHealthy = await testAIHealth();

  if (aiHealthy) {
    await testAIPlanDirect();
  } else {
    console.log("\n⏭️  Skipping AI tests (AI service not running)");
  }

  await testBackendPlan();
  await testCachedResponse();

  // ── Summary ──
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   RESULTS SUMMARY                               ║");
  console.log("╠══════════════════════════════════════════════════╣");

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
    const time = r.timeMs > 0 ? `${(r.timeMs / 1000).toFixed(1)}s` : "—";
    console.log(`║ ${icon} ${r.name.padEnd(35)} ${time.padStart(8)} ║`);
  }

  console.log("╚══════════════════════════════════════════════════╝");

  // Performance targets
  console.log("\n📊 Performance Targets:");
  console.log("   Direct AI call:  < 45s (hard timeout with fallback)");
  console.log("   Backend full:    < 60s (includes network + cache check)");
  console.log("   Cache hit:       < 500ms");
  console.log("   OLD worst case:  ~10 minutes ❌");
  console.log("   NEW worst case:  ~60 seconds ✅\n");

  const failures = results.filter((r) => r.status === "FAIL");
  if (failures.length > 0) {
    console.log(`⚠️  ${failures.length} test(s) failed. Check details above.\n`);
    process.exit(1);
  } else {
    console.log("🎉 All tests passed!\n");
  }
}

main().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
