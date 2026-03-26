import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as RecoveryService from "../services/recovery.service.js";
const r = Router();
/**
 * GET /api/recovery/status
 * Check if user missed a day and needs to recover
 */
r.get("/status", requireAuth, async (req, res, next) => {
    try {
        const status = await RecoveryService.checkMissedDay(req.user.id);
        res.json({ success: true, data: status });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/recovery/continue-with-penalty
 * Continue with penalty (reset streak, reduce XP)
 */
r.post("/continue-with-penalty", requireAuth, async (req, res, next) => {
    try {
        const result = await RecoveryService.continueWithPenalty(req.user.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/recovery/use-protection
 * Use streak protection (freeze token)
 */
r.post("/use-protection", requireAuth, async (req, res, next) => {
    try {
        const result = await RecoveryService.useProtection(req.user.id);
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
 * POST /api/recovery/restart-plan
 * Restart 21-Day Plan (fresh start, keep XP)
 */
r.post("/restart-plan", requireAuth, async (req, res, next) => {
    try {
        const result = await RecoveryService.restartPlan(req.user.id);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=recovery.js.map