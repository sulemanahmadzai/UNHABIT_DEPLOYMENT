import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";
/**
 * Create a new AI diagnostic entry
 */
export async function createDiagnostic(userId, data) {
    return db.ai_diagnostics.create({
        data: {
            user_id: userId,
            user_habit_id: data.user_habit_id || null,
            raw_input: data.raw_input,
            model: data.model || "gpt-4o",
            parsed_summary: data.parsed_summary || null,
            scores: data.scores ? data.scores : Prisma.JsonNull,
        },
    });
}
/**
 * Store quiz form data
 */
export async function storeQuizForm(userId, userHabitId, rawInput, quizForm) {
    return db.ai_diagnostics.create({
        data: {
            user_id: userId,
            user_habit_id: userHabitId || null,
            raw_input: rawInput,
            model: "gpt-4o",
            parsed_summary: JSON.stringify({
                type: "quiz_form",
                data: quizForm,
            }),
            scores: Prisma.JsonNull,
        },
    });
}
/**
 * Store quiz summary data
 */
export async function storeQuizSummary(userId, userHabitId, rawInput, quizSummary, userAnswers) {
    // Extract severity and confidence as scores
    const scores = {
        severity_level: quizSummary.severity_level,
        category_confidence: quizSummary.category_confidence,
    };
    return db.ai_diagnostics.create({
        data: {
            user_id: userId,
            user_habit_id: userHabitId || null,
            raw_input: rawInput,
            model: "gpt-4o",
            parsed_summary: JSON.stringify({
                type: "quiz_summary",
                data: quizSummary,
                user_answers: userAnswers || null,
            }),
            scores: scores,
        },
    });
}
/**
 * Store safety assessment data
 */
export async function storeSafetyAssessment(userId, userHabitId, rawInput, safety) {
    return db.ai_diagnostics.create({
        data: {
            user_id: userId,
            user_habit_id: userHabitId || null,
            raw_input: rawInput,
            model: "gpt-4o",
            parsed_summary: JSON.stringify({
                type: "safety_assessment",
                data: safety,
            }),
            scores: {
                risk_level: safety.risk,
                blocked: safety.action === "block_and_escalate",
            },
        },
    });
}
/**
 * Store 21-day plan data
 */
export async function store21DayPlan(userId, userHabitId, rawInput, plan) {
    return db.ai_diagnostics.create({
        data: {
            user_id: userId,
            user_habit_id: userHabitId || null,
            raw_input: rawInput,
            model: "gpt-4o",
            parsed_summary: JSON.stringify({
                type: "plan_21d",
                data: plan,
            }),
            scores: {
                total_days: Object.keys(plan.day_tasks).length,
            },
        },
    });
}
/**
 * Get diagnostics for a user
 */
export async function getUserDiagnostics(userId, options) {
    const diagnostics = await db.ai_diagnostics.findMany({
        where: {
            user_id: userId,
            ...(options?.userHabitId && { user_habit_id: options.userHabitId }),
        },
        orderBy: { created_at: "desc" },
        take: options?.limit || 50,
    });
    // Filter by type if specified
    if (options?.type) {
        return diagnostics.filter(d => {
            if (!d.parsed_summary)
                return false;
            try {
                const parsed = JSON.parse(d.parsed_summary);
                return parsed.type === options.type;
            }
            catch {
                return false;
            }
        });
    }
    return diagnostics;
}
/**
 * Get a specific diagnostic by ID
 */
export async function getDiagnosticById(userId, diagnosticId) {
    return db.ai_diagnostics.findFirst({
        where: {
            id: diagnosticId,
            user_id: userId,
        },
    });
}
/**
 * Get the latest diagnostic of a specific type for a habit
 */
export async function getLatestDiagnostic(userId, userHabitId, type) {
    const diagnostics = await db.ai_diagnostics.findMany({
        where: {
            user_id: userId,
            user_habit_id: userHabitId,
        },
        orderBy: { created_at: "desc" },
    });
    for (const d of diagnostics) {
        if (!d.parsed_summary)
            continue;
        try {
            const parsed = JSON.parse(d.parsed_summary);
            if (parsed.type === type) {
                return {
                    ...d,
                    parsed_data: parsed.data,
                };
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
//# sourceMappingURL=ai-diagnostics.service.js.map