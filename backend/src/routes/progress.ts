import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as ProgressService from "../services/progress.service.js";
import * as BadgeAwardingService from "../services/badge-awarding.service.js";
import * as RewardsService from "../services/rewards.service.js";
import { getSettingValue } from "../services/admin.service.js";
import { notifyDailyCompletion } from "../services/notification-events.service.js";
import * as Scenarios from "../services/notification-scenarios.service.js";
import { db } from "../lib/services.js";

function calculateLevel(totalXP: number): number {
  let level = 1;
  let xpRequired = 0;
  let nextLevelXP = 100;
  while (totalXP >= xpRequired + nextLevelXP) {
    xpRequired += nextLevelXP;
    level++;
    nextLevelXP = level * 100;
  }
  return level;
}

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
    const result = await ProgressService.completeTask(req.user!.id, taskId);

    if (!result) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    // Capture level before awarding XP (for level-up detection)
    const balanceBefore = await db.point_balances.findUnique({ where: { user_id: req.user!.id } });
    const levelBefore = calculateLevel(Number(balanceBefore?.total_points ?? 0));

    // Award XP for task completion
    const xpPerTask = await getSettingValue("xp_per_task_completion", 10);
    await RewardsService.awardPoints(req.user!.id, xpPerTask);

    // Check and award badges + update streak
    const badgeResult = await BadgeAwardingService.onTaskCompleted(req.user!.id, taskId);

    // Fire-and-forget: streak, XP, level-up, share notifications
    (async () => {
      try {
        const streak = await db.streaks.findFirst({
          where: { user_id: req.user!.id, kind: "task_completion" },
        });
        const len = streak?.current_length ?? 0;
        if ([7, 14, 21].includes(len)) {
          await Scenarios.notifyStreakMilestone(req.user!.id, len);
          await Scenarios.notifySharePrompt(req.user!.id);
        } else if (len >= 2 && len < 7) {
          await Scenarios.notifyMicroStreak(req.user!.id, len);
        }

        // XP earned notification (only for meaningful amounts)
        await Scenarios.notifyXpEarned(req.user!.id, xpPerTask);

        // Level-up detection
        const balanceAfter = await db.point_balances.findUnique({ where: { user_id: req.user!.id } });
        const levelAfter = calculateLevel(Number(balanceAfter?.total_points ?? 0));
        if (levelAfter > levelBefore) {
          await Scenarios.notifyLevelUp(req.user!.id, levelAfter);
        }
      } catch {}
    })();

    res.json({
      success: true,
      data: result,
      xp_earned: xpPerTask,
      streak_updated: badgeResult.streak_updated,
      new_badges: badgeResult.new_badges,
    });
  } catch (error) {
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
    const result = await ProgressService.uncompleteTask(req.user!.id, taskId);

    if (!result) {
      return res.status(404).json({ success: false, error: "Task progress not found" });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/progress/tasks
 * Get user's task progress
 */
r.get("/tasks", requireAuth, async (req, res, next) => {
  try {
    const journeyId = (req.query.journey_id as string) || undefined;
    const progress = await ProgressService.getUserTaskProgress(
      req.user!.id,
      journeyId
    );
    res.json({ success: true, data: progress });
  } catch (error) {
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
    const summary = await ProgressService.getJourneyProgressSummary(
      req.user!.id,
      journeyId
    );

    if (!summary) {
      return res.status(404).json({ success: false, error: "Journey not found" });
    }

    res.json({ success: true, data: summary });
  } catch (error) {
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

    const reflection = await ProgressService.submitReflection(req.user!.id, {
      journey_day_id: data.journey_day_id,
      content: data.content ?? null,
      answers: data.answers ? (data.answers as Record<string, string | number | boolean>) : null,
    });

    res.status(201).json({ success: true, data: reflection });
  } catch (error) {
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
    const reflection = await ProgressService.getReflection(
      req.user!.id,
      journeyDayId
    );

    if (!reflection) {
      return res.status(404).json({ success: false, error: "Reflection not found" });
    }

    res.json({ success: true, data: reflection });
  } catch (error) {
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

    const slip = await ProgressService.reportSlip(req.user!.id, {
      user_habit_id: data.user_habit_id ?? null,
      happened_at: new Date(data.happened_at),
      context: (data.context as Record<string, unknown>) ?? null,
    });

    // Fire-and-forget: relapse logged + coach skill suggestion
    Scenarios.notifyRelapsLogged(req.user!.id).catch(() => {});
    Scenarios.notifyCoachSkillSuggestion(req.user!.id).catch(() => {});

    res.status(201).json({ success: true, data: slip });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/progress/slips
 * Get slip history
 */
r.get("/slips", requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const slips = await ProgressService.getSlipHistory(req.user!.id, limit, offset);
    res.json({ success: true, data: slips });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/progress/today
 * Get today's tasks and progress
 */
r.get("/today", requireAuth, async (req, res, next) => {
  try {
    const progress = await ProgressService.getTodayProgress(req.user!.id);
    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/progress/complete-day
 * Mark all today's tasks as complete
 */
r.post("/complete-day", requireAuth, async (req, res, next) => {
  try {
    const result = await ProgressService.completeDayTasks(req.user!.id);

    // Best-effort push: completion reinforcement + streak check + post-21 check
    (async () => {
      try {
        const streak = await db.streaks.findFirst({
          where: { user_id: req.user!.id, kind: "task_completion" },
        });
        const len = streak?.current_length ?? 0;
        await Scenarios.notifyCompletionReinforcement(req.user!.id, len);
        await Scenarios.notifyHabitHealthChange(req.user!.id);

        if ([7, 14, 21].includes(len)) {
          await Scenarios.notifyStreakMilestone(req.user!.id, len);
        }

        // Check if this completes the 21-day plan
        const journey = await db.journeys.findFirst({
          where: { user_id: req.user!.id, status: "active" },
        });
        if (journey && journey.planned_days === 21 && journey.start_date) {
          const startDate = new Date(journey.start_date);
          startDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dayNumber = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (dayNumber >= 21) {
            await Scenarios.notifyPost21Maintenance(req.user!.id);
          }
        }

        // Notify buddies that user completed today + buddy streak milestones
        const buddyLinks = await db.buddy_links.findMany({
          where: {
            OR: [{ user_a: req.user!.id }, { user_b: req.user!.id }],
            status: "active",
          },
        });
        const userProfile = await db.profiles.findUnique({
          where: { user_id: req.user!.id },
          select: { full_name: true },
        });
        for (const link of buddyLinks) {
          const buddyId = link.user_a === req.user!.id ? link.user_b : link.user_a;
          await Scenarios.notifyBuddyCompletedToday(buddyId, userProfile?.full_name ?? undefined);

          if ([7, 14, 21].includes(len)) {
            await Scenarios.notifyBuddyStreakMilestone(
              buddyId,
              userProfile?.full_name ?? "Your buddy",
              len
            );
          }
        }
      } catch {}
    })();

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/progress/snapshot
 * Get progress snapshot (XP, streak, habit health, next badge)
 */
r.get("/snapshot", requireAuth, async (req, res, next) => {
  try {
    const snapshot = await ProgressService.getProgressSnapshot(req.user!.id);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    next(error);
  }
});

export default r;
