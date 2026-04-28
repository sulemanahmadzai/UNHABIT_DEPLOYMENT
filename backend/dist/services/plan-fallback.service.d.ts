/**
 * Plan Fallback Service
 *
 * Generates a deterministic, personalised 21-day reduction plan WITHOUT
 * calling the LLM. Used as the instant response when:
 *   - the Redis cache misses, AND
 *   - the AI service does not return within the soft deadline
 *
 * The shape is intentionally identical to what the AI service `/plan-21d`
 * endpoint returns (Plan21DResponse) so the frontend doesn't have to branch
 * on the source.
 *
 * This is a pure function: ~1ms to compute, no network, no I/O.
 *
 * Behaviour mirrors the Python `_fallback_plan21` in `AI/ai_nodes.py` so that
 * the experience is consistent regardless of which side serves the fallback.
 */
export type DayTask = {
    title: string;
    description: string;
    reason: string;
    kind: "behavioral" | "cognitive" | "environmental" | "identity" | "reflection";
};
export interface FallbackPlan {
    plan_summary: string;
    day_tasks: Record<string, DayTask[]>;
}
interface FallbackContext {
    habit?: string | null | undefined;
    trigger?: string | null | undefined;
    motive?: string | null | undefined;
}
export declare function buildFallbackPlan(ctx?: FallbackContext): FallbackPlan;
/**
 * Extract fallback context from a parsed quiz_summary object.
 * Tolerant of missing/null fields.
 */
export declare function extractFallbackContext(quizSummary: unknown, habitGoal?: string): FallbackContext;
export {};
//# sourceMappingURL=plan-fallback.service.d.ts.map