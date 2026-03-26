import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as FocusService from "../services/focus.service.js";
import { removeUndefined } from "../utils/object.js";
const r = Router();
/**
 * POST /api/focus/start
 * Start a focus session
 */
r.post("/start", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            duration_mins: z.number().int().min(1).max(180),
            journey_day_id: z.string().uuid().optional(),
        });
        const data = schema.parse(req.body);
        // Check if there's already an active session
        const activeSession = await FocusService.getActiveSession(req.user.id);
        if (activeSession) {
            return res.status(400).json({
                success: false,
                error: "Already have an active focus session",
                active_session: activeSession,
            });
        }
        const session = await FocusService.startSession(req.user.id, removeUndefined(data));
        res.status(201).json({ success: true, data: session });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/focus/stop
 * Stop/complete a focus session
 */
r.post("/stop", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            session_id: z.string().uuid(),
        });
        const { session_id } = schema.parse(req.body);
        const result = await FocusService.stopSession(req.user.id, session_id);
        if (!result) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/focus/log
 * Log a completed focus session (for offline/manual logging)
 */
r.post("/log", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            duration_mins: z.number().int().min(1).max(180),
            journey_day_id: z.string().uuid().optional(),
            started_at: z.string().datetime().optional(),
        });
        const data = schema.parse(req.body);
        const result = await FocusService.logSession(req.user.id, removeUndefined({
            duration_mins: data.duration_mins,
            journey_day_id: data.journey_day_id,
            started_at: data.started_at ? new Date(data.started_at) : undefined,
        }));
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/focus/history
 * Get focus session history
 */
r.get("/history", requireAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const offset = parseInt(req.query.offset) || 0;
        const sessions = await FocusService.getHistory(req.user.id, limit, offset);
        res.json({ success: true, data: sessions });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/focus/stats
 * Get focus stats summary
 */
r.get("/stats", requireAuth, async (req, res, next) => {
    try {
        const stats = await FocusService.getStats(req.user.id);
        res.json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/focus/active
 * Get active focus session (if any)
 */
r.get("/active", requireAuth, async (req, res, next) => {
    try {
        const session = await FocusService.getActiveSession(req.user.id);
        res.json({ success: true, data: session });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/focus/cancel
 * Cancel an active focus session (no XP awarded, session is deleted)
 */
r.post("/cancel", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            session_id: z.string().uuid(),
        });
        const { session_id } = schema.parse(req.body);
        const result = await FocusService.cancelSession(req.user.id, session_id);
        if (!result) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=focus.js.map