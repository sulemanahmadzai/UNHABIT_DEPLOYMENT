/**
 * 21-Day Plan Endpoint Performance Test
 *
 * Measures the response time of `/api/ai/plan-21d` end-to-end so we can
 * confirm whether the slowness is in (a) the backend, (b) the AI service,
 * or (c) Redis caching not actually being used.
 *
 * What this test does:
 *   1. Logs in to get a fresh JWT (test users in tests/run-all-tests.ts)
 *      - Falls back to TEST_AUTH_TOKEN if login fails
 *   2. Verifies AI + backend health
 *   3. Wipes the Redis ai:/plan-21d:* cache so we get a true cache MISS
 *   4. Times: AI service direct, backend cache miss, backend cache hit,
 *      backend with whitespace-changed payload (tests hash stability),
 *      concurrent requests
 *   5. Prints a summary table with PASS/FAIL against target SLAs
 *
 * Run:  cd backend && npx tsx test-plan21d-perf.ts
 */

import "dotenv/config";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const FALLBACK_TOKEN = process.env.TEST_AUTH_TOKEN || "";

// SLA targets (ms)
const SLA = {
  AI_DIRECT_MAX_MS: 25_000,    // AI service hard timeout is now 20s
  BACKEND_MISS_MAX_MS: 10_000, // User-facing: must answer in <10s even on cold cache
  BACKEND_HIT_MAX_MS: 500,     // Cache hit must be near-instant
  STABLE_HASH_MAX_MS: 500,     // Whitespace-changed payload must still hit cache
};

const SAMPLE_QUIZ_SUMMARY = {
  user_habit_raw: "I scroll TikTok too much before bed",
  canonical_habit_name: "late-night TikTok scrolling",
  habit_category: "social_media",
  category_confidence: "high",
  product_type: "TikTok",
  severity_level: "moderate",
  core_loop:
    "Boredom or stress triggers phone pickup, algorithm delivers dopamine hits, hours pass unnoticed.",
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

const INPUT_SCENARIOS = [
  {
    id: "S1",
    name: "Short habit goal",
    habit_goal: "Stop scrolling TikTok before bed",
    quiz_summary: SAMPLE_QUIZ_SUMMARY,
  },
  {
    id: "S2",
    name: "Medium context",
    habit_goal:
      "I want to stop late-night TikTok scrolling so I can sleep by 11pm, wake up focused, and stop feeling guilty about wasting nights.",
    quiz_summary: {
      ...SAMPLE_QUIZ_SUMMARY,
      motivation_reason:
        "I want to stop feeling exhausted and build a strict nighttime routine for better mornings and better work output.",
      previous_attempts:
        "I tried app blockers, grayscale mode, and deleting apps, but I always reinstall during stressful weeks.",
    },
  },
  {
    id: "S3",
    name: "Long context",
    habit_goal:
      "I need a strict 21-day plan to break doom-scrolling at night because it destroys my sleep, impacts my focus at work, and keeps me emotionally numb. I want concrete tasks that are realistic, progressive, and hard to bypass.",
    quiz_summary: {
      ...SAMPLE_QUIZ_SUMMARY,
      emotional_patterns:
        "boredom, stress, loneliness, post-work mental fatigue, avoidance of unfinished tasks",
      frequency_pattern:
        "daily, usually 2-4 hours, with occasional 5-hour binge nights when stressed",
      risk_situations:
        "alone in bed after 10pm, after emotionally draining workdays, weekends with no morning commitments",
    },
  },
  {
    id: "S4",
    name: "Very long context",
    habit_goal:
      "I want to eliminate late-night scrolling and fully rewire my evenings. I get into bed planning to sleep, pick up my phone for 5 minutes, and then lose 2-4 hours. This damages my energy, concentration, confidence, and consistency. I need a robust day-by-day plan that handles triggers like stress, loneliness, and avoidance while creating stronger identity-based routines that I can sustain after day 21.",
    quiz_summary: {
      ...SAMPLE_QUIZ_SUMMARY,
      core_loop:
        "After dinner I feel mentally drained, seek effortless stimulation, start with short videos, and then compulsively keep swiping to avoid silence and unfinished thoughts.",
      identity_link:
        "I have started believing I am someone who cannot rest without digital stimulation and cannot regulate evenings with discipline.",
      long_term_cost:
        "sleep debt, reduced cognitive performance, lower emotional stability, weaker self-trust, and inconsistent productivity",
      motivation_reason:
        "I need predictable energy, deeper sleep, and stronger personal discipline so I can perform better and feel in control.",
      risk_situations:
        "late nights in bed, unstructured weekends, emotionally heavy days, and moments when tasks feel overwhelming",
    },
  },
] as const;

interface Result {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  ms: number;
  detail: string;
  bytes?: number;
}
const results: Result[] = [];

function record(r: Result) {
  results.push(r);
  const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
  const time = r.ms > 0 ? `${(r.ms / 1000).toFixed(2)}s` : "—";
  console.log(`${icon} ${r.name.padEnd(45)} ${time.padStart(10)}  ${r.detail}`);
}

async function timed<T>(
  fn: () => Promise<T>
): Promise<{ result: T | null; ms: number; error?: string }> {
  const start = Date.now();
  try {
    const result = await fn();
    return { result, ms: Date.now() - start };
  } catch (err: any) {
    return { result: null, ms: Date.now() - start, error: err?.message || String(err) };
  }
}

function controllerWithTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(id) };
}

// ─────────────────────────────────────────────
// Auth helper — register a known test user (idempotent), then log in.
// Falls back to TEST_AUTH_TOKEN from env if both fail.
// ─────────────────────────────────────────────
const PERF_TEST_EMAIL = process.env.PERF_TEST_EMAIL || "perftest-plan21@unhabit.test";
const PERF_TEST_PASSWORD = process.env.PERF_TEST_PASSWORD || "PerfTest123!@#";

const LOGIN_CANDIDATES: Array<{ email: string; password: string; label: string }> = [
  { email: PERF_TEST_EMAIL, password: PERF_TEST_PASSWORD, label: "perf test user" },
  { email: "testuser1@unhabit.test", password: "TestUser123!@#", label: "default test user" },
  { email: "user1@gmail.com", password: "Unhabit@100", label: "user1" },
];

async function loginForToken(
  email: string,
  password: string
): Promise<{ token: string | null; message: string }> {
  try {
    const t = controllerWithTimeout(10_000);
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: t.signal,
    });
    t.cancel();
    if (!res.ok) {
      return { token: null, message: `${email} login failed (${res.status})` };
    }
    const body = (await res.json()) as any;
    const token =
      body.access_token ||
      body.session?.access_token ||
      body.data?.access_token ||
      body.data?.session?.access_token;
    if (typeof token === "string" && token.length > 50) {
      return { token, message: `${email} login success` };
    }
    return { token: null, message: `${email} login returned no token` };
  } catch (e: any) {
    return { token: null, message: `${email} login error: ${e?.message || "unknown"}` };
  }
}

async function getFreshToken(): Promise<string | null> {
  // Step 1: try to register the perf user. Backend uses admin.createUser with
  // email_confirm:true, so register will return 201 once and 4xx ("already
  // registered") afterwards. Either outcome is fine.
  try {
    const t = controllerWithTimeout(10_000);
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: PERF_TEST_EMAIL,
        password: PERF_TEST_PASSWORD,
        full_name: "Plan-21d Perf Test",
      }),
      signal: t.signal,
    });
    t.cancel();
    if (res.ok) {
      console.log(`👤 Registered perf test user ${PERF_TEST_EMAIL}`);
    } else if (res.status === 400 || res.status === 422 || res.status === 409) {
      // Already exists — totally fine
    } else {
      const body = await res.text();
      console.log(`ℹ️  Register returned ${res.status}: ${body.slice(0, 120)}`);
    }
  } catch (e: any) {
    console.log(`ℹ️  Register call failed (non-fatal): ${e?.message}`);
  }

  // Step 2: try multiple credentials in order, including the perf user we
  // just (re)registered.
  for (const c of LOGIN_CANDIDATES) {
    const { token } = await loginForToken(c.email, c.password);
    if (token) {
      console.log(`🔑 Logged in as ${c.email} (${c.label})`);
      return token;
    }
  }

  if (FALLBACK_TOKEN) {
    console.log("🔑 Falling back to TEST_AUTH_TOKEN from env (may be expired)");
    return FALLBACK_TOKEN;
  }
  return null;
}

// ─────────────────────────────────────────────
// Wipe the plan-21d cache + the perf user's rate-limit state so the next
// request is a true MISS and isn't blocked by leftover counters.
// ─────────────────────────────────────────────
async function wipePlanCache(): Promise<{ cache: number; rateLimit: number }> {
  try {
    const redisModule = await import("./src/db/redis.js");
    const redis = redisModule.default;
    // Give ioredis a moment to connect
    await new Promise((r) => setTimeout(r, 500));
    if (!redis.isAvailable()) {
      console.log("⚠️  Redis not available — cannot wipe cache");
      return { cache: 0, rateLimit: 0 };
    }
    const cache = await redis.delPattern("ai:/plan-21d:*");
    // Rate-limit keys use req.path from the mounted ai router ("/plan-21d"),
    // not the full URL path ("/api/ai/plan-21d").
    const rateLimit = await redis.delPattern("ratelimit:user:*:/plan-21d*");
    const rateLimitBlock = await redis.delPattern("ratelimit:block:user:*:/plan-21d*");
    console.log(
      `🧹 Cleared ${cache} cached plan-21d entr${cache === 1 ? "y" : "ies"}, ` +
        `${rateLimit} rate-limit counter${rateLimit === 1 ? "" : "s"}, ` +
        `${rateLimitBlock} rate-limit block key${rateLimitBlock === 1 ? "" : "s"}`
    );
    return { cache, rateLimit };
  } catch (e: any) {
    console.log(`⚠️  Cache wipe failed: ${e.message}`);
    return { cache: 0, rateLimit: 0 };
  }
}

// ─────────────────────────────────────────────
// Test 1 — Health checks
// ─────────────────────────────────────────────
async function testHealth() {
  console.log("\n── 1. Health checks ──");

  const ai = await timed(async () => {
    const t = controllerWithTimeout(5_000);
    const res = await fetch(`${AI_SERVICE_URL}/health`, { signal: t.signal });
    t.cancel();
    return res;
  });
  record({
    name: "AI service /health",
    status: ai.result && (ai.result as Response).ok ? "PASS" : "FAIL",
    ms: ai.ms,
    detail: ai.error || `HTTP ${(ai.result as Response | null)?.status ?? "—"}`,
  });

  const backend = await timed(async () => {
    const t = controllerWithTimeout(5_000);
    const res = await fetch(`${BACKEND_URL}/api/ai/health`, { signal: t.signal });
    t.cancel();
    return res;
  });
  record({
    name: "Backend /api/ai/health",
    status: backend.result && (backend.result as Response).ok ? "PASS" : "FAIL",
    ms: backend.ms,
    detail: backend.error || `HTTP ${(backend.result as Response | null)?.status ?? "—"}`,
  });
}

// ─────────────────────────────────────────────
// Test 2 — AI service /plan-21d direct (NO Redis, NO backend)
// ⚠️  This calls the AI service raw — NO stale-while-revalidate, NO cache.
// This is NOT what the frontend ever hits. It benchmarks pure LLM latency.
// The user-facing endpoint is Test 3 (backend) which always answers <10s.
// ─────────────────────────────────────────────
async function testAIDirect() {
  console.log("\n── 2. AI service INTERNAL benchmark — raw LLM (NOT user-facing) ──");
  console.log("   ℹ️  The frontend NEVER calls this directly.");
  console.log("   ℹ️  User-facing latency is measured in Test 3.\n");

  const t = controllerWithTimeout(120_000);
  const { result, ms, error } = await timed(async () => {
    const res = await fetch(`${AI_SERVICE_URL}/plan-21d`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: {
          habit_description: "I scroll TikTok too much before bed",
          quiz_summary: SAMPLE_QUIZ_SUMMARY,
        },
      }),
      signal: t.signal,
    });
    return res;
  });
  t.cancel();

  if (error || !result || !(result as Response).ok) {
    record({
      name: "AI direct /plan-21d (cold)",
      status: "FAIL",
      ms,
      detail: error || `HTTP ${(result as Response | null)?.status ?? "—"}`,
    });
    return;
  }

  const body = await (result as Response).json();
  const days = body?.day_tasks ? Object.keys(body.day_tasks).length : 0;
  const bytes = JSON.stringify(body).length;
  record({
    name: "AI raw LLM /plan-21d [NOT user-facing]",
    status: ms <= SLA.AI_DIRECT_MAX_MS ? "PASS" : "FAIL",
    ms,
    bytes,
    detail: `${days} days, ${(bytes / 1024).toFixed(1)} KB — pure LLM cost, never seen by users`,
  });
}

// ─────────────────────────────────────────────
// Test 3 — Backend cache MISS (after wiping cache)
// ─────────────────────────────────────────────
async function testBackendMiss(token: string) {
  console.log("\n── 3. Backend /api/ai/plan-21d — cache MISS ──");
  await wipePlanCache();

  const t = controllerWithTimeout(120_000);
  const { result, ms, error } = await timed(async () => {
    const res = await fetch(`${BACKEND_URL}/api/ai/plan-21d`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        habit_goal: "Stop scrolling TikTok before bed",
        quiz_summary: JSON.stringify(SAMPLE_QUIZ_SUMMARY),
      }),
      signal: t.signal,
    });
    return res;
  });
  t.cancel();

  if (error) {
    record({ name: "Backend cache MISS", status: "FAIL", ms, detail: `Error: ${error}` });
    return;
  }
  const res = result as Response;
  if (!res.ok) {
    const text = await res.text();
    record({
      name: "Backend cache MISS",
      status: res.status === 401 ? "SKIP" : "FAIL",
      ms,
      detail:
        res.status === 401
          ? "Auth token invalid/expired"
          : `HTTP ${res.status}: ${text.slice(0, 120)}`,
    });
    return;
  }
  const body = (await res.json()) as any;
  const days = body?.data?.day_tasks ? Object.keys(body.data.day_tasks).length : 0;
  record({
    name: "Backend /api/ai/plan-21d — cold cache [USER-FACING]",
    status: ms <= SLA.BACKEND_MISS_MAX_MS ? "PASS" : "FAIL",
    ms,
    detail: `${days} days. ✅ USER sees this — target ≤ ${SLA.BACKEND_MISS_MAX_MS / 1000}s`,
  });
}

// ─────────────────────────────────────────────
// Test 4 — Backend cache HIT (same payload again)
// ─────────────────────────────────────────────
async function testBackendHit(token: string) {
  console.log("\n── 4. Backend /api/ai/plan-21d — cache HIT (same payload) ──");

  // Give the cache write a tick to land
  await new Promise((r) => setTimeout(r, 200));

  const t = controllerWithTimeout(15_000);
  const { result, ms, error } = await timed(async () => {
    const res = await fetch(`${BACKEND_URL}/api/ai/plan-21d`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        habit_goal: "Stop scrolling TikTok before bed",
        quiz_summary: JSON.stringify(SAMPLE_QUIZ_SUMMARY),
      }),
      signal: t.signal,
    });
    return res;
  });
  t.cancel();

  if (error || !result || !(result as Response).ok) {
    record({
      name: "Backend cache HIT",
      status: "FAIL",
      ms,
      detail: error || `HTTP ${(result as Response | null)?.status ?? "—"}`,
    });
    return;
  }
  record({
    name: "Backend cache HIT",
    status: ms <= SLA.BACKEND_HIT_MAX_MS ? "PASS" : "FAIL",
    ms,
    detail: `Target ≤ ${SLA.BACKEND_HIT_MAX_MS}ms`,
  });
}

// ─────────────────────────────────────────────
// Test 5 — Hash stability: same data, different whitespace
// Cache MUST hit even when JSON is reformatted
// ─────────────────────────────────────────────
async function testHashStability(token: string) {
  console.log("\n── 5. Cache key stability (whitespace differs) ──");

  // Same data, different JSON formatting (extra spaces, newlines)
  const payload = JSON.stringify({
    habit_goal: "Stop scrolling TikTok before bed",
    quiz_summary: JSON.stringify(SAMPLE_QUIZ_SUMMARY, null, 2), // pretty-printed
  });

  const t = controllerWithTimeout(15_000);
  const { result, ms, error } = await timed(async () => {
    const res = await fetch(`${BACKEND_URL}/api/ai/plan-21d`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: payload,
      signal: t.signal,
    });
    return res;
  });
  t.cancel();

  if (error || !result || !(result as Response).ok) {
    record({
      name: "Backend cache HIT (whitespace varied)",
      status: "FAIL",
      ms,
      detail: error || `HTTP ${(result as Response | null)?.status ?? "—"}`,
    });
    return;
  }
  record({
    name: "Backend cache HIT (whitespace varied)",
    status: ms <= SLA.STABLE_HASH_MAX_MS ? "PASS" : "FAIL",
    ms,
    detail:
      ms <= SLA.STABLE_HASH_MAX_MS
        ? "Hash is stable across whitespace ✓"
        : `Cache MISSED — hashing is NOT whitespace-stable`,
  });
}

// ─────────────────────────────────────────────
// Test 6 — Concurrent backend requests (cache hit, 5 in parallel)
// ─────────────────────────────────────────────
async function testConcurrent(token: string) {
  console.log("\n── 6. Concurrent backend requests (5 parallel, cache HIT) ──");
  const start = Date.now();
  const promises = Array.from({ length: 5 }, async () => {
    const t = controllerWithTimeout(15_000);
    const r = await fetch(`${BACKEND_URL}/api/ai/plan-21d`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        habit_goal: "Stop scrolling TikTok before bed",
        quiz_summary: JSON.stringify(SAMPLE_QUIZ_SUMMARY),
      }),
      signal: t.signal,
    });
    t.cancel();
    return r;
  });
  const responses = await Promise.allSettled(promises);
  const ms = Date.now() - start;
  const ok = responses.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
  record({
    name: "5 concurrent (cache HIT)",
    status: ok === 5 && ms <= 2_000 ? "PASS" : ok === 5 ? "FAIL" : "FAIL",
    ms,
    detail: `${ok}/5 succeeded in ${ms}ms (avg ${(ms / 5).toFixed(0)}ms)`,
  });
}

// ─────────────────────────────────────────────
// Test 7 — Different input scenarios (increasing context length)
// Measures backend cold-cache latency for 4 realistic prompts.
// ─────────────────────────────────────────────
async function testScenarioMatrix(token: string) {
  console.log("\n── 7. Input matrix (4 scenarios, increasing prompt/context size) ──");
  for (const scenario of INPUT_SCENARIOS) {
    await wipePlanCache();
    const payload = {
      habit_goal: scenario.habit_goal,
      quiz_summary: JSON.stringify(scenario.quiz_summary),
    };
    const bytes = JSON.stringify(payload).length;
    const t = controllerWithTimeout(120_000);
    const { result, ms, error } = await timed(async () => {
      const res = await fetch(`${BACKEND_URL}/api/ai/plan-21d`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: t.signal,
      });
      return res;
    });
    t.cancel();

    const name = `Scenario ${scenario.id} (${scenario.name})`;
    if (error || !result || !(result as Response).ok) {
      record({
        name,
        status: "FAIL",
        ms,
        detail: error || `HTTP ${(result as Response | null)?.status ?? "—"} | payload ${(bytes / 1024).toFixed(1)} KB`,
      });
      continue;
    }

    const body = (await (result as Response).json()) as any;
    const days = body?.data?.day_tasks ? Object.keys(body.data.day_tasks).length : 0;
    record({
      name,
      status: ms <= SLA.BACKEND_MISS_MAX_MS ? "PASS" : "FAIL",
      ms,
      detail: `${days} days | payload ${(bytes / 1024).toFixed(1)} KB | target ≤ ${SLA.BACKEND_MISS_MAX_MS / 1000}s`,
    });
  }
}

// ─────────────────────────────────────────────
// Test 8 — Multi-user simultaneous access
// Validates whether multiple authenticated users can call the endpoint together.
// ─────────────────────────────────────────────
async function testMultiUserConcurrent(primaryToken: string) {
  console.log("\n── 8. Multi-user simultaneous access (distinct users in parallel) ──");
  const unique = new Set<string>();
  const tokens: string[] = [primaryToken];
  unique.add(primaryToken);

  for (const c of LOGIN_CANDIDATES) {
    const { token } = await loginForToken(c.email, c.password);
    if (token && !unique.has(token)) {
      unique.add(token);
      tokens.push(token);
    }
  }

  if (tokens.length < 2) {
    record({
      name: "Multi-user parallel access",
      status: "SKIP",
      ms: 0,
      detail: "Need at least 2 distinct user tokens; only one available in this environment",
    });
    return;
  }

  await wipePlanCache();

  const start = Date.now();
  const requests = tokens.slice(0, 3).map((token, i) => {
    const t = controllerWithTimeout(120_000);
    return fetch(`${BACKEND_URL}/api/ai/plan-21d`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        habit_goal: `Stop scrolling TikTok before bed (user ${i + 1})`,
        quiz_summary: JSON.stringify(SAMPLE_QUIZ_SUMMARY),
      }),
      signal: t.signal,
    }).finally(() => t.cancel());
  });

  const responses = await Promise.allSettled(requests);
  const ms = Date.now() - start;
  const ok = responses.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
  const total = requests.length;

  record({
    name: `Multi-user parallel access (${total} users)`,
    status: ok === total ? "PASS" : "FAIL",
    ms,
    detail: `${ok}/${total} requests succeeded simultaneously`,
  });
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   21-Day Plan Endpoint Performance Test                         ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log(`Backend:    ${BACKEND_URL}`);
  console.log(`AI service: ${AI_SERVICE_URL}\n`);

  await testHealth();
  await testAIDirect();

  const token = await getFreshToken();
  if (!token) {
    console.log("\n⚠️  No usable auth token — backend tests will be skipped.\n");
  } else {
    await testBackendMiss(token);
    await testBackendHit(token);
    await testHashStability(token);
    await testConcurrent(token);
    await testScenarioMatrix(token);
    await testMultiUserConcurrent(token);
  }

  // ─── Summary ───
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                          SUMMARY                                ║");
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
    const time = r.ms > 0 ? `${(r.ms / 1000).toFixed(2)}s` : "—";
    console.log(`║ ${icon} ${r.name.padEnd(43)} ${time.padStart(10)} ${r.status.padEnd(4)} ║`);
  }
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log("📊 SLA targets:");
  console.log(`   AI raw LLM (NOT user-facing)  ≤ ${SLA.AI_DIRECT_MAX_MS / 1000}s   (LLM hard timeout benchmark)`);
  console.log(`   *** USER-FACING cold cache *** ≤ ${SLA.BACKEND_MISS_MAX_MS / 1000}s   (stale-while-revalidate returns fast fallback)`);
  console.log(`   *** USER-FACING warm cache *** ≤ ${SLA.BACKEND_HIT_MAX_MS}ms  (Redis hit)`);
  console.log(`   Hash stable                   ≤ ${SLA.STABLE_HASH_MAX_MS}ms  (same data, different whitespace → same cache key)\n`);

  // Force-exit so ioredis open connection doesn't hang the process
  setTimeout(() => process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0), 200);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(2);
});
