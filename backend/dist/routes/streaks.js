import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as StreaksService from "../services/streaks.service.js";
import * as Scenarios from "../services/notification-scenarios.service.js";
const r = Router();
/**
 * GET /api/streaks/details
 * Get detailed streak information with calendar
 */
r.get("/details", requireAuth, async (req, res, next) => {
    try {
        const details = await StreaksService.getStreakDetails(req.user.id);
        res.json({ success: true, data: details });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/streaks/freeze
 * Use a streak freeze
 */
r.post("/freeze", requireAuth, async (req, res, next) => {
    try {
        const result = await StreaksService.useStreakFreeze(req.user.id);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }
        Scenarios.notifyStreakFreezeUsed(req.user.id).catch(() => { });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/streaks/freeze/purchase
 * Purchase a streak freeze with XP
 */
r.post("/freeze/purchase", requireAuth, async (req, res, next) => {
    try {
        const result = await StreaksService.purchaseStreakFreeze(req.user.id);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/streaks/status
 * Get streak at risk status
 */
r.get("/status", requireAuth, async (req, res, next) => {
    try {
        const status = await StreaksService.getStreakAtRiskStatus(req.user.id);
        res.json({ success: true, data: status });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/streaks/habit-health
 * Get habit health score
 */
r.get("/habit-health", requireAuth, async (req, res, next) => {
    try {
        const health = await StreaksService.getHabitHealth(req.user.id);
        res.json({ success: true, data: health });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/streaks/freeze/available
 * Get calculated available freezes based on XP and consistency
 */
r.get("/freeze/available", requireAuth, async (req, res, next) => {
    try {
        const available = await StreaksService.calculateAvailableFreezes(req.user.id);
        res.json({ success: true, data: { available_freezes: available } });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/streaks/reset
 * Reset streak to 0 (Continue with penalty option)
 * Used when user missed a day and chooses to accept the penalty & restart streak count
 */
r.post("/reset", requireAuth, async (req, res, next) => {
    try {
        const result = await StreaksService.resetStreak(req.user.id);
        res.json({
            success: true,
            message: result.message,
            data: { current_streak: result.current_streak },
        });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=streaks.js.map