import { prisma } from "../lib/services.js";
import * as RewardsService from "./rewards.service.js";

interface BadgeAwardResult {
  awarded: boolean;
  badge_id?: string;
  badge_name?: string;
  badge_slug?: string;
}

/**
 * Check and award badges for a user based on their current stats
 * This should be called after completing tasks, streaks, etc.
 */
export async function checkAndAwardBadges(userId: string): Promise<BadgeAwardResult[]> {
  const results: BadgeAwardResult[] = [];

  // Get all active badge rules with their definitions
  const badgeRules = await prisma.badge_rules.findMany({
    where: { is_active: true },
    include: { badge_definitions: true },
  });

  // Get user's earned badges
  const earnedBadges = await prisma.user_badges.findMany({
    where: { user_id: userId },
    select: { badge_id: true },
  });
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.badge_id));

  // Get user stats for checking rules
  const userStats = await getUserStats(userId);

  for (const rule of badgeRules) {
    // Skip if already earned
    if (earnedBadgeIds.has(rule.badge_id)) {
      continue;
    }

    // Check if rule is satisfied
    const satisfied = checkRuleSatisfied(rule.rule_type, rule.threshold, userStats);

    if (satisfied) {
      // Award the badge
      await RewardsService.awardBadge(userId, rule.badge_id, {
        rule_type: rule.rule_type,
        threshold: rule.threshold,
        awarded_stats: userStats,
      });

      results.push({
        awarded: true,
        badge_id: rule.badge_id,
        badge_name: rule.badge_definitions.name,
        badge_slug: rule.badge_definitions.slug,
      });
    }
  }

  return results;
}

/**
 * Check specific badge type and award if satisfied
 */
export async function checkAndAwardBadgeType(
  userId: string,
  ruleType: string
): Promise<BadgeAwardResult | null> {
  // Get badge rules for this type
  const rules = await prisma.badge_rules.findMany({
    where: {
      rule_type: ruleType,
      is_active: true,
    },
    include: { badge_definitions: true },
    orderBy: { threshold: "asc" },
  });

  if (rules.length === 0) return null;

  // Get user's earned badges
  const earnedBadges = await prisma.user_badges.findMany({
    where: { user_id: userId },
    select: { badge_id: true },
  });
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.badge_id));

  // Get user stats
  const userStats = await getUserStats(userId);

  for (const rule of rules) {
    if (earnedBadgeIds.has(rule.badge_id)) continue;

    const satisfied = checkRuleSatisfied(rule.rule_type, rule.threshold, userStats);

    if (satisfied) {
      await RewardsService.awardBadge(userId, rule.badge_id, {
        rule_type: rule.rule_type,
        threshold: rule.threshold,
      });

      return {
        awarded: true,
        badge_id: rule.badge_id,
        badge_name: rule.badge_definitions.name,
        badge_slug: rule.badge_definitions.slug,
      };
    }
  }

  return null;
}

/**
 * Get user stats for badge checking
 */
async function getUserStats(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    streaks,
    totalTasksCompleted,
    totalFocusSessions,
    buddyCount,
    perfectDays,
    pointBalance,
    buddyCheckins,
    journeyRestarts,
    reflections,
    earlyTasks,
    nightTasks,
    weekendCompletions,
  ] = await Promise.all([
    prisma.streaks.findFirst({
      where: { user_id: userId, kind: "task_completion" },
    }),
    prisma.user_task_progress.count({
      where: { user_id: userId, status: "completed" },
    }),
    prisma.focus_sessions.count({
      where: { user_id: userId, completed: true },
    }),
    prisma.buddy_links.count({
      where: {
        OR: [{ user_a: userId }, { user_b: userId }],
        status: "active",
      },
    }),
    countPerfectDays(userId),
    prisma.point_balances.findUnique({ where: { user_id: userId } }),
    prisma.buddy_checkins.count({
      where: { user_id: userId },
    }),
    prisma.journeys.count({
      where: { user_id: userId, status: "active" },
    }),
    prisma.reflections.count({
      where: { user_id: userId },
    }),
    countEarlyTasks(userId),
    countNightTasks(userId),
    countWeekendCompletions(userId),
  ]);

  return {
    streak_days: streaks?.current_length ?? 0,
    best_streak: streaks?.best_length ?? 0,
    tasks_completed: totalTasksCompleted,
    focus_sessions: totalFocusSessions,
    buddies_connected: buddyCount,
    perfect_days: perfectDays,
    total_xp: Number(pointBalance?.total_points ?? 0),
    buddy_checkins: buddyCheckins,
    journey_restarts: journeyRestarts,
    reflections_submitted: reflections,
    early_tasks: earlyTasks,
    night_tasks: nightTasks,
    weekend_completions: weekendCompletions,
    recovery_streak: streaks?.current_length ?? 0, // Can be enhanced with slip tracking
  };
}

/**
 * Count days where all tasks were completed
 */
async function countPerfectDays(userId: string): Promise<number> {
  // Get all journey days with their tasks and progress
  const journeyDays = await prisma.journey_days.findMany({
    where: {
      journeys: {
        user_id: userId,
      },
    },
    include: {
      journey_tasks: {
        include: {
          user_task_progress: {
            where: { user_id: userId },
          },
        },
      },
    },
  });

  let perfectDays = 0;

  for (const day of journeyDays) {
    if (day.journey_tasks.length === 0) continue;

    const allCompleted = day.journey_tasks.every(task =>
      task.user_task_progress.some(p => p.status === "completed")
    );

    if (allCompleted) perfectDays++;
  }

  return perfectDays;
}

/**
 * Count tasks completed before noon
 */
async function countEarlyTasks(userId: string): Promise<number> {
  const tasks = await prisma.user_task_progress.findMany({
    where: {
      user_id: userId,
      status: "completed",
      completed_at: { not: null },
    },
    select: { completed_at: true },
  });

  return tasks.filter(task => {
    if (!task.completed_at) return false;
    const hour = new Date(task.completed_at).getHours();
    return hour < 12;
  }).length;
}

/**
 * Count tasks completed after 8 PM
 */
async function countNightTasks(userId: string): Promise<number> {
  const tasks = await prisma.user_task_progress.findMany({
    where: {
      user_id: userId,
      status: "completed",
      completed_at: { not: null },
    },
    select: { completed_at: true },
  });

  return tasks.filter(task => {
    if (!task.completed_at) return false;
    const hour = new Date(task.completed_at).getHours();
    return hour >= 20;
  }).length;
}

/**
 * Count weekend days where all tasks were completed
 */
async function countWeekendCompletions(userId: string): Promise<number> {
  const journeyDays = await prisma.journey_days.findMany({
    where: {
      journeys: {
        user_id: userId,
      },
    },
    include: {
      journey_tasks: {
        include: {
          user_task_progress: {
            where: { user_id: userId },
          },
        },
      },
    },
  });

  let weekendCompletions = 0;

  for (const day of journeyDays) {
    if (day.journey_tasks.length === 0) continue;

    // Check if it's a weekend (Saturday = 6, Sunday = 0)
    const dayOfWeek = new Date(day.date).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) continue;

    const allCompleted = day.journey_tasks.every(task =>
      task.user_task_progress.some(p => p.status === "completed")
    );

    if (allCompleted) weekendCompletions++;
  }

  return weekendCompletions;
}

/**
 * Check if a rule is satisfied based on user stats
 */
function checkRuleSatisfied(
  ruleType: string,
  threshold: number,
  stats: {
    streak_days: number;
    best_streak: number;
    tasks_completed: number;
    focus_sessions: number;
    buddies_connected: number;
    perfect_days: number;
    total_xp: number;
    buddy_checkins: number;
    journey_restarts: number;
    reflections_submitted: number;
    early_tasks: number;
    night_tasks: number;
    weekend_completions: number;
    recovery_streak: number;
  }
): boolean {
  switch (ruleType) {
    case "streak_days":
      return stats.streak_days >= threshold;
    case "best_streak":
      return stats.best_streak >= threshold;
    case "tasks_completed":
      return stats.tasks_completed >= threshold;
    case "focus_sessions":
      return stats.focus_sessions >= threshold;
    case "buddies_connected":
      return stats.buddies_connected >= threshold;
    case "perfect_days":
      return stats.perfect_days >= threshold;
    case "perfect_week":
      return stats.perfect_days >= 7;
    case "xp_earned":
      return stats.total_xp >= threshold;
    case "buddy_checkins":
      return stats.buddy_checkins >= threshold;
    case "journey_restarts":
      return stats.journey_restarts >= threshold;
    case "reflections_submitted":
      return stats.reflections_submitted >= threshold;
    case "early_tasks":
      return stats.early_tasks >= threshold;
    case "night_tasks":
      return stats.night_tasks >= threshold;
    case "weekend_completions":
      return stats.weekend_completions >= threshold;
    case "recovery_streak":
      return stats.recovery_streak >= threshold;
    default:
      return false;
  }
}

/**
 * Called after task completion to check badges and update streak
 */
export async function onTaskCompleted(userId: string, taskId: string) {
  // Update streak
  await updateStreak(userId);

  // Check for new badges
  const newBadges = await checkAndAwardBadges(userId);

  return {
    streak_updated: true,
    new_badges: newBadges.filter(b => b.awarded),
  };
}

/**
 * Update user's streak after task completion
 */
async function updateStreak(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const streak = await prisma.streaks.findFirst({
    where: { user_id: userId, kind: "task_completion" },
  });

  if (!streak) {
    // Create new streak
    await prisma.streaks.create({
      data: {
        user_id: userId,
        kind: "task_completion",
        current_length: 1,
        best_length: 1,
        last_event_date: today,
        is_frozen: false,
      },
    });
    return;
  }

  const lastEventDate = streak.last_event_date
    ? new Date(streak.last_event_date)
    : null;

  if (lastEventDate) {
    lastEventDate.setHours(0, 0, 0, 0);
    const lastDateStr = lastEventDate.toISOString().split("T")[0];

    if (lastDateStr === todayStr) {
      // Already updated today
      return;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (lastDateStr === yesterdayStr || streak.is_frozen) {
      // Continue streak
      const newLength = streak.current_length + 1;
      await prisma.streaks.update({
        where: {
          user_id_kind: {
            user_id: userId,
            kind: "task_completion",
          },
        },
        data: {
          current_length: newLength,
          best_length: Math.max(newLength, streak.best_length),
          last_event_date: today,
          is_frozen: false,
        },
      });
    } else {
      // Streak broken, start new
      await prisma.streaks.update({
        where: {
          user_id_kind: {
            user_id: userId,
            kind: "task_completion",
          },
        },
        data: {
          current_length: 1,
          last_event_date: today,
          is_frozen: false,
        },
      });
    }
  } else {
    // First task ever
    await prisma.streaks.update({
      where: {
        user_id_kind: {
          user_id: userId,
          kind: "task_completion",
        },
      },
      data: {
        current_length: 1,
        best_length: Math.max(1, streak.best_length),
        last_event_date: today,
      },
    });
  }
}
