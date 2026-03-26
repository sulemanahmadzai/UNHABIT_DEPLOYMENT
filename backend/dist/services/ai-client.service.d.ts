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
interface AIServiceResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
interface OnboardingStartRequest {
    user_input: string;
}
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
interface CanonicalizeHabitResponse {
    habit_name: string;
    habit_category: string;
    severity_guess: number;
    confidence: number;
}
interface SafetyRequest {
    user_input: string;
}
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
interface QuizFormResponse {
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
}
interface QuizSummaryRequest {
    answers: Record<string, string | string[]>;
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
    quiz_summary: string;
    user_context?: string | undefined;
}
interface DayTask {
    title: string;
    description: string;
    kind: string;
}
interface Plan21DResponse {
    plan_summary: string;
    day_tasks: Record<string, DayTask[]>;
    day_whys?: Record<string, string> | null;
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
interface WhyDayResponse {
    day_number: number;
    explanation: string;
}
/**
 * Start onboarding - Safety check + quiz form generation
 * AI expects: { habit_description: str, user_id?: str }
 * AI returns: HabitState (with safety and quiz_form populated)
 */
export declare function startOnboarding(request: OnboardingStartRequest): Promise<AIServiceResponse<OnboardingStartResponse>>;
/**
 * Canonicalize/classify a habit
 * AI expects: { habit_description: str }
 * AI returns: { habit_name, habit_category, severity_guess, confidence }
 */
export declare function canonicalizeHabit(request: CanonicalizeHabitRequest): Promise<AIServiceResponse<CanonicalizeHabitResponse>>;
/**
 * Run safety assessment
 * AI expects: { state: HabitState } where HabitState has habit_description
 * AI returns: SafetyResult { risk, action, message }
 */
export declare function assessSafety(request: SafetyRequest): Promise<AIServiceResponse<SafetyResponse>>;
/**
 * Generate quiz form
 * AI expects: { state: HabitState } where HabitState has habit_description (and optionally quiz_form)
 * AI returns: QuizForm { habit_name_guess, questions[] }
 */
export declare function generateQuizForm(request: QuizFormRequest): Promise<AIServiceResponse<QuizFormResponse>>;
/**
 * Get quiz summary
 * AI expects: { state: HabitState } where HabitState has:
 *   - habit_description
 *   - quiz_form (the generated quiz)
 *   - user_quiz_answers: Dict[str, str] (question_id -> option_id or answer string)
 * AI returns: QuizSummary (full mechanistic model)
 */
export declare function getQuizSummary(request: QuizSummaryRequest): Promise<AIServiceResponse<QuizSummaryResponse>>;
/**
 * Generate 21-day plan
 * AI expects: { state: HabitState } where HabitState has:
 *   - quiz_summary: QuizSummary (required)
 *   - habit_description (optional but recommended)
 * AI returns: Plan21D { plan_summary, day_tasks: {day_1: "...", ...}, day_whys?: {...} }
 */
export declare function generatePlan21D(request: Plan21DRequest): Promise<AIServiceResponse<Plan21DResponse>>;
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
export declare function chat(request: CoachRequest): Promise<AIServiceResponse<CoachResponse>>;
/**
 * Get explanation for a specific day
 * AI expects: { state: HabitState, day_number: int } where HabitState has:
 *   - habit_description (required)
 *   - quiz_summary (required)
 *   - plan21 (required)
 * AI returns: { day_number: int, explanation: str }
 */
export declare function explainDay(request: WhyDayRequest): Promise<AIServiceResponse<WhyDayResponse>>;
/**
 * Health check for AI service
 */
export declare function healthCheck(): Promise<AIServiceResponse<{
    status: string;
}>>;
export type { DayTask, OnboardingStartRequest, OnboardingStartResponse, CanonicalizeHabitRequest, CanonicalizeHabitResponse, SafetyRequest, SafetyResponse, QuizFormRequest, QuizFormResponse, QuizSummaryRequest, QuizSummaryResponse, Plan21DRequest, Plan21DResponse, CoachRequest, CoachResponse, WhyDayRequest, WhyDayResponse, AIServiceResponse, };
//# sourceMappingURL=ai-client.service.d.ts.map