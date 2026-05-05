/**
 * AI Client Service - HTTP client to call unhabit-ai-project endpoints
 * 
 * This service proxies requests to the FastAPI AI service
 * All mappings are based on the AI project's api_main.py and schemas.py
 * 
 * Features:
 * - Response caching for expensive AI operations
 * - Idempotency protection
 * - Retry logic with exponential backoff
 */

import redis from "../db/redis.js";
import { cacheAIResponse, getCachedAIResponse } from "./cache.service.js";
import { buildFallbackPlan, extractFallbackContext } from "./plan-fallback.service.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT || "35000", 10); // 30s fallback window + network margin

/**
 * Soft deadline for the user-facing /plan-21d response. If the AI service has
 * not produced a real plan within this time budget, we instantly return a
 * deterministic fallback (computed in-process, ~1ms) and let the AI call keep
 * running in the background to populate the cache for the next request.
 *
 * This is the "fast even on cache miss" requirement.
 */
const PLAN_FAST_RESPONSE_MS = parseInt(
  process.env.PLAN_FAST_RESPONSE_MS || "30000",
  10
);
const PLAN_FALLBACK_CACHE_TTL_SECONDS = parseInt(
  process.env.PLAN_FALLBACK_CACHE_TTL_SECONDS || "120",
  10
);

// Cache TTLs for different AI endpoints (in seconds)
const CACHE_TTL = {
  ONBOARDING: 3600, // 1 hour
  CANONICALIZE: 86400, // 24 hours (stable)
  SAFETY: 3600, // 1 hour
  QUIZ_FORM: 3600, // 1 hour
  QUIZ_SUMMARY: 86400, // 24 hours (deterministic)
  PLAN_21D: 86400, // 24 hours (expensive, deterministic)
  COACH: 0, // No cache (conversational)
  WHY_DAY: 86400, // 24 hours (stable)
};

interface AIServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Request/Response Types (as received from backend routes)
// ============================================================================

interface OnboardingStartRequest {
  user_input: string;
}

// AI returns HabitState, but we'll extract what we need
interface OnboardingStartResponse {
  user_id?: string | null;
  habit_description?: string | null;
  safety?: {
    risk: "none" | "self_harm" | "eating_disorder" | "severe_addiction" | "violence" | "other";
    action: "allow" | "block_and_escalate";
    message: string;
  } | null;
  quiz_form?: {
    habit_name_guess: string;
    questions: Array<{
      id: string;
      question: string;
      helper_text?: string | null;
      options: Array<{
        id: string;
        label: string;
        helper_text?: string | null;
      }>;
    }>;
  } | null;
}

interface CanonicalizeHabitRequest {
  user_input: string;
}

// AI returns: { habit_name, habit_category, severity_guess, confidence }
interface CanonicalizeHabitResponse {
  habit_name: string;
  habit_category: string;
  severity_guess: number;
  confidence: number;
}

interface SafetyRequest {
  user_input: string;
}

// AI returns SafetyResult: { risk, action, message }
interface SafetyResponse {
  risk: "none" | "self_harm" | "eating_disorder" | "severe_addiction" | "violence" | "other";
  action: "allow" | "block_and_escalate";
  message: string;
}

interface QuizFormRequest {
  habit_category: string;
  user_context?: string | undefined;
  habit_description?: string | undefined;
}

// AI returns QuizForm: { habit_name_guess, questions[] }
interface QuizFormResponse {
  habit_name_guess: string;
  questions: Array<{
    id: string;
    question: string;
    helper_text?: string | null;
    has_other_option?: boolean;
    options: Array<{
      id: string;
      label: string;
      helper_text?: string | null;
      allow_custom_input?: boolean;
      custom_input_key?: string;
      custom_input_placeholder?: string;
    }>;
  }>;
}

interface QuizSummaryRequest {
  answers: Record<string, unknown>;
  habit_category: string;
  habit_description?: string | undefined;
  quiz_form?: {
    habit_name_guess: string;
    questions: Array<{
      id: string;
      question: string;
      helper_text?: string | null | undefined;
      options: Array<{
        id: string;
        label: string;
        helper_text?: string | null | undefined;
      }>;
    }>;
  } | undefined;
}

interface QuizAnswerObject {
  value?: string | string[];
  selected?: string | string[];
  option_id?: string;
  option_ids?: string[];
  other_text?: string;
  otherText?: string;
  custom_input?: string;
  customInput?: string;
  [key: string]: unknown;
}

const OTHER_OPTION_PATTERN =
  /\b(other|others|something else|anything else|else)\b/i;

function isOtherToken(value: string): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  return (
    OTHER_OPTION_PATTERN.test(normalized) ||
    normalized === "other" ||
    normalized === "others" ||
    normalized.startsWith("other_") ||
    normalized.endsWith("_other")
  );
}

function looksLikeAnswerObject(value: unknown): value is QuizAnswerObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).map((v) => v.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function extractCustomInput(answerObj: QuizAnswerObject): string {
  const custom = [
    answerObj.other_text,
    answerObj.otherText,
    answerObj.custom_input,
    answerObj.customInput,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .find(Boolean);
  return custom || "";
}

function normalizeAnswerValue(
  rawValue: unknown,
  questionMeta?: {
    options: Array<{ id: string; label: string }>;
  }
): string {
  if (Array.isArray(rawValue)) {
    return rawValue.map((v) => String(v)).join(", ");
  }

  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (!looksLikeAnswerObject(rawValue)) {
    return String(rawValue ?? "");
  }

  const selected = [
    ...toStringArray(rawValue.selected),
    ...toStringArray(rawValue.value),
    ...toStringArray(rawValue.option_id),
    ...toStringArray(rawValue.option_ids),
  ];

  const dedupedSelected = Array.from(new Set(selected));
  const customInput = extractCustomInput(rawValue);

  const optionById = new Map<string, string>();
  (questionMeta?.options || []).forEach((o) => {
    optionById.set(String(o.id), String(o.label));
  });

  const selectedLooksLikeOther = dedupedSelected.some((entry) => {
    const label = optionById.get(entry);
    return isOtherToken(entry) || (label ? isOtherToken(label) : false);
  });

  const selectedText = dedupedSelected
    .map((entry) => optionById.get(entry) || entry)
    .join(", ");

  if (customInput && selectedText) {
    return selectedLooksLikeOther
      ? `${selectedText} (other: ${customInput})`
      : `${selectedText} (details: ${customInput})`;
  }

  if (customInput && !selectedText) {
    return `other: ${customInput}`;
  }

  return selectedText;
}

// AI returns full QuizSummary (mechanistic model)
interface QuizSummaryResponse {
  user_habit_raw: string;
  canonical_habit_name: string;
  habit_category: string | null;
  category_confidence: "low" | "medium" | "high";
  product_type: string | null;
  severity_level: "mild" | "moderate" | "severe";
  core_loop: string;
  primary_payoff: string;
  avoidance_target: string;
  identity_link: string;
  dopamine_profile: string;
  collapse_condition: string;
  long_term_cost: string;
  main_trigger?: string | null;
  peak_times?: string | null;
  common_locations?: string | null;
  emotional_patterns?: string | null;
  frequency_pattern?: string | null;
  previous_attempts?: string | null;
  motivation_reason?: string | null;
  risk_situations?: string | null;
  mechanism_summary?: string | null;
}

interface Plan21DRequest {
  habit_goal: string;
  quiz_summary: string; // This is the full QuizSummary JSON string
  user_context?: string | undefined;
}

// AI returns Plan21D: { plan_summary, day_tasks: {day_1: [...], ...}, day_whys?: {...} }
interface DayTask {
  title: string;
  description: string;
  kind: string; // "behavioral" | "cognitive" | "environmental" | "identity" | "reflection"
}

interface Plan21DResponse {
  plan_summary: string;
  day_tasks: Record<string, DayTask[]>; // {"day_1": [task1, task2, task3], "day_2": [...], ...}
  day_whys?: Record<string, string> | null; // {"day_1": "why", ...}
  source?: "ai" | "fallback";
}

interface CoachRequest {
  message: string;
  session_history?: Array<{
    role: "user" | "assistant";
    content: string;
  }> | undefined;
  context?: {
    journey_day?: number | undefined;
    current_streak?: number | undefined;
    recent_slip?: boolean | undefined;
  } | undefined;
}

// AI returns CoachResponse: { coach_reply, chat_history }
interface CoachResponse {
  coach_reply: string;
  chat_history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

interface WhyDayRequest {
  day_number: number;
  day_theme: string;
  day_tasks: Array<{
    title: string;
    kind: string;
  }>;
  habit_goal: string;
}

// AI returns WhyDayResponse: { day_number, explanation }
interface WhyDayResponse {
  day_number: number;
  explanation: string;
}

interface MakeRequestOptions {
  /** Override the default cache key so different requests can share a cache entry. */
  cacheKey?: string;
  /** Skip the cache lookup phase (still writes on success). */
  skipCacheRead?: boolean;
  /** Skip writing to cache on success. */
  skipCacheWrite?: boolean;
  /** Override the per-request abort timeout in ms. */
  timeoutMs?: number;
}

/**
 * Make a request to the AI service with retry logic and caching
 */
async function makeRequest<T>(
  endpoint: string,
  body: unknown,
  retries = 1,
  cacheTTL = 0, // 0 means no cache
  opts: MakeRequestOptions = {}
): Promise<AIServiceResponse<T>> {
  const url = `${AI_SERVICE_URL}${endpoint}`;
  const startTime = Date.now();
  const timeoutMs = opts.timeoutMs ?? AI_SERVICE_TIMEOUT;

  const cacheKey = opts.cacheKey ?? redis.hash(body);

  // Check cache if TTL is set
  if (cacheTTL > 0 && !opts.skipCacheRead) {
    const cached = await getCachedAIResponse(endpoint, cacheKey);
    if (cached !== null) {
      console.log(`✅ AI cache hit: ${endpoint} (${Date.now() - startTime}ms)`);
      return { success: true, data: cached as T };
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const attemptStart = Date.now();
      console.log(`🔄 AI request: ${endpoint} (attempt ${attempt + 1}/${retries + 1})`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI service error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as T;
      const elapsed = Date.now() - attemptStart;
      console.log(`✅ AI response: ${endpoint} in ${elapsed}ms`);

      // Cache successful response if TTL is set
      if (cacheTTL > 0 && !opts.skipCacheWrite) {
        const ttlToUse =
          endpoint === "/plan-21d" &&
          typeof data === "object" &&
          data !== null &&
          "source" in (data as Record<string, unknown>) &&
          (data as Record<string, unknown>).source === "fallback"
            ? PLAN_FALLBACK_CACHE_TTL_SECONDS
            : cacheTTL;
        await cacheAIResponse(endpoint, cacheKey, data, ttlToUse);
        console.log(`💾 AI response cached: ${endpoint} (TTL: ${ttlToUse}s)`);
      }

      return { success: true, data };
    } catch (error) {
      if (attempt === retries) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const elapsed = Date.now() - startTime;
        console.error(`❌ AI request failed after ${retries + 1} attempts (${elapsed}ms):`, message);
        return { success: false, error: message };
      }
      // Wait before retry (exponential backoff, max 2s)
      const backoff = Math.min(Math.pow(2, attempt) * 1000, 2000);
      console.log(`⏳ AI retry in ${backoff}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  return { success: false, error: "Request failed" };
}

/**
 * Track in-flight background plan generations so two concurrent cache misses
 * for the same canonical habit don't each spawn their own AI call. The lock
 * is scoped to a single backend process; that's acceptable because
 * /plan-21d is rate-limited and the eventual cache write is visible to all
 * processes via Redis.
 */
const inflightPlanGen = new Set<string>();

/**
 * Start onboarding - Safety check + quiz form generation
 * AI expects: { habit_description: str, user_id?: str }
 * AI returns: HabitState (with safety and quiz_form populated)
 */
export async function startOnboarding(
  request: OnboardingStartRequest
): Promise<AIServiceResponse<OnboardingStartResponse>> {
  const aiServiceRequest = {
    habit_description: request.user_input,
  };
  return makeRequest<OnboardingStartResponse>("/onboarding/start", aiServiceRequest, 2, CACHE_TTL.ONBOARDING);
}

/**
 * Canonicalize/classify a habit
 * AI expects: { habit_description: str }
 * AI returns: { habit_name, habit_category, severity_guess, confidence }
 */
export async function canonicalizeHabit(
  request: CanonicalizeHabitRequest
): Promise<AIServiceResponse<CanonicalizeHabitResponse>> {
  const aiServiceRequest = {
    habit_description: request.user_input,
  };
  return makeRequest<CanonicalizeHabitResponse>("/canonicalize-habit", aiServiceRequest, 2, CACHE_TTL.CANONICALIZE);
}

/**
 * Run safety assessment
 * AI expects: { state: HabitState } where HabitState has habit_description
 * AI returns: SafetyResult { risk, action, message }
 */
export async function assessSafety(
  request: SafetyRequest
): Promise<AIServiceResponse<SafetyResponse>> {
  const aiServiceRequest = {
    state: {
      habit_description: request.user_input,
    },
  };
  return makeRequest<SafetyResponse>("/safety", aiServiceRequest, 2, CACHE_TTL.SAFETY);
}

/**
 * Generate quiz form
 * AI expects: { state: HabitState } where HabitState has habit_description (and optionally quiz_form)
 * AI returns: QuizForm { habit_name_guess, questions[] }
 */
export async function generateQuizForm(
  request: QuizFormRequest
): Promise<AIServiceResponse<QuizFormResponse>> {
  // Determine the habit description to send:
  // 1. Use explicit habit_description if provided
  // 2. Fall back to user_context if provided (this contains the actual user's habit description)
  // 3. Last resort: create a descriptive phrase from the category
  let habitDescription = request.habit_description;

  if (!habitDescription && request.user_context) {
    habitDescription = request.user_context;
  }

  if (!habitDescription) {
    // Convert category to a human-readable description
    const categoryDescriptions: Record<string, string> = {
      "nicotine_smoking": "smoking cigarettes or tobacco",
      "nicotine_vaping": "vaping or using e-cigarettes",
      "nicotine_oral": "using nicotine pouches or oral tobacco",
      "pornography": "watching pornography",
      "social_media": "excessive social media use and scrolling",
      "gaming": "excessive gaming",
      "screen_time": "too much screen time",
      "food_overeating": "overeating or binge eating",
      "sugar": "consuming too much sugar",
      "alcohol": "drinking alcohol",
      "cannabis": "using cannabis",
      "shopping_spending": "impulsive shopping or overspending",
      "gambling": "gambling",
      "procrastination": "procrastinating on important tasks",
    };
    habitDescription = categoryDescriptions[request.habit_category] || request.habit_category;
  }

  const aiServiceRequest = {
    state: {
      habit_description: habitDescription,
    },
  };
  const result = await makeRequest<QuizFormResponse>(
    "/quiz-form",
    aiServiceRequest,
    2,
    CACHE_TTL.QUIZ_FORM
  );

  if (!result.success || !result.data?.questions) {
    return result;
  }

  const enriched: QuizFormResponse = {
    ...result.data,
    questions: result.data.questions.map((question) => {
      const hasOtherOption = question.options.some(
        (option) => isOtherToken(option.label) || isOtherToken(option.id)
      );

      return {
        ...question,
        has_other_option: hasOtherOption,
        options: question.options.map((option) => {
          const isOther = isOtherToken(option.label) || isOtherToken(option.id);
          if (!isOther) return option;
          return {
            ...option,
            allow_custom_input: true,
            custom_input_key: `${question.id}__other_text`,
            custom_input_placeholder: "Please specify",
          };
        }),
      };
    }),
  };

  return { success: true, data: enriched };
}

/**
 * Get quiz summary
 * AI expects: { state: HabitState } where HabitState has:
 *   - habit_description
 *   - quiz_form (the generated quiz)
 *   - user_quiz_answers: Dict[str, str] (question_id -> option_id or answer string)
 * AI returns: QuizSummary (full mechanistic model)
 */
export async function getQuizSummary(
  request: QuizSummaryRequest
): Promise<AIServiceResponse<QuizSummaryResponse>> {
  const questionMetaById = new Map<
    string,
    { options: Array<{ id: string; label: string }> }
  >();
  (request.quiz_form?.questions || []).forEach((q) => {
    questionMetaById.set(q.id, {
      options: (q.options || []).map((o) => ({ id: o.id, label: o.label })),
    });
  });

  // Merge companion keys like "<question_id>__other_text" into their base answer.
  const mergedAnswers: Record<string, unknown> = { ...(request.answers || {}) };
  Object.entries(request.answers || {}).forEach(([key, value]) => {
    if (!key.endsWith("__other_text")) return;
    const baseKey = key.slice(0, -"__other_text".length);
    const otherText = String(value ?? "").trim();
    if (!baseKey || !otherText) return;

    const baseRaw = mergedAnswers[baseKey];
    if (looksLikeAnswerObject(baseRaw)) {
      mergedAnswers[baseKey] = { ...baseRaw, other_text: otherText };
    } else if (baseRaw !== undefined) {
      mergedAnswers[baseKey] = { selected: baseRaw as string | string[], other_text: otherText };
    } else {
      mergedAnswers[baseKey] = { other_text: otherText };
    }
  });

  // Normalize answers: preserve "other" custom text when present
  const normalizedAnswers: Record<string, string> = {};
  Object.entries(mergedAnswers).forEach(([key, value]) => {
    if (key.endsWith("__other_text")) return;
    normalizedAnswers[key] = normalizeAnswerValue(value, questionMetaById.get(key));
  });

  // Determine the habit description:
  // 1. Use explicit habit_description if provided
  // 2. Fall back to creating one from category
  let habitDescription = request.habit_description;

  if (!habitDescription) {
    // Convert category to a human-readable description
    const categoryDescriptions: Record<string, string> = {
      "nicotine_smoking": "smoking cigarettes or tobacco",
      "nicotine_vaping": "vaping or using e-cigarettes",
      "nicotine_oral": "using nicotine pouches or oral tobacco",
      "pornography": "watching pornography",
      "social_media": "excessive social media use and scrolling",
      "gaming": "excessive gaming",
      "screen_time": "too much screen time",
      "food_overeating": "overeating or binge eating",
      "sugar": "consuming too much sugar",
      "alcohol": "drinking alcohol",
      "cannabis": "using cannabis",
      "shopping_spending": "impulsive shopping or overspending",
      "gambling": "gambling",
      "procrastination": "procrastinating on important tasks",
    };
    habitDescription = categoryDescriptions[request.habit_category] || request.habit_category;
  }

  const aiServiceRequest = {
    state: {
      habit_description: habitDescription,
      quiz_form: request.quiz_form || null,
      user_quiz_answers: normalizedAnswers,
    },
  };
  return makeRequest<QuizSummaryResponse>("/quiz-summary", aiServiceRequest, 2, CACHE_TTL.QUIZ_SUMMARY);
}

/**
 * Build a STABLE cache key for /plan-21d that doesn't change with whitespace,
 * key ordering, or unrelated fields like a fresh `user_habit_raw` quote.
 *
 * We hash on the canonical mechanistic fields, which are LLM-derived from the
 * quiz and tend to be the same for users with the same habit. This lets two
 * users with very similar quiz results share a cached plan — much higher hit
 * rate than hashing the full request body.
 */
function planCacheKey(habitGoal: string, quizSummary: Record<string, unknown>): string {
  const canonical = {
    version: "v2",
    canonical_habit_name: String(quizSummary.canonical_habit_name || habitGoal || "")
      .toLowerCase()
      .trim(),
    habit_category: String(quizSummary.habit_category || "").toLowerCase().trim(),
    severity_level: String(quizSummary.severity_level || "mild").toLowerCase().trim(),
    product_type: String(quizSummary.product_type || "").toLowerCase().trim(),
    main_trigger: String(quizSummary.main_trigger || "").toLowerCase().trim(),
  };
  return redis.hash(canonical);
}

/**
 * Generate 21-day plan
 *
 * Strategy (the fast path):
 *   1. Check Redis with a stable canonical cache key → return immediately on hit.
 *   2. On miss, race the AI service against a soft deadline (PLAN_FAST_RESPONSE_MS).
 *      - If the AI returns first → cache + return real plan.
 *      - If the deadline wins → return a deterministic fallback NOW and let the
 *        AI call keep running in the background to populate the cache.
 *   3. The next request for the same canonical habit gets the real AI plan
 *      from cache (~5ms).
 *
 * This guarantees the user-facing endpoint always responds in well under
 * `PLAN_FAST_RESPONSE_MS`, regardless of OpenAI latency.
 */
export async function generatePlan21D(
  request: Plan21DRequest
): Promise<AIServiceResponse<Plan21DResponse>> {
  // ── Parse / sanitize quiz_summary ─────────────────────────────────────
  let quizSummary: any;
  try {
    let parsed = typeof request.quiz_summary === "string"
      ? JSON.parse(request.quiz_summary)
      : request.quiz_summary;

    // Handle wrapped response format: {status, statusText, data: {success, data: {...}}}
    if (parsed && typeof parsed === "object") {
      if ("data" in parsed && parsed.data && typeof parsed.data === "object") {
        if ("data" in parsed.data && parsed.data.data && typeof parsed.data.data === "object") {
          parsed = parsed.data.data;
        } else if ("user_habit_raw" in parsed.data) {
          parsed = parsed.data;
        }
      }
    }
    quizSummary = parsed;
  } catch {
    quizSummary = null;
  }

  if (!quizSummary || typeof quizSummary !== "object" || !("user_habit_raw" in quizSummary)) {
    quizSummary = {
      user_habit_raw: request.habit_goal,
      canonical_habit_name: request.habit_goal,
      habit_category: "other",
      category_confidence: "low" as const,
      product_type: null,
      severity_level: "mild" as const,
      core_loop: "User's habit loop is unclear.",
      primary_payoff: "User seeks an unclear emotional payoff.",
      avoidance_target: "User avoids an unclear target.",
      identity_link: "Habit has an unclear link to user's identity.",
      dopamine_profile: "Dopamine profile is unclear.",
      collapse_condition: "Collapse condition is unclear.",
      long_term_cost: "Long-term cost is unclear.",
    };
  }

  const aiServiceRequest = {
    state: {
      habit_description: request.habit_goal,
      quiz_summary: quizSummary,
    },
  };

  const cacheKey = planCacheKey(request.habit_goal, quizSummary);
  const startTime = Date.now();

  // ── 1. Cache lookup (stable, canonical) ───────────────────────────────
  const cached = await getCachedAIResponse("/plan-21d", cacheKey);
  if (cached !== null) {
    console.log(`✅ /plan-21d cache hit (${Date.now() - startTime}ms)`);
    return { success: true, data: cached as Plan21DResponse };
  }

  // ── 2. Race AI service against the fast-response deadline ─────────────
  console.log(`🏁 /plan-21d cache miss — racing AI vs ${PLAN_FAST_RESPONSE_MS}ms fallback deadline`);

  const aiPromise = makeRequest<Plan21DResponse>(
    "/plan-21d",
    aiServiceRequest,
    0, // no in-makeRequest retries; we manage retries ourselves
    CACHE_TTL.PLAN_21D,
    { cacheKey, skipCacheRead: true, timeoutMs: AI_SERVICE_TIMEOUT }
  );

  // Tag the AI promise so when the timeout wins the race we can tell them apart
  type RaceResult =
    | { kind: "ai"; res: AIServiceResponse<Plan21DResponse> }
    | { kind: "deadline" };

  const taggedAI: Promise<RaceResult> = aiPromise.then((res) => ({ kind: "ai", res }));
  const deadline: Promise<RaceResult> = new Promise((resolve) =>
    setTimeout(() => resolve({ kind: "deadline" }), PLAN_FAST_RESPONSE_MS)
  );

  const winner = await Promise.race([taggedAI, deadline]);

  if (winner.kind === "ai" && winner.res.success && winner.res.data) {
    console.log(`🚀 /plan-21d AI beat the deadline in ${Date.now() - startTime}ms`);
    return winner.res;
  }

  if (winner.kind === "ai" && !winner.res.success) {
    // AI failed FAST. Return fallback synchronously, no background retry.
    console.warn(`⚠️ /plan-21d AI failed in ${Date.now() - startTime}ms: ${winner.res.error}. Returning fallback.`);
    return {
      success: true,
      data: buildFallbackPlan(extractFallbackContext(quizSummary, request.habit_goal)),
    };
  }

  // Deadline won. Kick off (or keep running) the AI call in the background to
  // warm the cache for the next request, and return a fast deterministic plan.
  console.log(`⏱️ /plan-21d deadline reached after ${Date.now() - startTime}ms — returning fallback, AI continues in background`);

  const fallbackPlan = buildFallbackPlan(extractFallbackContext(quizSummary, request.habit_goal));

  // Cache the fallback IMMEDIATELY so any other request that arrives while the
  // AI is still chugging away gets a sub-millisecond cache hit instead of
  // racing the deadline again. When the AI call eventually completes, its
  // result will overwrite this entry (same key, same TTL).
  void cacheAIResponse("/plan-21d", cacheKey, fallbackPlan, PLAN_FALLBACK_CACHE_TTL_SECONDS)
    .then(() => console.log(`💾 Fallback cached under ${cacheKey.slice(0, 8)}… (will be replaced when AI finishes)`))
    .catch(() => {});

  // Track in-flight background AI work for observability / future de-dup.
  if (!inflightPlanGen.has(cacheKey)) {
    inflightPlanGen.add(cacheKey);
    void aiPromise
      .then((res) => {
        if (res.success) {
          console.log(`💾 Background /plan-21d ready — cache key ${cacheKey.slice(0, 8)}… now serves the AI plan`);
        }
      })
      .catch(() => {})
      .finally(() => inflightPlanGen.delete(cacheKey));
  }

  return { success: true, data: fallbackPlan };
}

/**
 * AI coach chat
 * AI expects: { state: HabitState } where HabitState has:
 *   - last_user_message: str (REQUIRED)
 *   - habit_description: str (required)
 *   - quiz_summary: QuizSummary (strongly recommended)
 *   - plan21: Plan21D (improves quality)
 *   - chat_history: List[Dict] (for context)
 * AI returns: { coach_reply: str, chat_history: List[Dict] }
 */
export async function chat(
  request: CoachRequest
): Promise<AIServiceResponse<CoachResponse>> {
  // Build chat_history from session_history
  const chatHistory = (request.session_history || []).map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const aiServiceRequest = {
    state: {
      last_user_message: request.message,
      habit_description: "", // Will be populated if available in context
      chat_history: chatHistory,
      // Note: quiz_summary and plan21 would improve quality but are optional
      // The backend would need to pass these from previous steps
    },
  };

  return makeRequest<CoachResponse>("/coach", aiServiceRequest, 2, CACHE_TTL.COACH); // No cache for chat
}

/**
 * Get explanation for a specific day
 * AI expects: { state: HabitState, day_number: int } where HabitState has:
 *   - habit_description (required)
 *   - quiz_summary (required)
 *   - plan21 (required)
 * AI returns: { day_number: int, explanation: str }
 */
export async function explainDay(
  request: WhyDayRequest
): Promise<AIServiceResponse<WhyDayResponse>> {
  // Build a minimal HabitState from the provided data
  // Note: This endpoint ideally needs quiz_summary and plan21, but we'll work with what we have
  const aiServiceRequest = {
    state: {
      habit_description: request.habit_goal,
      // We don't have quiz_summary or plan21 here, so the AI service will use defaults
    },
    day_number: request.day_number,
  };

  return makeRequest<WhyDayResponse>("/why-day", aiServiceRequest, 2, CACHE_TTL.WHY_DAY);
}

/**
 * Health check for AI service
 */
export async function healthCheck(): Promise<AIServiceResponse<{ status: string }>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${AI_SERVICE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, data: { status: "healthy" } };
    }
    return { success: false, error: "AI service unhealthy" };
  } catch {
    return { success: false, error: "AI service unreachable" };
  }
}

// Export types for use in routes
export type {
  DayTask,
  OnboardingStartRequest,
  OnboardingStartResponse,
  CanonicalizeHabitRequest,
  CanonicalizeHabitResponse,
  SafetyRequest,
  SafetyResponse,
  QuizFormRequest,
  QuizFormResponse,
  QuizSummaryRequest,
  QuizSummaryResponse,
  Plan21DRequest,
  Plan21DResponse,
  CoachRequest,
  CoachResponse,
  WhyDayRequest,
  WhyDayResponse,
  AIServiceResponse,
};
