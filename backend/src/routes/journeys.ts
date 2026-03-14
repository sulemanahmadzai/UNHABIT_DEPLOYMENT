import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as JourneysService from "../services/journeys.service.js";

const r = Router();

/**
 * Transform AI plan's day_tasks format to journey's days array format
 * AI returns: { day_tasks: { day_1: [{title, description, kind}, ...], ... }, day_whys?: {...} }
 * Journey expects: { days: [{ day_number: 1, tasks: [{title, kind, effort, meta}] }] }
 */
type AITaskEntry = string | Array<{ title: string; description?: string | undefined; kind?: string | undefined }>;

function transformAIPlanToJourneyDays(aiPlan: {
  day_tasks: Record<string, AITaskEntry>;
  day_whys?: Record<string, string> | undefined;
  plan_summary?: string | undefined;
}): { days: Array<{ day_number: number; theme: string | null; tasks: Array<{ title: string; kind: string | null; effort: number | null; meta: Record<string, unknown> | null }>; prompts: string[] | null }> } {
  const dayTasks = aiPlan.day_tasks || {};
  const dayWhys = aiPlan.day_whys || {};

  const dayNumbers = Object.keys(dayTasks)
    .map(key => {
      const match = key.match(/day_(\d+)/);
      return match && match[1] ? parseInt(match[1], 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const days = dayNumbers.map(dayNum => {
    const rawTasks = dayTasks[`day_${dayNum}`];
    const whyText = dayWhys[`day_${dayNum}`] || null;

    let theme: string | null = null;
    if (dayNum <= 7) theme = "Awareness & Observation";
    else if (dayNum <= 14) theme = "Pattern Breaking";
    else theme = "Identity Building";

    const effort = dayNum <= 7 ? 2 : dayNum <= 14 ? 3 : 4;

    let tasks: Array<{ title: string; kind: string | null; effort: number | null; meta: Record<string, unknown> | null }>;

    if (Array.isArray(rawTasks)) {
      tasks = rawTasks.map(t => ({
        title: t.title,
        kind: t.kind || "daily_action",
        effort,
        meta: {
          ...(t.description ? { description: t.description } : {}),
          ...(whyText ? { why: whyText } : {}),
        },
      }));
    } else {
      tasks = [{
        title: typeof rawTasks === "string" ? rawTasks : "",
        kind: "daily_action",
        effort,
        meta: whyText ? { why: whyText } : null,
      }];
    }

    return {
      day_number: dayNum,
      theme,
      tasks,
      prompts: whyText ? [whyText] : null,
    };
  });

  return { days };
}

/**
 * GET /api/journeys
 * List user's journeys
 */
r.get("/", requireAuth, async (req, res, next) => {
  try {
    const status = (req.query.status as string) || undefined;
    const journeys = await JourneysService.getUserJourneys(req.user!.id, status);
    res.json({ success: true, data: journeys });
  } catch (error) {
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
    const journey = await JourneysService.getJourneyById(req.user!.id, journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }
    res.json({ success: true, data: journey });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/journeys
 * Create journey from plan data
 * Accepts BOTH formats:
 * 1. Standard format: { plan_data: { days: [...] } }
 * 2. AI format: { plan_data: { day_tasks: {...}, day_whys?: {...}, plan_summary?: "..." } }
 */
r.post("/", requireAuth, async (req, res, next) => {
  try {
    // Check if input is AI format (has day_tasks) or standard format (has days)
    const isAIFormat = req.body.plan_data && 'day_tasks' in req.body.plan_data && !('days' in req.body.plan_data);
    
    let planData: { days: Array<{ day_number: number; theme: string | null; tasks: Array<{ title: string; kind: string | null; effort: number | null; meta: Record<string, unknown> | null }>; prompts: string[] | null }> };
    let userHabitId: string;
    let blueprintId: string | null = null;
    let startDate: Date | undefined;

    if (isAIFormat) {
      const aiTaskEntry = z.union([
        z.string(),
        z.array(z.object({ title: z.string(), description: z.string().optional(), kind: z.string().optional() })),
      ]);
      const aiSchema = z.object({
        user_habit_id: z.string().uuid(),
        blueprint_id: z.string().uuid().optional(),
        plan_data: z.object({
          plan_summary: z.string().optional(),
          day_tasks: z.record(z.string(), aiTaskEntry),
          day_whys: z.record(z.string(), z.string()).optional(),
        }),
        start_date: z.string().datetime().optional(),
      });
      const data = aiSchema.parse(req.body);
      
      // Transform AI format to standard format
      const aiPlanInput = {
        day_tasks: data.plan_data.day_tasks,
        ...(data.plan_data.day_whys !== undefined && { day_whys: data.plan_data.day_whys }),
        ...(data.plan_data.plan_summary !== undefined && { plan_summary: data.plan_data.plan_summary }),
      };
      planData = transformAIPlanToJourneyDays(aiPlanInput);
      userHabitId = data.user_habit_id;
      blueprintId = data.blueprint_id ?? null;
      startDate = data.start_date ? new Date(data.start_date) : undefined;
    } else {
      // Standard format schema
      const standardSchema = z.object({
        user_habit_id: z.string().uuid(),
        blueprint_id: z.string().uuid().optional(),
        plan_data: z.object({
          days: z.array(
            z.object({
              day_number: z.number().int().min(1).max(21),
              theme: z.string().optional(),
              tasks: z.array(
                z.object({
                  title: z.string(),
                  kind: z.string().optional(),
                  effort: z.number().int().min(1).max(5).optional(),
                  meta: z.record(z.string(), z.unknown()).optional(),
                })
              ),
              prompts: z.array(z.string()).optional(),
            })
          ),
        }),
        start_date: z.string().datetime().optional(),
      });
      const data = standardSchema.parse(req.body);

      // Transform plan_data to handle undefined -> null conversions
      planData = {
        days: data.plan_data.days.map((day) => ({
          day_number: day.day_number,
          theme: day.theme ?? null,
          tasks: day.tasks.map((task) => ({
            title: task.title,
            kind: task.kind ?? null,
            effort: task.effort ?? null,
            meta: (task.meta as Record<string, unknown>) ?? null,
          })),
          prompts: day.prompts ?? null,
        })),
      };
      userHabitId = data.user_habit_id;
      blueprintId = data.blueprint_id ?? null;
      startDate = data.start_date ? new Date(data.start_date) : undefined;
    }

    const journey = await JourneysService.createJourney(req.user!.id, {
      user_habit_id: userHabitId,
      blueprint_id: blueprintId,
      plan_data: planData,
      start_date: startDate,
    });

    res.status(201).json({ success: true, data: journey });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/journeys/from-ai-plan
 * Create journey directly from AI plan format
 * Automatically transforms day_tasks to days array
 */
r.post("/from-ai-plan", requireAuth, async (req, res, next) => {
  try {
    const aiTaskEntry = z.union([
      z.string(),
      z.array(z.object({ title: z.string(), description: z.string().optional(), kind: z.string().optional() })),
    ]);
    const schema = z.object({
      user_habit_id: z.string().uuid(),
      blueprint_id: z.string().uuid().optional(),
      ai_plan: z.object({
        plan_summary: z.string().optional(),
        day_tasks: z.record(z.string(), aiTaskEntry),
        day_whys: z.record(z.string(), z.string()).optional(),
      }),
      start_date: z.string().datetime().optional(),
    });
    const data = schema.parse(req.body);

    // Transform AI plan format to journey format
    // Provide explicit defaults for optional properties to satisfy exactOptionalPropertyTypes
    const aiPlanInput = {
      day_tasks: data.ai_plan.day_tasks,
      ...(data.ai_plan.day_whys !== undefined && { day_whys: data.ai_plan.day_whys }),
      ...(data.ai_plan.plan_summary !== undefined && { plan_summary: data.ai_plan.plan_summary }),
    };
    const planData = transformAIPlanToJourneyDays(aiPlanInput);

    const journey = await JourneysService.createJourney(req.user!.id, {
      user_habit_id: data.user_habit_id,
      blueprint_id: data.blueprint_id ?? null,
      plan_data: planData,
      start_date: data.start_date ? new Date(data.start_date) : undefined,
    });

    res.status(201).json({ success: true, data: journey });
  } catch (error) {
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

    const journey = await JourneysService.updateJourney(req.user!.id, journeyId, {
      status: data.status,
      start_date: data.start_date ? new Date(data.start_date) : undefined,
    });

    if (!journey) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }

    res.json({ success: true, data: journey });
  } catch (error) {
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
    const days = await JourneysService.getJourneyDays(req.user!.id, journeyId);
    if (!days) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }
    res.json({ success: true, data: days });
  } catch (error) {
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

    const day = await JourneysService.getJourneyDay(
      req.user!.id,
      journeyId,
      dayNumber
    );

    if (!day) {
      return res.status(404).json({ success: false, error: "Journey day not found" });
    }

    res.json({ success: true, data: day });
  } catch (error) {
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
    const journey = await JourneysService.startJourney(req.user!.id, journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }
    res.json({ success: true, data: journey });
  } catch (error) {
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
    const journey = await JourneysService.pauseJourney(req.user!.id, journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }
    res.json({ success: true, data: journey });
  } catch (error) {
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
    const journey = await JourneysService.resumeJourney(req.user!.id, journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }
    res.json({ success: true, data: journey });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/journeys/active
 * Get active journey
 */
r.get("/active", requireAuth, async (req, res, next) => {
  try {
    const journey = await JourneysService.getActiveJourney(req.user!.id);
    res.json({ success: true, data: journey });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/journeys/:id/today
 * Get today's journey day with tasks
 */
r.get("/:id/today", requireAuth, async (req, res, next) => {
  try {
    const journeyId = req.params.id;
    if (!journeyId) {
      return res.status(400).json({ success: false, error: "Journey ID is required" });
    }
    const today = await JourneysService.getTodayJourneyDay(req.user!.id, journeyId);
    if (!today) {
      return res.status(404).json({ success: false, error: "Journey or today's day not found" });
    }
    res.json({ success: true, data: today });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/journeys/:id/restart
 * Restart journey (reset to day 1)
 */
r.post("/:id/restart", requireAuth, async (req, res, next) => {
  try {
    const journeyId = req.params.id;
    if (!journeyId) {
      return res.status(400).json({ success: false, error: "Journey ID is required" });
    }
    const journey = await JourneysService.restartJourney(req.user!.id, journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }
    res.json({ success: true, data: journey });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/journeys/:id/calendar
 * Get journey calendar view
 */
r.get("/:id/calendar", requireAuth, async (req, res, next) => {
  try {
    const journeyId = req.params.id;
    if (!journeyId) {
      return res.status(400).json({ success: false, error: "Journey ID is required" });
    }
    const calendar = await JourneysService.getJourneyCalendar(req.user!.id, journeyId);
    if (!calendar) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }
    res.json({ success: true, data: calendar });
  } catch (error) {
    next(error);
  }
});

export default r;
