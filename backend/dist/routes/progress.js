import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as ProgressService from "../services/progress.service.js";
import * as BadgeAwardingService from "../services/badge-awarding.service.js";
import * as RewardsService from "../services/rewards.service.js";
import { getSettingValue } from "../services/admin.service.js";
import { notifyDailyCompletion } from "../services/notification-events.service.js";
const r = Router();
/**
 * POST /api/progress/tasks/:taskId/complete
 * Mark task as completed
 */
r.post("/tasks/:taskId/complete", requireAuth, async (req, res, next) => {
    try {
        const taskId = req.params.taskId;
        if (!taskId) {
            return res.status(400).json({ success: false, error: "Task ID is required" });
        }
        const result = await ProgressService.completeTask(req.user.id, taskId);
        if (!result) {
            return res.status(404).json({ success: false, error: "Task not found" });
        }
        // Award XP for task completion
        const xpPerTask = await getSettingValue("xp_per_task_completion", 10);
        await RewardsService.awardPoints(req.user.id, xpPerTask);
        // Check and award badges + update streak
        const badgeResult = await BadgeAwardingService.onTaskCompleted(req.user.id, taskId);
        res.json({
            success: true,
            data: result,
            xp_earned: xpPerTask,
            streak_updated: badgeResult.streak_updated,
            new_badges: badgeResult.new_badges,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/progress/tasks/:taskId/uncomplete
 * Mark task as not completed (undo)
 */
r.post("/tasks/:taskId/uncomplete", requireAuth, async (req, res, next) => {
    try {
        const taskId = req.params.taskId;
        if (!taskId) {
            return res.status(400).json({ success: false, error: "Task ID is required" });
        }
        const result = await ProgressService.uncompleteTask(req.user.id, taskId);
        if (!result) {
            return res.status(404).json({ success: false, error: "Task progress not found" });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/progress/tasks
 * Get user's task progress
 */
r.get("/tasks", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.query.journey_id || undefined;
        const progress = await ProgressService.getUserTaskProgress(req.user.id, journeyId);
        res.json({ success: true, data: progress });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/progress/journeys/:journeyId
 * Get journey progress summary
 */
r.get("/journeys/:journeyId", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.journeyId;
        if (!journeyId) {
            return res.status(400).json({ success: false, error: "Journey ID is required" });
        }
        const summary = await ProgressService.getJourneyProgressSummary(req.user.id, journeyId);
        if (!summary) {
            return res.status(404).json({ success: false, error: "Journey not found" });
        }
        res.json({ success: true, data: summary });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/progress/reflections
 * Submit daily reflection
 */
r.post("/reflections", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            journey_day_id: z.string().uuid(),
            content: z.string().optional(),
            answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
        });
        const data = schema.parse(req.body);
        const reflection = await ProgressService.submitReflection(req.user.id, {
            journey_day_id: data.journey_day_id,
            content: data.content ?? null,
            answers: data.answers ? data.answers : null,
        });
        res.status(201).json({ success: true, data: reflection });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/progress/reflections/:journeyDayId
 * Get reflection for day
 */
r.get("/reflections/:journeyDayId", requireAuth, async (req, res, next) => {
    try {
        const journeyDayId = req.params.journeyDayId;
        if (!journeyDayId) {
            return res.status(400).json({ success: false, error: "Journey Day ID is required" });
        }
        const reflection = await ProgressService.getReflection(req.user.id, journeyDayId);
        if (!reflection) {
            return res.status(404).json({ success: false, error: "Reflection not found" });
        }
        res.json({ success: true, data: reflection });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/progress/slips
 * Report slip event
 */
r.post("/slips", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_habit_id: z.string().uuid().optional(),
            happened_at: z.string().datetime(),
            context: z.record(z.string(), z.unknown()).optional(),
        });
        const data = schema.parse(req.body);
        const slip = await ProgressService.reportSlip(req.user.id, {
            user_habit_id: data.user_habit_id ?? null,
            happened_at: new Date(data.happened_at),
            context: data.context ?? null,
        });
        res.status(201).json({ success: true, data: slip });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/progress/slips
 * Get slip history
 */
r.get("/slips", requireAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const slips = await ProgressService.getSlipHistory(req.user.id, limit, offset);
        res.json({ success: true, data: slips });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/progress/today
 * Get today's tasks and progress
 */
r.get("/today", requireAuth, async (req, res, next) => {
    try {
        const progress = await ProgressService.getTodayProgress(req.user.id);
        res.json({ success: true, data: progress });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/progress/complete-day
 * Mark all today's tasks as complete
 */
r.post("/complete-day", requireAuth, async (req, res, next) => {
    try {
        const result = await ProgressService.completeDayTasks(req.user.id);
        // Best-effort push
        notifyDailyCompletion(req.user.id).catch(() => { });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/progress/snapshot
 * Get progress snapshot (XP, streak, habit health, next badge)
 */
r.get("/snapshot", requireAuth, async (req, res, next) => {
    try {
        const snapshot = await ProgressService.getProgressSnapshot(req.user.id);
        res.json({ success: true, data: snapshot });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=progress.js.map