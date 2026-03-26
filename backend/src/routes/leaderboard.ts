import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as LeaderboardService from "../services/leaderboard.service.js";

const r = Router();

/**
 * GET /api/leaderboard
 * Get leaderboard (defaults to friends)
 */
r.get("/", requireAuth, async (req, res, next) => {
  try {
    const type = (req.query.type as string) || "friends";
    const limit = parseInt(req.query.limit as string) || 20;

    let result;
    switch (type) {
      case "daily":
        result = await LeaderboardService.getDailyLeaderboard(req.user!.id, limit);
        break;
      case "weekly":
        result = await LeaderboardService.getWeeklyLeaderboard(req.user!.id, limit);
        break;
      case "friends":
      default:
        result = await LeaderboardService.getFriendsLeaderboard(req.user!.id);
        break;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/leaderboard/daily
 * Get daily leaderboard
 */
r.get("/daily", requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await LeaderboardService.getDailyLeaderboard(req.user!.id, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/leaderboard/weekly
 * Get weekly leaderboard
 */
r.get("/weekly", requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await LeaderboardService.getWeeklyLeaderboard(req.user!.id, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/leaderboard/friends
 * Get friends (buddies) leaderboard
 */
r.get("/friends", requireAuth, async (req, res, next) => {
  try {
    const result = await LeaderboardService.getFriendsLeaderboard(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/leaderboard/my-rank
 * Get current user's rank summary
 */
r.get("/my-rank", requireAuth, async (req, res, next) => {
  try {
    const result = await LeaderboardService.getMyRank(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default r;
