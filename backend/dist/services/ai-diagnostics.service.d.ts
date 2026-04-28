import { Prisma } from "@prisma/client";
/**
 * AI Diagnostics Service
 * Stores quiz summaries, quiz forms, safety assessments, and other AI-generated data
 */
interface QuizFormData {
    habit_name_guess: string;
    questions: Array<{
        id: string;
        question: string;
        helper_text?: string | undefined;
        options: Array<{
            id: string;
            label: string;
        }>;
    }>;
}
interface QuizSummaryData {
    user_habit_raw: string;
    canonical_habit_name: string;
    habit_category: string | null;
    category_confidence: "low" | "medium" | "high";
    product_type: string | null;
    severity_level: "mild" | "moderate" | "severe";
    core_loop?: string | undefined;
    primary_payoff?: string | undefined;
    avoidance_target?: string | undefined;
    identity_link?: string | undefined;
    dopamine_profile?: string | undefined;
    collapse_condition?: string | undefined;
    long_term_cost?: string | undefined;
}
interface SafetyData {
    risk: "none" | "self_harm" | "eating_disorder" | "severe_addiction" | "violence" | "other";
    action: "allow" | "block_and_escalate";
    message: string;
}
interface Plan21DData {
    plan_summary: string;
    day_tasks: Record<string, string>;
    day_whys?: Record<string, string> | undefined;
}
interface CreateDiagnosticInput {
    user_habit_id?: string;
    raw_input: string;
    model?: string;
    parsed_summary?: string;
    scores?: Record<string, unknown>;
}
/**
 * Create a new AI diagnostic entry
 */
export declare function createDiagnostic(userId: string, data: CreateDiagnosticInput): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    user_habit_id: string | null;
    raw_input: string;
    model: string | null;
    parsed_summary: string | null;
    scores: Prisma.JsonValue | null;
}>;
/**
 * Store quiz form data
 */
export declare function storeQuizForm(userId: string, userHabitId: string | undefined, rawInput: string, quizForm: QuizFormData): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    user_habit_id: string | null;
    raw_input: string;
    model: string | null;
    parsed_summary: string | null;
    scores: Prisma.JsonValue | null;
}>;
/**
 * Store quiz summary data
 */
export declare function storeQuizSummary(userId: string, userHabitId: string | undefined, rawInput: string, quizSummary: QuizSummaryData, userAnswers?: Record<string, unknown>): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    user_habit_id: string | null;
    raw_input: string;
    model: string | null;
    parsed_summary: string | null;
    scores: Prisma.JsonValue | null;
}>;
/**
 * Store safety assessment data
 */
export declare function storeSafetyAssessment(userId: string, userHabitId: string | undefined, rawInput: string, safety: SafetyData): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    user_habit_id: string | null;
    raw_input: string;
    model: string | null;
    parsed_summary: string | null;
    scores: Prisma.JsonValue | null;
}>;
/**
 * Store 21-day plan data
 */
export declare function store21DayPlan(userId: string, userHabitId: string | undefined, rawInput: string, plan: Plan21DData): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    user_habit_id: string | null;
    raw_input: string;
    model: string | null;
    parsed_summary: string | null;
    scores: Prisma.JsonValue | null;
}>;
/**
 * Get diagnostics for a user
 */
export declare function getUserDiagnostics(userId: string, options?: {
    userHabitId?: string | undefined;
    type?: "quiz_form" | "quiz_summary" | "safety_assessment" | "plan_21d" | undefined;
    limit?: number | undefined;
}): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    user_habit_id: string | null;
    raw_input: string;
    model: string | null;
    parsed_summary: string | null;
    scores: Prisma.JsonValue | null;
}[]>;
/**
 * Get a specific diagnostic by ID
 */
export declare function getDiagnosticById(userId: string, diagnosticId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    user_habit_id: string | null;
    raw_input: string;
    model: string | null;
    parsed_summary: string | null;
    scores: Prisma.JsonValue | null;
} | null>;
/**
 * Get the latest diagnostic of a specific type for a habit
 */
export declare function getLatestDiagnostic(userId: string, userHabitId: string, type: "quiz_form" | "quiz_summary" | "safety_assessment" | "plan_21d"): Promise<{
    parsed_data: any;
    user_id: string;
    created_at: Date;
    id: string;
    user_habit_id: string | null;
    raw_input: string;
    model: string | null;
    parsed_summary: string | null;
    scores: Prisma.JsonValue | null;
} | null>;
export {};
//# sourceMappingURL=ai-diagnostics.service.d.ts.map