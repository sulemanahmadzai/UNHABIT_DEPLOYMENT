import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as ChallengesService from "../services/challenges.service.js";
const r = Router();
/**
 * GET /api/challenges/daily
 * Get today's daily challenge
 */
r.get("/daily", requireAuth, async (req, res, next) => {
    try {
        const challenge = await ChallengesService.getDailyChallenge(req.user.id);
        if (!challenge) {
            return res.status(404).json({
                success: false,
                error: "No challenge available. Start a journey to get challenges!",
            });
        }
        res.json({ success: true, data: challenge });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/challenges/:id/accept
 * Accept a daily challenge
 */
r.post("/:id/accept", requireAuth, async (req, res, next) => {
    try {
        const challengeId = req.params.id;
        if (!challengeId) {
            return res.status(400).json({ success: false, error: "Challenge ID is required" });
        }
        const result = await ChallengesService.acceptChallenge(req.user.id, challengeId);
        if (!result) {
            return res.status(404).json({ success: false, error: "Challenge not found or expired" });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/challenges/:id/complete
 * Complete a challenge and get reward
 */
r.post("/:id/complete", requireAuth, async (req, res, next) => {
    try {
        const challengeId = req.params.id;
        if (!challengeId) {
            return res.status(400).json({ success: false, error: "Challenge ID is required" });
        }
        const result = await ChallengesService.completeChallenge(req.user.id, challengeId);
        if (!result) {
            return res.status(404).json({ success: false, error: "Challenge not found or already completed" });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=challenges.js.map