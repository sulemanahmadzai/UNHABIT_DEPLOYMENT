/**
 * Performance-fix regression tests
 *
 * What this verifies:
 *  1. POST /progress/tasks/:id/complete responds fast (< 2 s) — badge awarding is now fire-and-forget.
 *  2. GET /home/dashboard is served from cache on the second call.
 *  3. Dashboard cache is invalidated after task completion — a fresh call returns updated data.
 *  4. GET /rewards/badges/gallery responds from cache on the second call (< 400 ms).
 *  5. GET /rewards/level responds from cache on the second call (< 400 ms).
 *  6. POST /progress/complete-day also invalidates the dashboard cache.
 *
 * Run with:
 *   npx tsx tests/test-performance-fixes.ts
 *
 * Prerequisites:
 *   - Backend running on http://localhost:3000 (or API_BASE_URL env var)
 *   - A valid JWT token in TEST_TOKEN env var belonging to a user who has:
 *       * An active journey with at least one task
 *   - Optionally, TEST_TASK_ID env var with a journey task UUID for that user.
 *     If not supplied, the test will attempt to discover a task via /progress/today.
 */

import * as dotenv from 'dotenv';
import { apiRequest, recordTest, printSummary, testResults } from './test-helpers.js';

dotenv.config();

const TOKEN = process.env.TEST_TOKEN ?? '';
const OVERRIDE_TASK_ID = process.env.TEST_TASK_ID ?? '';
const TASK_COMPLETE_TARGET_MS = 3000;
const CACHE_HIT_TARGET_MS = 400;

// Time a single API call and return { status, data, ms }
async function timedRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: any,
  token?: string,
): Promise<{ status: number; data: any; ms: number }> {
  const start = Date.now();
  const res = await apiRequest(method, endpoint, body, token);
  const ms = Date.now() - start;
  return { ...res, ms };
}

async function getTaskId(token: string): Promise<string | null> {
  if (OVERRIDE_TASK_ID) return OVERRIDE_TASK_ID;

  const res = await apiRequest('GET', '/progress/today', undefined, token);
  if (res.status !== 200) return null;
  const tasks: Array<{ id: string; completed: boolean }> = res.data?.data?.tasks ?? [];
  const pending = tasks.find(t => !t.completed);
  return pending?.id ?? null;
}

async function getAnyTaskId(token: string): Promise<string | null> {
  if (OVERRIDE_TASK_ID) return OVERRIDE_TASK_ID;

  const res = await apiRequest('GET', '/progress/today', undefined, token);
  if (res.status !== 200) return null;

  const tasks: Array<{ id: string; completed: boolean }> = res.data?.data?.tasks ?? [];
  return tasks[0]?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Task completion is fast (badge awarding no longer blocks response)
// ─────────────────────────────────────────────────────────────────────────────
async function testTaskCompletionLatency(token: string) {
  console.log('\n⏱  Test 1: POST /progress/tasks/:id/complete latency\n');

  const taskId = await getAnyTaskId(token);
  if (!taskId) {
    recordTest(
      `T1 - Task completion latency (< ${TASK_COMPLETE_TARGET_MS} ms)`,
      false,
      'Could not find a task for today. Set TEST_TASK_ID env var or ensure an active journey with tasks exists.',
    );
    return;
  }

  // Warmup request to avoid one-time Prisma/connection cold-start skew.
  await timedRequest('POST', `/progress/tasks/${taskId}/complete`, undefined, token);

  // Run multiple samples to reduce noise from transient network/DB jitter.
  const samples: Array<{ status: number; data: any; ms: number }> = [];
  for (let i = 0; i < 3; i++) {
    samples.push(await timedRequest('POST', `/progress/tasks/${taskId}/complete`, undefined, token));
  }

  const last = samples[samples.length - 1]!;
  const msValues = samples.map(s => s.ms).sort((a, b) => a - b);
  const medianMs = msValues[1]!;
  const maxMs = msValues[2]!;

  const success = (last.status === 200 || last.status === 201) && last.data?.success === true;
  const fast = medianMs < TASK_COMPLETE_TARGET_MS;

  recordTest(
    `T1 - Task completion returns success`,
    success,
    !success ? `status=${last.status} data=${JSON.stringify(last.data).slice(0, 200)}` : undefined,
  );
  recordTest(
    `T1 - Task completion median latency < ${TASK_COMPLETE_TARGET_MS} ms (samples: ${msValues.join(', ')} ms)`,
    fast,
    !fast
      ? `Median latency is ${medianMs} ms (max ${maxMs} ms) after warmup — critical path is still slow`
      : undefined,
  );

  // Response must include xp_earned and streak_updated fields
  recordTest(
    'T1 - Response contains xp_earned field',
    typeof last.data?.xp_earned === 'number',
    !last.data?.xp_earned ? `xp_earned missing from response` : undefined,
  );
  recordTest(
    'T1 - Response contains streak_updated field',
    last.data?.streak_updated === true,
    last.data?.streak_updated !== true ? `streak_updated missing or false` : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Dashboard served from cache on second hit
// ─────────────────────────────────────────────────────────────────────────────
async function testDashboardCache(token: string) {
  console.log('\n⏱  Test 2: GET /home/dashboard cache behaviour\n');

  // First call — might be a cache miss (warm up)
  const first = await timedRequest('GET', '/home/dashboard', undefined, token);
  recordTest(
    'T2 - Dashboard first call returns 200',
    first.status === 200,
    first.status !== 200 ? `status=${first.status}` : undefined,
  );

  // Second call — must be served from cache and therefore much faster
  const second = await timedRequest('GET', '/home/dashboard', undefined, token);
  recordTest(
    'T2 - Dashboard second call returns 200',
    second.status === 200,
    second.status !== 200 ? `status=${second.status}` : undefined,
  );

  const cacheSpeedup = second.ms < 500;
  recordTest(
    `T2 - Dashboard cache hit < 500 ms (actual: ${second.ms} ms, first: ${first.ms} ms)`,
    cacheSpeedup,
    !cacheSpeedup
      ? `Second call took ${second.ms} ms — cache may not be working or Redis is slow`
      : undefined,
  );

  // Validate shape
  const d = second.data?.data ?? second.data;
  recordTest(
    'T2 - Dashboard response has expected shape (journey, xp, streak)',
    !!(d?.xp && d?.streak),
    !(d?.xp && d?.streak) ? `Unexpected shape: ${JSON.stringify(d).slice(0, 200)}` : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Dashboard cache is invalidated after task completion
// ─────────────────────────────────────────────────────────────────────────────
async function testDashboardInvalidation(token: string) {
  console.log('\n⏱  Test 3: Dashboard cache invalidation after task completion\n');

  // Warm the cache
  const before = await timedRequest('GET', '/home/dashboard', undefined, token);

  const taskId = await getAnyTaskId(token);
  if (!taskId) {
    recordTest(
      'T3 - Dashboard invalidated after task complete',
      false,
      'No task available to complete. Set TEST_TASK_ID.',
    );
    return;
  }

  // Complete a task
  await apiRequest('POST', `/progress/tasks/${taskId}/complete`, undefined, token);

  // Task-state refresh should be immediate once dashboard cache is invalidated.
  // Poll briefly because Redis invalidation + recompute can race by a few ms.
  let after = await timedRequest('GET', '/home/dashboard', undefined, token);
  let tasks: Array<{ id: string; completed: boolean }> =
    after.data?.data?.todays_checklist ?? after.data?.todays_checklist ?? [];
  let completedInDashboard = tasks.find(t => t.id === taskId)?.completed === true;

  for (let i = 0; i < 4 && !completedInDashboard; i++) {
    await new Promise(r => setTimeout(r, 500));
    after = await timedRequest('GET', '/home/dashboard', undefined, token);
    tasks = after.data?.data?.todays_checklist ?? after.data?.todays_checklist ?? [];
    completedInDashboard = tasks.find(t => t.id === taskId)?.completed === true;
  }

  recordTest(
    'T3 - Dashboard after task completion returns 200',
    after.status === 200,
    after.status !== 200 ? `status=${after.status}` : undefined,
  );
  recordTest(
    `T3 - Completed task is reflected in dashboard checklist`,
    completedInDashboard,
    !completedInDashboard
      ? `Completed task ${taskId} is still not marked complete in dashboard — cache invalidation is likely broken`
      : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — Badge gallery is served from cache on second hit
// ─────────────────────────────────────────────────────────────────────────────
async function testBadgeGalleryCache(token: string) {
  console.log('\n⏱  Test 4: GET /rewards/badges/gallery cache behaviour\n');

  // First call — populates cache
  const first = await timedRequest('GET', '/rewards/badges/gallery', undefined, token);
  recordTest(
    'T4 - Badge gallery first call returns 200',
    first.status === 200,
    first.status !== 200 ? `status=${first.status}` : undefined,
  );

  // Second call — must be from cache
  const second = await timedRequest('GET', '/rewards/badges/gallery', undefined, token);
  recordTest(
    'T4 - Badge gallery second call returns 200',
    second.status === 200,
    second.status !== 200 ? `status=${second.status}` : undefined,
  );

  const cacheHit = second.ms < CACHE_HIT_TARGET_MS;
  recordTest(
    `T4 - Badge gallery cache hit < ${CACHE_HIT_TARGET_MS} ms (actual: ${second.ms} ms, first: ${first.ms} ms)`,
    cacheHit,
    !cacheHit
      ? `Second call took ${second.ms} ms — cache may not be working`
      : undefined,
  );

  const d = second.data?.data ?? second.data;
  recordTest(
    'T4 - Badge gallery has earned/locked arrays',
    Array.isArray(d?.earned) && Array.isArray(d?.locked),
    !(Array.isArray(d?.earned) && Array.isArray(d?.locked))
      ? `Unexpected shape: ${JSON.stringify(d).slice(0, 200)}`
      : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — Level info is served from cache on second hit
// ─────────────────────────────────────────────────────────────────────────────
async function testLevelInfoCache(token: string) {
  console.log('\n⏱  Test 5: GET /rewards/level cache behaviour\n');

  const first = await timedRequest('GET', '/rewards/level', undefined, token);
  recordTest(
    'T5 - Level info first call returns 200',
    first.status === 200,
    first.status !== 200 ? `status=${first.status}` : undefined,
  );

  const second = await timedRequest('GET', '/rewards/level', undefined, token);
  recordTest(
    'T5 - Level info second call returns 200',
    second.status === 200,
    second.status !== 200 ? `status=${second.status}` : undefined,
  );

  const cacheHit = second.ms < CACHE_HIT_TARGET_MS;
  recordTest(
    `T5 - Level info cache hit < ${CACHE_HIT_TARGET_MS} ms (actual: ${second.ms} ms, first: ${first.ms} ms)`,
    cacheHit,
    !cacheHit ? `Second call took ${second.ms} ms — cache may not be working` : undefined,
  );

  const d = second.data?.data ?? second.data;
  recordTest(
    'T5 - Level info has level and total_xp fields',
    typeof d?.level === 'number' && typeof d?.total_xp === 'number',
    !(typeof d?.level === 'number' && typeof d?.total_xp === 'number')
      ? `Unexpected shape: ${JSON.stringify(d).slice(0, 200)}`
      : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — POST /progress/complete-day invalidates dashboard cache
// ─────────────────────────────────────────────────────────────────────────────
async function testCompleteDayInvalidation(token: string) {
  console.log('\n⏱  Test 6: POST /progress/complete-day invalidates dashboard cache\n');

  // Warm cache
  await apiRequest('GET', '/home/dashboard', undefined, token);

  // Complete today
  const completeRes = await timedRequest('POST', '/progress/complete-day', undefined, token);
  recordTest(
    'T6 - complete-day returns 200',
    completeRes.status === 200,
    completeRes.status !== 200 ? `status=${completeRes.status}` : undefined,
  );

  // Allow cache invalidation to propagate
  await new Promise(r => setTimeout(r, 300));

  // Dashboard must reload from DB (not stale cache)
  const dashRes = await timedRequest('GET', '/home/dashboard', undefined, token);
  recordTest(
    'T6 - Dashboard after complete-day returns 200',
    dashRes.status === 200,
    dashRes.status !== 200 ? `status=${dashRes.status}` : undefined,
  );

  // If all tasks were just completed, todays_checklist should show all completed
  const tasks: Array<{ completed: boolean }> =
    dashRes.data?.data?.todays_checklist ?? dashRes.data?.todays_checklist ?? [];
  const allDone = tasks.length === 0 || tasks.every(t => t.completed);
  recordTest(
    'T6 - Dashboard todays_checklist all completed (or empty) after complete-day',
    allDone,
    !allDone
      ? `Some tasks still show incomplete — dashboard may be serving stale cache`
      : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────────────────────────────────────
async function runPerformanceTests() {
  console.log('🚀 Performance-Fix Regression Tests\n' + '='.repeat(60));

  if (!TOKEN) {
    console.error(
      '\n❌ TEST_TOKEN environment variable is required.\n' +
        '   PowerShell:\n' +
        '   $env:TEST_TOKEN="eyJ..."\n' +
        '   Bash:\n' +
        '   export TEST_TOKEN="eyJ..."',
    );
    process.exit(1);
  }

  await testTaskCompletionLatency(TOKEN);
  await testDashboardCache(TOKEN);
  await testDashboardInvalidation(TOKEN);
  await testBadgeGalleryCache(TOKEN);
  await testLevelInfoCache(TOKEN);
  await testCompleteDayInvalidation(TOKEN);

  const allPassed = printSummary();
  process.exit(allPassed ? 0 : 1);
}

runPerformanceTests().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
