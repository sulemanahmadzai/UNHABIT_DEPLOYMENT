/**
 * AI Client Service - HTTP client to call unhabit-ai-project endpoints
 *
 * This service proxies requests to the FastAPI AI service
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
    safety_result: {
        is_safe: boolean;
        flags?: string[];
        severity?: number;
    };
    quiz_form?: {
        questions: Array<{
            id: string;
            question: string;
            type: string;
            options?: string[];
        }>;
    };
}
interface CanonicalizeHabitRequest {
    user_input: string;
}
interface CanonicalizeHabitResponse {
    habit_category: string;
    confidence: number;
    suggested_template_id?: string;
}
interface SafetyRequest {
    user_input: string;
}
interface SafetyResponse {
    is_safe: boolean;
    flags?: string[];
    severity?: number;
    action?: string;
}
interface QuizFormRequest {
    habit_category: string;
    user_context?: string | undefined;
}
interface QuizFormResponse {
    questions: Array<{
        id: string;
        question: string;
        type: string;
        options?: string[];
    }>;
}
interface QuizSummaryRequest {
    answers: Record<string, string | string[]>;
    habit_category: string;
}
interface QuizSummaryResponse {
    summary: string;
    insights: string[];
    risk_level?: string;
}
interface Plan21DRequest {
    habit_goal: string;
    quiz_summary: string;
    user_context?: string | undefined;
}
interface Plan21DResponse {
    days: Array<{
        day_number: number;
        theme: string;
        tasks: Array<{
            title: string;
            kind: string;
            effort: number;
            meta?: Record<string, unknown>;
        }>;
        prompts?: string[];
    }>;
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
    reply: string;
    actions?: Array<{
        action: string;
        payload?: Record<string, unknown>;
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
    explanation: string;
    motivation: string;
}
/**
 * Start onboarding - Safety check + quiz form generation
 */
export declare function startOnboarding(request: OnboardingStartRequest): Promise<AIServiceResponse<OnboardingStartResponse>>;
/**
 * Canonicalize/classify a habit
 */
export declare function canonicalizeHabit(request: CanonicalizeHabitRequest): Promise<AIServiceResponse<CanonicalizeHabitResponse>>;
/**
 * Run safety assessment
 */
export declare function assessSafety(request: SafetyRequest): Promise<AIServiceResponse<SafetyResponse>>;
/**
 * Generate quiz form
 */
export declare function generateQuizForm(request: QuizFormRequest): Promise<AIServiceResponse<QuizFormResponse>>;
/**
 * Get quiz summary
 */
export declare function getQuizSummary(request: QuizSummaryRequest): Promise<AIServiceResponse<QuizSummaryResponse>>;
/**
 * Generate 21-day plan
 */
export declare function generatePlan21D(request: Plan21DRequest): Promise<AIServiceResponse<Plan21DResponse>>;
/**
 * AI coach chat
 */
export declare function chat(request: CoachRequest): Promise<AIServiceResponse<CoachResponse>>;
/**
 * Get explanation for a specific day
 */
export declare function explainDay(request: WhyDayRequest): Promise<AIServiceResponse<WhyDayResponse>>;
/**
 * Health check for AI service
 */
export declare function healthCheck(): Promise<AIServiceResponse<{
    status: string;
}>>;
export type { OnboardingStartRequest, OnboardingStartResponse, CanonicalizeHabitRequest, CanonicalizeHabitResponse, SafetyRequest, SafetyResponse, QuizFormRequest, QuizFormResponse, QuizSummaryRequest, QuizSummaryResponse, Plan21DRequest, Plan21DResponse, CoachRequest, CoachResponse, WhyDayRequest, WhyDayResponse, AIServiceResponse, };
//# sourceMappingURL=ai-client.service.d.ts.map