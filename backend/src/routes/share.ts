import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as ShareService from "../services/share.service.js";

const r = Router();

/**
 * POST /api/share/progress
 * Generate shareable progress link
 */
r.post("/progress", requireAuth, async (req, res, next) => {
  try {
    const shareData = await ShareService.generateProgressShare(req.user!.id);
    res.json({ success: true, data: shareData });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/share/achievement
 * Generate shareable achievement link
 */
r.post("/achievement", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      type: z.enum(["badge", "streak", "level", "journey_complete"]),
      achievement_id: z.string().uuid().optional(),
    });
    const { type, achievement_id } = schema.parse(req.body);

    const shareData = await ShareService.generateAchievementShare(
      req.user!.id,
      type,
      achievement_id
    );
    res.json({ success: true, data: shareData });
  } catch (error) {
    next(error);
  }
});

export default r;
