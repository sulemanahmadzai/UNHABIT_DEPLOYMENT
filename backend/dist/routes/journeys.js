import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as JourneysService from "../services/journeys.service.js";
const r = Router();
/**
 * GET /api/journeys
 * List user's journeys
 */
r.get("/", requireAuth, async (req, res, next) => {
    try {
        const status = req.query.status || undefined;
        const journeys = await JourneysService.getUserJourneys(req.user.id, status);
        res.json({ success: true, data: journeys });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/journeys/:id
 * Get journey details with days
 */
r.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.id;
        if (!journeyId) {
            return res.status(400).json({ success: false, error: "Journey ID is required" });
        }
        const journey = await JourneysService.getJourneyById(req.user.id, journeyId);
        if (!journey) {
            return res.status(404).json({ success: false, error: "Journey not found" });
        }
        res.json({ success: true, data: journey });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/journeys
 * Create journey from AI plan
 */
r.post("/", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            user_habit_id: z.string().uuid(),
            blueprint_id: z.string().uuid().optional(),
            plan_data: z.object({
                days: z.array(z.object({
                    day_number: z.number().int().min(1).max(21),
                    theme: z.string().optional(),
                    tasks: z.array(z.object({
                        title: z.string(),
                        kind: z.string().optional(),
                        effort: z.number().int().min(1).max(5).optional(),
                        meta: z.record(z.string(), z.unknown()).optional(),
                    })),
                    prompts: z.array(z.string()).optional(),
                })),
            }),
            start_date: z.string().datetime().optional(),
        });
        const data = schema.parse(req.body);
        // Transform plan_data to handle undefined -> null conversions
        const planData = {
            days: data.plan_data.days.map((day) => ({
                day_number: day.day_number,
                theme: day.theme ?? null,
                tasks: day.tasks.map((task) => ({
                    title: task.title,
                    kind: task.kind ?? null,
                    effort: task.effort ?? null,
                    meta: task.meta ?? null,
                })),
                prompts: day.prompts ?? null,
            })),
        };
        const journey = await JourneysService.createJourney(req.user.id, {
            user_habit_id: data.user_habit_id,
            blueprint_id: data.blueprint_id ?? null,
            plan_data: planData,
            start_date: data.start_date ? new Date(data.start_date) : undefined,
        });
        res.status(201).json({ success: true, data: journey });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PUT /api/journeys/:id
 * Update journey (status, start_date)
 */
r.put("/:id", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.id;
        if (!journeyId) {
            return res.status(400).json({ success: false, error: "Journey ID is required" });
        }
        const schema = z.object({
            status: z.enum(["planned", "active", "paused", "completed", "cancelled"]).optional(),
            start_date: z.string().datetime().optional(),
        });
        const data = schema.parse(req.body);
        const journey = await JourneysService.updateJourney(req.user.id, journeyId, {
            status: data.status,
            start_date: data.start_date ? new Date(data.start_date) : undefined,
        });
        if (!journey) {
            return res.status(404).json({ success: false, error: "Journey not found" });
        }
        res.json({ success: true, data: journey });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/journeys/:id/days
 * Get all journey days
 */
r.get("/:id/days", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.id;
        if (!journeyId) {
            return res.status(400).json({ success: false, error: "Journey ID is required" });
        }
        const days = await JourneysService.getJourneyDays(req.user.id, journeyId);
        if (!days) {
            return res.status(404).json({ success: false, error: "Journey not found" });
        }
        res.json({ success: true, data: days });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/journeys/:id/days/:dayNumber
 * Get specific day with tasks
 */
r.get("/:id/days/:dayNumber", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.id;
        const dayNumberStr = req.params.dayNumber;
        if (!journeyId || !dayNumberStr) {
            return res.status(400).json({ success: false, error: "Journey ID and day number are required" });
        }
        const dayNumber = parseInt(dayNumberStr, 10);
        if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 21) {
            return res.status(400).json({ success: false, error: "Invalid day number" });
        }
        const day = await JourneysService.getJourneyDay(req.user.id, journeyId, dayNumber);
        if (!day) {
            return res.status(404).json({ success: false, error: "Journey day not found" });
        }
        res.json({ success: true, data: day });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/journeys/:id/start
 * Start journey
 */
r.post("/:id/start", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.id;
        if (!journeyId) {
            return res.status(400).json({ success: false, error: "Journey ID is required" });
        }
        const journey = await JourneysService.startJourney(req.user.id, journeyId);
        if (!journey) {
            return res.status(404).json({ success: false, error: "Journey not found" });
        }
        res.json({ success: true, data: journey });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/journeys/:id/pause
 * Pause journey
 */
r.post("/:id/pause", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.id;
        if (!journeyId) {
            return res.status(400).json({ success: false, error: "Journey ID is required" });
        }
        const journey = await JourneysService.pauseJourney(req.user.id, journeyId);
        if (!journey) {
            return res.status(404).json({ success: false, error: "Journey not found" });
        }
        res.json({ success: true, data: journey });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/journeys/:id/resume
 * Resume journey
 */
r.post("/:id/resume", requireAuth, async (req, res, next) => {
    try {
        const journeyId = req.params.id;
        if (!journeyId) {
            return res.status(400).json({ success: false, error: "Journey ID is required" });
        }
        const journey = await JourneysService.resumeJourney(req.user.id, journeyId);
        if (!journey) {
            return res.status(404).json({ success: false, error: "Journey not found" });
        }
        res.json({ success: true, data: journey });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=journeys.js.map