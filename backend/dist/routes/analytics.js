import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as AnalyticsService from "../services/analytics.service.js";
const r = Router();
/**
 * GET /api/analytics/streaks
 * Get all streak types
 */
r.get("/streaks", requireAuth, async (req, res, next) => {
    try {
        const streaks = await AnalyticsService.getStreaks(req.user.id);
        res.json({ success: true, data: streaks });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/analytics/identity-score
 * Get identity score history
 */
r.get("/identity-score", requireAuth, async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const scores = await AnalyticsService.getIdentityScoreHistory(req.user.id, days);
        res.json({ success: true, data: scores });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/analytics/consistency
 * Get consistency index
 */
r.get("/consistency", requireAuth, async (req, res, next) => {
    try {
        const timeWindow = req.query.time_window || "weekly";
        const consistency = await AnalyticsService.getConsistencyIndex(req.user.id, timeWindow);
        res.json({ success: true, data: consistency });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/analytics/adherence/:journeyId
 * Get adherence scores for journey
 */
r.get("/adherence/:journeyId", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.journeyId;
        if (!journeyId) {
            return res.status(400).json({ success: false, error: "Journey ID is required" });
        }
        const scores = await AnalyticsService.getAdherenceScores(req.user.id, journeyId);
        if (!scores) {
            return res.status(404).json({ success: false, error: "Journey not found" });
        }
        res.json({ success: true, data: scores });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/analytics/insights
 * Get personalized insights
 */
r.get("/insights", requireAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const insights = await AnalyticsService.getInsights(req.user.id, limit);
        res.json({ success: true, data: insights });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/analytics/heatmap
 * Get trigger heatmap data
 */
r.get("/heatmap", requireAuth, async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const heatmap = await AnalyticsService.getTriggerHeatmap(req.user.id, days);
        res.json({ success: true, data: heatmap });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/analytics/daily-metrics
 * Get daily metrics
 */
r.get("/daily-metrics", requireAuth, async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const metrics = await AnalyticsService.getDailyMetrics(req.user.id, days);
        res.json({ success: true, data: metrics });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/analytics/export
 * Export user data (JSON/CSV)
 */
r.get("/export", requireAuth, async (req, res, next) => {
    try {
        const format = (req.query.format || "json");
        if (format !== "json" && format !== "csv") {
            return res.status(400).json({ success: false, error: "Format must be 'json' or 'csv'" });
        }
        const data = await AnalyticsService.exportUserData(req.user.id, format);
        if (format === "csv") {
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=unhabit_export.csv");
            res.send(data);
        }
        else {
            res.json({ success: true, data });
        }
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=analytics.js.map