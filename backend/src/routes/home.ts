import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as HomeService from "../services/home.service.js";

const r = Router();

/**
 * GET /api/home/dashboard
 * Get aggregated home dashboard data
 */
r.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const dashboard = await HomeService.getDashboard(req.user!.id);
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    // Handle Prisma connection pool errors gracefully
    if (error.message && error.message.includes('connection pool')) {
      return res.status(503).json({
        success: false,
        error: 'Database connection pool exhausted. Please try again.',
      });
    }
    next(error);
  }
});

/**
 * GET /api/home/streak-status
 * Get streak at risk status
 */
r.get("/streak-status", requireAuth, async (req, res, next) => {
  try {
    const status = await HomeService.getStreakAtRiskStatus(req.user!.id);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

export default r;
