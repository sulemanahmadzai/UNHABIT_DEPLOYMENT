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
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT || "30000", 10);
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
/**
 * Make a request to the AI service with retry logic and caching
 */
async function makeRequest(endpoint, body, retries = 2, cacheTTL = 0 // 0 means no cache
) {
    const url = `${AI_SERVICE_URL}${endpoint}`;
    // Check cache if TTL is set
    if (cacheTTL > 0) {
        const requestHash = redis.hash(body);
        const cached = await getCachedAIResponse(endpoint, requestHash);
        if (cached !== null) {
            console.log(`✅ AI cache hit: ${endpoint}`);
            return { success: true, data: cached };
        }
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT);
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
            const data = await response.json();
            // Cache successful response if TTL is set
            if (cacheTTL > 0) {
                const requestHash = redis.hash(body);
                await cacheAIResponse(endpoint, requestHash, data, cacheTTL);
                console.log(`💾 AI response cached: ${endpoint} (TTL: ${cacheTTL}s)`);
            }
            return { success: true, data };
        }
        catch (error) {
            if (attempt === retries) {
                const message = error instanceof Error ? error.message : "Unknown error";
                console.error(`AI service request failed after ${retries + 1} attempts:`, message);
                return { success: false, error: message };
            }
            // Wait before retry (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
    return { success: false, error: "Request failed" };
}
/**
 * Start onboarding - Safety check + quiz form generation
 * AI expects: { habit_description: str, user_id?: str }
 * AI returns: HabitState (with safety and quiz_form populated)
 */
export async function startOnboarding(request) {
    const aiServiceRequest = {
        habit_description: request.user_input,
    };
    return makeRequest("/onboarding/start", aiServiceRequest, 2, CACHE_TTL.ONBOARDING);
}
/**
 * Canonicalize/classify a habit
 * AI expects: { habit_description: str }
 * AI returns: { habit_name, habit_category, severity_guess, confidence }
 */
export async function canonicalizeHabit(request) {
    const aiServiceRequest = {
        habit_description: request.user_input,
    };
    return makeRequest("/canonicalize-habit", aiServiceRequest, 2, CACHE_TTL.CANONICALIZE);
}
/**
 * Run safety assessment
 * AI expects: { state: HabitState } where HabitState has habit_description
 * AI returns: SafetyResult { risk, action, message }
 */
export async function assessSafety(request) {
    const aiServiceRequest = {
        state: {
            habit_description: request.user_input,
        },
    };
    return makeRequest("/safety", aiServiceRequest, 2, CACHE_TTL.SAFETY);
}
/**
 * Generate quiz form
 * AI expects: { state: HabitState } where HabitState has habit_description (and optionally quiz_form)
 * AI returns: QuizForm { habit_name_guess, questions[] }
 */
export async function generateQuizForm(request) {
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
        const categoryDescriptions = {
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
    return makeRequest("/quiz-form", aiServiceRequest, 2, CACHE_TTL.QUIZ_FORM);
}
/**
 * Get quiz summary
 * AI expects: { state: HabitState } where HabitState has:
 *   - habit_description
 *   - quiz_form (the generated quiz)
 *   - user_quiz_answers: Dict[str, str] (question_id -> option_id or answer string)
 * AI returns: QuizSummary (full mechanistic model)
 */
export async function getQuizSummary(request) {
    // Normalize answers: arrays become comma-separated strings
    const normalizedAnswers = {};
    Object.entries(request.answers || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            normalizedAnswers[key] = value.join(", ");
        }
        else {
            normalizedAnswers[key] = String(value);
        }
    });
    // Determine the habit description:
    // 1. Use explicit habit_description if provided
    // 2. Fall back to creating one from category
    let habitDescription = request.habit_description;
    if (!habitDescription) {
        // Convert category to a human-readable description
        const categoryDescriptions = {
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
    return makeRequest("/quiz-summary", aiServiceRequest, 2, CACHE_TTL.QUIZ_SUMMARY);
}
/**
 * Generate 21-day plan
 * AI expects: { state: HabitState } where HabitState has:
 *   - quiz_summary: QuizSummary (required)
 *   - habit_description (optional but recommended)
 * AI returns: Plan21D { plan_summary, day_tasks: {day_1: "...", ...}, day_whys?: {...} }
 */
export async function generatePlan21D(request) {
    // Parse quiz_summary if it's a string (JSON)
    let quizSummary;
    try {
        let parsed = typeof request.quiz_summary === 'string'
            ? JSON.parse(request.quiz_summary)
            : request.quiz_summary;
        // Handle wrapped response format: {status, statusText, data: {success, data: {...}}}
        // Extract the actual quiz summary from nested structure
        if (parsed && typeof parsed === 'object') {
            // Check for wrapped response format from API
            if ('data' in parsed && parsed.data && typeof parsed.data === 'object') {
                // Could be {data: {success, data: {...}}} or {data: {...}}
                if ('data' in parsed.data && parsed.data.data && typeof parsed.data.data === 'object') {
                    // Format: {status, data: {success, data: {actual_quiz_summary}}}
                    parsed = parsed.data.data;
                }
                else if ('user_habit_raw' in parsed.data) {
                    // Format: {data: {user_habit_raw, ...}}
                    parsed = parsed.data;
                }
            }
            // If it has user_habit_raw directly, it's already the right format
        }
        quizSummary = parsed;
    }
    catch (e) {
        // If parsing fails, create a minimal quiz_summary from habit_goal
        quizSummary = {
            user_habit_raw: request.habit_goal,
            canonical_habit_name: request.habit_goal,
            habit_category: null,
            category_confidence: "low",
            product_type: null,
            severity_level: "mild",
            core_loop: "User's habit loop is unclear.",
            primary_payoff: "User seeks an unclear emotional payoff.",
            avoidance_target: "User avoids an unclear target.",
            identity_link: "Habit has an unclear link to user's identity.",
            dopamine_profile: "Dopamine profile is unclear.",
            collapse_condition: "Collapse condition is unclear.",
            long_term_cost: "Long-term cost is unclear.",
        };
    }
    // Final validation - ensure we have the required fields
    if (!quizSummary || typeof quizSummary !== 'object' || !('user_habit_raw' in quizSummary)) {
        console.warn("Invalid quiz_summary format, creating fallback from habit_goal");
        quizSummary = {
            user_habit_raw: request.habit_goal,
            canonical_habit_name: request.habit_goal,
            habit_category: "other",
            category_confidence: "low",
            product_type: null,
            severity_level: "mild",
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
    const result = await makeRequest("/plan-21d", aiServiceRequest, 2, CACHE_TTL.PLAN_21D);
    // If main endpoint fails, try fallback
    if (!result.success) {
        console.log("Primary plan generation failed, trying fallback...");
        return makeRequest("/plan-21d-fallback", aiServiceRequest, 2, CACHE_TTL.PLAN_21D);
    }
    return result;
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
export async function chat(request) {
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
    return makeRequest("/coach", aiServiceRequest, 2, CACHE_TTL.COACH); // No cache for chat
}
/**
 * Get explanation for a specific day
 * AI expects: { state: HabitState, day_number: int } where HabitState has:
 *   - habit_description (required)
 *   - quiz_summary (required)
 *   - plan21 (required)
 * AI returns: { day_number: int, explanation: str }
 */
export async function explainDay(request) {
    // Build a minimal HabitState from the provided data
    // Note: This endpoint ideally needs quiz_summary and plan21, but we'll work with what we have
    const aiServiceRequest = {
        state: {
            habit_description: request.habit_goal,
            // We don't have quiz_summary or plan21 here, so the AI service will use defaults
        },
        day_number: request.day_number,
    };
    return makeRequest("/why-day", aiServiceRequest, 2, CACHE_TTL.WHY_DAY);
}
/**
 * Health check for AI service
 */
export async function healthCheck() {
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
    }
    catch {
        return { success: false, error: "AI service unreachable" };
    }
}
//# sourceMappingURL=ai-client.service.js.map