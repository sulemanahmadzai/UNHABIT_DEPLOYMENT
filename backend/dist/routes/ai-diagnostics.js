import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as AIDiagnosticsService from "../services/ai-diagnostics.service.js";
import { isValidUUID } from "../utils/validation.js";
const r = Router();
/**
 * POST /api/ai-diagnostics/quiz-form
 * Store quiz form data
 */
r.post("/quiz-form", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_habit_id: z.string().uuid().optional(),
            raw_input: z.string(),
            quiz_form: z.object({
                habit_name_guess: z.string(),
                questions: z.array(z.object({
                    id: z.string(),
                    question: z.string(),
                    helper_text: z.string().optional(),
                    options: z.array(z.object({
                        id: z.string(),
                        label: z.string(),
                    })),
                })),
            }),
        });
        const data = schema.parse(req.body);
        const diagnostic = await AIDiagnosticsService.storeQuizForm(req.user.id, data.user_habit_id, data.raw_input, data.quiz_form);
        res.status(201).json({ success: true, data: diagnostic });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai-diagnostics/quiz-summary
 * Store quiz summary data
 */
r.post("/quiz-summary", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_habit_id: z.string().uuid().optional(),
            raw_input: z.string(),
            quiz_summary: z.object({
                user_habit_raw: z.string(),
                canonical_habit_name: z.string(),
                habit_category: z.string().nullable(),
                category_confidence: z.enum(["low", "medium", "high"]),
                product_type: z.string().nullable(),
                severity_level: z.enum(["mild", "moderate", "severe"]),
                core_loop: z.string().optional(),
                primary_payoff: z.string().optional(),
                avoidance_target: z.string().optional(),
                identity_link: z.string().optional(),
                dopamine_profile: z.string().optional(),
                collapse_condition: z.string().optional(),
                long_term_cost: z.string().optional(),
            }),
            user_answers: z.record(z.string(), z.string()).optional(),
        });
        const data = schema.parse(req.body);
        const diagnostic = await AIDiagnosticsService.storeQuizSummary(req.user.id, data.user_habit_id, data.raw_input, data.quiz_summary, data.user_answers);
        res.status(201).json({ success: true, data: diagnostic });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai-diagnostics/safety
 * Store safety assessment data
 */
r.post("/safety", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_habit_id: z.string().uuid().optional(),
            raw_input: z.string(),
            safety: z.object({
                risk: z.enum(["none", "self_harm", "eating_disorder", "severe_addiction", "violence", "other"]),
                action: z.enum(["allow", "block_and_escalate"]),
                message: z.string(),
            }),
        });
        const data = schema.parse(req.body);
        const diagnostic = await AIDiagnosticsService.storeSafetyAssessment(req.user.id, data.user_habit_id, data.raw_input, data.safety);
        res.status(201).json({ success: true, data: diagnostic });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai-diagnostics/plan-21d
 * Store 21-day plan data
 */
r.post("/plan-21d", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_habit_id: z.string().uuid().optional(),
            raw_input: z.string(),
            plan: z.object({
                plan_summary: z.string(),
                day_tasks: z.record(z.string(), z.string()),
                day_whys: z.record(z.string(), z.string()).optional(),
            }),
        });
        const data = schema.parse(req.body);
        const diagnostic = await AIDiagnosticsService.store21DayPlan(req.user.id, data.user_habit_id, data.raw_input, data.plan);
        res.status(201).json({ success: true, data: diagnostic });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ai-diagnostics
 * Get user's AI diagnostics
 */
r.get("/", requireAuth, async (req, res, next) => {
    try {
        const userHabitId = req.query.user_habit_id;
        const type = req.query.type;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
        const diagnostics = await AIDiagnosticsService.getUserDiagnostics(req.user.id, {
            userHabitId,
            type,
            limit,
        });
        res.json({ success: true, data: diagnostics });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ai-diagnostics/:id
 * Get specific diagnostic by ID
 */
r.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const diagnosticId = req.params.id;
        if (!diagnosticId) {
            return res.status(400).json({ success: false, error: "Diagnostic ID is required" });
        }
        if (!isValidUUID(diagnosticId)) {
            return res.status(400).json({ success: false, error: "Invalid diagnostic ID format" });
        }
        const diagnostic = await AIDiagnosticsService.getDiagnosticById(req.user.id, diagnosticId);
        if (!diagnostic) {
            return res.status(404).json({ success: false, error: "Diagnostic not found" });
        }
        // Parse the summary for convenience
        let parsedData = null;
        if (diagnostic.parsed_summary) {
            try {
                parsedData = JSON.parse(diagnostic.parsed_summary);
            }
            catch {
                // Ignore parse errors
            }
        }
        res.json({
            success: true,
            data: {
                ...diagnostic,
                parsed_data: parsedData,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ai-diagnostics/habit/:habitId/latest/:type
 * Get latest diagnostic of a type for a habit
 */
r.get("/habit/:habitId/latest/:type", requireAuth, async (req, res, next) => {
    try {
        const { habitId, type } = req.params;
        if (!habitId || !type) {
            return res.status(400).json({ success: false, error: "Habit ID and type are required" });
        }
        if (!isValidUUID(habitId)) {
            return res.status(400).json({ success: false, error: "Invalid habit ID format" });
        }
        const validTypes = ["quiz_form", "quiz_summary", "safety_assessment", "plan_21d"];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
            });
        }
        const diagnostic = await AIDiagnosticsService.getLatestDiagnostic(req.user.id, habitId, type);
        if (!diagnostic) {
            return res.status(404).json({ success: false, error: "Diagnostic not found" });
        }
        res.json({ success: true, data: diagnostic });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=ai-diagnostics.js.map