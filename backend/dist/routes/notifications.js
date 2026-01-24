import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as NotificationsService from "../services/notifications.service.js";
const r = Router();
/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
r.get("/preferences", requireAuth, async (req, res, next) => {
    try {
        const prefs = await NotificationsService.getPreferences(req.user.id);
        res.json({ success: true, data: prefs });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PUT /api/notifications/preferences
 * Update preferences
 */
r.put("/preferences", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            enabled: z.boolean().optional(),
            max_per_day: z.number().int().min(0).max(20).optional(),
            escalate_to_buddy: z.boolean().optional(),
        });
        const parsed = schema.parse(req.body);
        const prefs = await NotificationsService.updatePreferences(req.user.id, {
            enabled: parsed.enabled,
            max_per_day: parsed.max_per_day,
            escalate_to_buddy: parsed.escalate_to_buddy,
        });
        res.json({ success: true, data: prefs });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/scheduled
 * Get scheduled nudges
 */
r.get("/scheduled", requireAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const nudges = await NotificationsService.getScheduledNudges(req.user.id, limit);
        res.json({ success: true, data: nudges });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/notifications/prime-time
 * Set prime time windows
 */
r.post("/prime-time", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            windows: z.array(z.object({
                dow: z.number().int().min(0).max(6), // 0 = Sunday
                start_minute: z.number().int().min(0).max(1439), // 0-1439 minutes
                end_minute: z.number().int().min(0).max(1439),
            })),
        });
        const { windows } = schema.parse(req.body);
        const result = await NotificationsService.setPrimeTimeWindows(req.user.id, windows);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/prime-time
 * Get prime time windows
 */
r.get("/prime-time", requireAuth, async (req, res, next) => {
    try {
        const windows = await NotificationsService.getPrimeTimeWindows(req.user.id);
        res.json({ success: true, data: windows });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/notifications/quiet-hours
 * Set quiet hours
 */
r.post("/quiet-hours", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            start_minute: z.number().int().min(0).max(1439),
            end_minute: z.number().int().min(0).max(1439),
        });
        const data = schema.parse(req.body);
        const result = await NotificationsService.setQuietHours(req.user.id, data);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/quiet-hours
 * Get quiet hours
 */
r.get("/quiet-hours", requireAuth, async (req, res, next) => {
    try {
        const hours = await NotificationsService.getQuietHours(req.user.id);
        res.json({ success: true, data: hours });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/history
 * Get notification delivery history
 */
r.get("/history", requireAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const history = await NotificationsService.getDeliveryHistory(req.user.id, limit, offset);
        res.json({ success: true, data: history });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=notifications.js.map