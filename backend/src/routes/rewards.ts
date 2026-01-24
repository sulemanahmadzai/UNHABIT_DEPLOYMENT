import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as RewardsService from "../services/rewards.service.js";

const r = Router();

/**
 * GET /api/rewards/points
 * Get point balance
 */
r.get("/points", requireAuth, async (req, res, next) => {
  try {
    const balance = await RewardsService.getPointBalance(req.user!.id);
    res.json({ success: true, data: balance });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/points/history
 * Get points ledger
 */
r.get("/points/history", requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await RewardsService.getPointsHistory(req.user!.id, limit, offset);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/badges
 * Get earned badges
 */
r.get("/badges", requireAuth, async (req, res, next) => {
  try {
    const badges = await RewardsService.getEarnedBadges(req.user!.id);
    res.json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/badges/available
 * Get all available badges (earned and unearned)
 */
r.get("/badges/available", requireAuth, async (req, res, next) => {
  try {
    const badges = await RewardsService.getAllBadges(req.user!.id);
    res.json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/available
 * Get available rewards
 */
r.get("/available", requireAuth, async (req, res, next) => {
  try {
    const rewards = await RewardsService.getAvailableRewards(req.user!.id);
    res.json({ success: true, data: rewards });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/earned
 * Get earned rewards
 */
r.get("/earned", requireAuth, async (req, res, next) => {
  try {
    const rewards = await RewardsService.getEarnedRewards(req.user!.id);
    res.json({ success: true, data: rewards });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/xp/today
 * Get today's XP earned
 */
r.get("/xp/today", requireAuth, async (req, res, next) => {
  try {
    const xp = await RewardsService.getTodayXP(req.user!.id);
    res.json({ success: true, data: xp });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/level
 * Get user level and progress
 */
r.get("/level", requireAuth, async (req, res, next) => {
  try {
    const level = await RewardsService.getLevelInfo(req.user!.id);
    res.json({ success: true, data: level });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/badges/gallery
 * Get badge gallery with progress
 */
r.get("/badges/gallery", requireAuth, async (req, res, next) => {
  try {
    const gallery = await RewardsService.getBadgeGallery(req.user!.id);
    res.json({ success: true, data: gallery });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rewards/badges/next
 * Get next badge to earn
 */
r.get("/badges/next", requireAuth, async (req, res, next) => {
  try {
    const nextBadge = await RewardsService.getNextBadge(req.user!.id);
    res.json({ success: true, data: nextBadge });
  } catch (error) {
    next(error);
  }
});

export default r;













