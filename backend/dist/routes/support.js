/**
 * Support Routes
 * Handles user feedback submissions
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "../lib/services.js";
const r = Router();
/**
 * POST /api/support/feedback
 * Submit user feedback
 * Body: { message: string, category?: string, rating?: number }
 */
r.post("/feedback", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            message: z.string().min(1, "Message is required").max(5000),
            category: z.string().max(100).optional(),
            rating: z.number().int().min(1).max(5).optional(),
        });
        const data = schema.parse(req.body);
        // Store feedback in the database using the analytics_events table
        // (reuses existing infrastructure — no new table migration needed)
        const feedback = await db.analytics_events.create({
            data: {
                user_id: req.user.id,
                event_type: "user_feedback",
                props: {
                    message: data.message,
                    category: data.category ?? null,
                    rating: data.rating ?? null,
                },
            },
        });
        // Log to console so admins can monitor via server logs
        console.log(`📝 Feedback received from user ${req.user.id}:`, {
            category: data.category,
            rating: data.rating,
            message: data.message.substring(0, 100),
        });
        res.status(201).json({
            success: true,
            message: "Feedback submitted successfully. Thank you!",
            data: {
                id: feedback.id,
                submitted_at: feedback.created_at,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/support/feedback
 * Get current user's submitted feedback history
 */
r.get("/feedback", requireAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const feedbackList = await db.analytics_events.findMany({
            where: {
                user_id: req.user.id,
                event_type: "user_feedback",
            },
            orderBy: { created_at: "desc" },
            take: limit,
        });
        res.json({
            success: true,
            data: feedbackList.map((f) => ({
                id: f.id,
                ...f.props,
                submitted_at: f.created_at,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=support.js.map