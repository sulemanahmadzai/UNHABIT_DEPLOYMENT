import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as HabitsService from "../services/habits.service.js";
import { prisma } from "../lib/services.js";

const r = Router();

/**
 * GET /api/habits/templates
 * Get habit templates (public, no auth required for browsing)
 */
r.get("/templates", async (req, res, next) => {
  try {
    const categoryId = req.query.category_id as string | undefined;

    const templates = await prisma.habit_templates.findMany({
      ...(categoryId && { where: { category_id: categoryId } }),
      include: {
        habit_categories: true,
      },
      orderBy: { title: "asc" },
    });

    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/habits/categories
 * Get habit categories
 */
r.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.habit_categories.findMany({
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/habits
 * List user's habits
 */
r.get("/", requireAuth, async (req, res, next) => {
  try {
    const habits = await HabitsService.getUserHabits(req.user!.id);
    res.json({ success: true, data: habits });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/habits/:id
 * Get habit details
 */
r.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const habitId = req.params.id;
    if (!habitId) {
      return res.status(400).json({ success: false, error: "Habit ID is required" });
    }
    const habit = await HabitsService.getHabitById(req.user!.id, habitId);
    if (!habit) {
      return res.status(404).json({ success: false, error: "Habit not found" });
    }
    res.json({ success: true, data: habit });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/habits
 * Create new habit
 */
r.post("/", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      goal_text: z.string().min(1).max(500),
      template_id: z.string().uuid().optional(),
      started_at: z.string().datetime().optional(),
    });
    const data = schema.parse(req.body);

    const habit = await HabitsService.createHabit(req.user!.id, {
      goal_text: data.goal_text,
      template_id: data.template_id ?? null,
      started_at: data.started_at ? new Date(data.started_at) : null,
    });

    res.status(201).json({ success: true, data: habit });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/habits/:id
 * Update habit
 */
r.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      goal_text: z.string().min(1).max(500).optional(),
      status: z.enum(["active", "paused", "completed", "archived"]).optional(),
      started_at: z.string().datetime().optional(),
    });
    const data = schema.parse(req.body);

    const habitId = req.params.id;
    if (!habitId) {
      return res.status(400).json({ success: false, error: "Habit ID is required" });
    }
    const habit = await HabitsService.updateHabit(req.user!.id, habitId, {
      goal_text: data.goal_text,
      status: data.status,
      started_at: data.started_at ? new Date(data.started_at) : undefined,
    });

    if (!habit) {
      return res.status(404).json({ success: false, error: "Habit not found" });
    }

    res.json({ success: true, data: habit });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/habits/:id
 * Delete habit
 */
r.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const habitId = req.params.id;
    if (!habitId) {
      return res.status(400).json({ success: false, error: "Habit ID is required" });
    }
    const deleted = await HabitsService.deleteHabit(req.user!.id, habitId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Habit not found" });
    }
    res.json({ success: true, message: "Habit deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/habits/:id/triggers
 * Get habit triggers
 */
r.get("/:id/triggers", requireAuth, async (req, res, next) => {
  try {
    const habitId = req.params.id;
    if (!habitId) {
      return res.status(400).json({ success: false, error: "Habit ID is required" });
    }
    const triggers = await HabitsService.getHabitTriggers(req.user!.id, habitId);
    if (!triggers) {
      return res.status(404).json({ success: false, error: "Habit not found" });
    }
    res.json({ success: true, data: triggers });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/habits/:id/triggers
 * Add trigger to habit
 */
r.post("/:id/triggers", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      trigger_id: z.string().uuid(),
    });
    const { trigger_id } = schema.parse(req.body);

    const habitId = req.params.id;
    if (!habitId) {
      return res.status(400).json({ success: false, error: "Habit ID is required" });
    }
    const result = await HabitsService.addTriggerToHabit(
      req.user!.id,
      habitId,
      trigger_id
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "Habit or trigger not found" });
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/habits/:id/triggers/:triggerId
 * Remove trigger from habit
 */
r.delete("/:id/triggers/:triggerId", requireAuth, async (req, res, next) => {
  try {
    const habitId = req.params.id;
    const triggerId = req.params.triggerId;
    if (!habitId || !triggerId) {
      return res.status(400).json({ success: false, error: "Habit ID and Trigger ID are required" });
    }
    const removed = await HabitsService.removeTriggerFromHabit(
      req.user!.id,
      habitId,
      triggerId
    );

    if (!removed) {
      return res.status(404).json({ success: false, error: "Habit trigger not found" });
    }

    res.json({ success: true, message: "Trigger removed successfully" });
  } catch (error) {
    next(error);
  }
});

export default r;

