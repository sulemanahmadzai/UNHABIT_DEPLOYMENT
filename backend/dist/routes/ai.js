import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as AIClient from "../services/ai-client.service.js";
const r = Router();
/**
 * POST /api/ai/onboarding/start
 * Start onboarding (proxies to AI service)
 */
r.post("/onboarding/start", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_input: z.string().min(1).max(2000),
        });
        const data = schema.parse(req.body);
        const result = await AIClient.startOnboarding(data);
        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: "AI service unavailable",
                message: result.error,
            });
        }
        res.json({ success: true, data: result.data });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai/canonicalize-habit
 * Classify/canonicalize a habit
 */
r.post("/canonicalize-habit", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_input: z.string().min(1).max(1000),
        });
        const data = schema.parse(req.body);
        const result = await AIClient.canonicalizeHabit(data);
        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: "AI service unavailable",
                message: result.error,
            });
        }
        res.json({ success: true, data: result.data });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai/safety
 * Run safety assessment
 */
r.post("/safety", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_input: z.string().min(1).max(2000),
        });
        const data = schema.parse(req.body);
        const result = await AIClient.assessSafety(data);
        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: "AI service unavailable",
                message: result.error,
            });
        }
        res.json({ success: true, data: result.data });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai/quiz-form
 * Generate quiz form
 */
r.post("/quiz-form", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            habit_category: z.string().min(1),
            user_context: z.string().optional(),
        });
        const data = schema.parse(req.body);
        const result = await AIClient.generateQuizForm({
            habit_category: data.habit_category,
            user_context: data.user_context,
        });
        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: "AI service unavailable",
                message: result.error,
            });
        }
        res.json({ success: true, data: result.data });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai/quiz-summary
 * Get quiz summary (proxies to AI service)
 */
r.post("/quiz-summary", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
            habit_category: z.string().min(1),
        });
        const data = schema.parse(req.body);
        const result = await AIClient.getQuizSummary({
            answers: data.answers,
            habit_category: data.habit_category,
        });
        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: "AI service unavailable",
                message: result.error,
            });
        }
        res.json({ success: true, data: result.data });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai/plan-21d
 * Generate plan (proxies to AI service)
 */
r.post("/plan-21d", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            habit_goal: z.string().min(1).max(500),
            quiz_summary: z.string().min(1),
            user_context: z.string().optional(),
        });
        const data = schema.parse(req.body);
        const result = await AIClient.generatePlan21D({
            habit_goal: data.habit_goal,
            quiz_summary: data.quiz_summary,
            user_context: data.user_context,
        });
        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: "AI service unavailable",
                message: result.error,
            });
        }
        res.json({ success: true, data: result.data });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai/coach
 * AI coach chat (proxies to AI service)
 */
r.post("/coach", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            message: z.string().min(1).max(2000),
            session_history: z
                .array(z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
            }))
                .optional(),
            context: z
                .object({
                journey_day: z.number().int().optional(),
                current_streak: z.number().int().optional(),
                recent_slip: z.boolean().optional(),
            })
                .optional(),
        });
        const data = schema.parse(req.body);
        const result = await AIClient.chat({
            message: data.message,
            session_history: data.session_history,
            context: data.context,
        });
        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: "AI service unavailable",
                message: result.error,
            });
        }
        res.json({ success: true, data: result.data });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ai/why-day
 * Get day explanation (proxies to AI service)
 */
r.post("/why-day", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            day_number: z.number().int().min(1).max(21),
            day_theme: z.string().min(1),
            day_tasks: z.array(z.object({
                title: z.string(),
                kind: z.string(),
            })),
            habit_goal: z.string().min(1),
        });
        const data = schema.parse(req.body);
        const result = await AIClient.explainDay(data);
        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: "AI service unavailable",
                message: result.error,
            });
        }
        res.json({ success: true, data: result.data });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ai/health
 * Check AI service health
 */
r.get("/health", async (_req, res) => {
    const result = await AIClient.healthCheck();
    res.json({
        success: result.success,
        ai_service: result.success ? "healthy" : "unavailable",
        error: result.error,
    });
});
export default r;
//# sourceMappingURL=ai.js.map