import { prisma } from "../lib/services.js";
import { Decimal } from "@prisma/client/runtime/library";
import { cacheDashboard, getCachedDashboard } from "./cache.service.js";

/**
 * Get aggregated home dashboard data for a user
 */
export async function getDashboard(userId: string) {
  // Try cache first
  const cached = await getCachedDashboard(userId);
  if (cached) {
    return cached;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Run all queries in parallel for performance
  const [
    activeJourney,
    streaks,
    pointBalance,
    todayXP,
    buddyCount,
    buddiesCompletedToday,
    earnedBadgesCount,
    nextBadge,
    profile,
  ] = await Promise.all([
    // Get active journey with today's day
    getActiveJourneyWithToday(userId),
    // Get streaks
    prisma.streaks.findMany({
      where: { user_id: userId },
    }),
    // Get point balance
    prisma.point_balances.findUnique({
      where: { user_id: userId },
    }),
    // Get today's XP
    getTodayXP(userId),
    // Get buddy count
    getBuddyCount(userId),
    // Get buddies who completed today
    getBuddiesCompletedToday(userId),
    // Get earned badges count
    prisma.user_badges.count({
      where: { user_id: userId },
    }),
    // Get next badge to earn
    getNextBadge(userId),
    // Get profile
    prisma.profiles.findUnique({
      where: { user_id: userId },
    }),
  ]);

  // Calculate current day number
  let currentDayNumber = 1; // Default to 1 since journey_days are 1-indexed
  let journeyProgress = 0;
  let habitHealth = 0;

  if (activeJourney && activeJourney.start_date) {
    // Normalize start_date to midnight for accurate comparison
    const startDate = new Date(activeJourney.start_date);
    startDate.setHours(0, 0, 0, 0);
    
    // Calculate days elapsed (don't use Math.abs to detect future dates)
    const diffTime = today.getTime() - startDate.getTime();
    
    // Guard against future start dates
    if (diffTime >= 0) {
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      currentDayNumber = Math.min(diffDays + 1, activeJourney.planned_days);
    }
    // If start_date is in the future, currentDayNumber stays at 1
    
    journeyProgress = Math.round((currentDayNumber / activeJourney.planned_days) * 100);
    
    // Calculate habit health based on completed tasks
    habitHealth = await calculateHabitHealth(userId, activeJourney.id);
  }

  // Get today's tasks
  const todaysTasks = activeJourney ? await getTodaysTasks(userId, activeJourney.id, currentDayNumber) : [];

  // Get main streak (task_completion)
  const mainStreak = streaks.find(s => s.kind === "task_completion");

  // Calculate level from XP
  const totalXP = Number(pointBalance?.total_points ?? 0);
  const level = calculateLevel(totalXP);

  const dashboardData = {
    user: {
      name: profile?.full_name ?? "User",
      avatar_url: profile?.avatar_url,
    },
    journey: activeJourney ? {
      id: activeJourney.id,
      current_day: currentDayNumber,
      total_days: activeJourney.planned_days,
      progress_percent: journeyProgress,
      status: activeJourney.status,
      habit_goal: activeJourney.user_habits?.goal_text,
    } : null,
    habit_health: habitHealth,
    xp: {
      total: totalXP,
      today: todayXP,
      level: level.level,
      level_progress: level.progress,
      xp_to_next_level: level.xpToNext,
    },
    streak: {
      current: mainStreak?.current_length ?? 0,
      best: mainStreak?.best_length ?? 0,
      is_frozen: mainStreak?.is_frozen ?? false,
    },
    todays_checklist: todaysTasks,
    buddies: {
      total_count: buddyCount,
      completed_today: buddiesCompletedToday,
    },
    rewards: {
      badges_earned: earnedBadgesCount,
      next_badge: nextBadge,
    },
  };

  // Cache for 2 minutes
  await cacheDashboard(userId, dashboardData, 120);

  return dashboardData;
}

/**
 * Get active journey with user habit
 */
async function getActiveJourneyWithToday(userId: string) {
  return prisma.journeys.findFirst({
    where: {
      user_id: userId,
      status: "active",
    },
    include: {
      user_habits: true,
    },
    orderBy: { created_at: "desc" },
  });
}

/**
 * Get today's tasks for a journey
 */
async function getTodaysTasks(userId: string, journeyId: string, dayNumber: number) {
  const journeyDay = await prisma.journey_days.findUnique({
    where: {
      journey_id_day_number: {
        journey_id: journeyId,
        day_number: dayNumber,
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

  if (!journeyDay) return [];

  return journeyDay.journey_tasks.map(task => {
    const meta = task.meta as Record<string, unknown> | null;
    return {
      id: task.id,
      title: task.title,
      kind: task.kind,
      effort: task.effort,
      description: (meta as any)?.description ?? null,
      completed: task.user_task_progress.some(p => p.status === "completed"),
      xp: 10,
    };
  });
}

/**
 * Get today's XP
 */
async function getTodayXP(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.points_ledger.aggregate({
    where: {
      user_id: userId,
      awarded_at: { gte: today },
    },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

/**
 * Get buddy count
 */
async function getBuddyCount(userId: string): Promise<number> {
  const count = await prisma.buddy_links.count({
    where: {
      OR: [
        { user_a: userId },
        { user_b: userId },
      ],
      status: "active",
    },
  });
  return count;
}

/**
 * Get buddies who completed tasks today
 */
async function getBuddiesCompletedToday(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all buddy user IDs
  const buddyLinks = await prisma.buddy_links.findMany({
    where: {
      OR: [
        { user_a: userId },
        { user_b: userId },
      ],
      status: "active",
    },
  });

  const buddyIds = buddyLinks.map(link => 
    link.user_a === userId ? link.user_b : link.user_a
  );

  if (buddyIds.length === 0) return 0;

  // Count buddies who have completed at least one task today
  const completions = await prisma.user_task_progress.groupBy({
    by: ["user_id"],
    where: {
      user_id: { in: buddyIds },
      status: "completed",
      completed_at: { gte: today },
    },
  });

  return completions.length;
}

/**
 * Get next badge to earn
 */
async function getNextBadge(userId: string) {
  // Get all badges user hasn't earned yet
  const earnedBadges = await prisma.user_badges.findMany({
    where: { user_id: userId },
    select: { badge_id: true },
  });
  const earnedBadgeIds = earnedBadges.map(b => b.badge_id);

  // Get badge rules for unearne badges
  const availableRules = await prisma.badge_rules.findMany({
    where: {
      is_active: true,
      badge_id: { notIn: earnedBadgeIds },
    },
    include: {
      badge_definitions: true,
    },
    orderBy: { threshold: "asc" },
  });

  if (availableRules.length === 0) return null;

  // Get user's current stats for progress calculation
  const streaks = await prisma.streaks.findFirst({
    where: { user_id: userId, kind: "task_completion" },
  });
  const currentStreak = streaks?.current_length ?? 0;

  // Find the closest badge to earning
  for (const rule of availableRules) {
    if (rule.rule_type === "streak_days") {
      const daysLeft = rule.threshold - currentStreak;
      if (daysLeft > 0) {
        return {
          id: rule.badge_definitions.id,
          name: rule.badge_definitions.name,
          slug: rule.badge_definitions.slug,
          icon_url: rule.badge_definitions.icon_url,
          progress: Math.round((currentStreak / rule.threshold) * 100),
          days_left: daysLeft,
        };
      }
    }
  }

  // Return first available if no streak-based found
  const firstRule = availableRules[0];
  if (firstRule) {
    return {
      id: firstRule.badge_definitions.id,
      name: firstRule.badge_definitions.name,
      slug: firstRule.badge_definitions.slug,
      icon_url: firstRule.badge_definitions.icon_url,
      progress: 0,
      days_left: firstRule.threshold,
    };
  }
  return null;
}

/**
 * Calculate habit health based on task completion rate
 */
async function calculateHabitHealth(userId: string, journeyId: string): Promise<number> {
  // Get all tasks for this journey
  const journeyDays = await prisma.journey_days.findMany({
    where: { journey_id: journeyId },
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

  let totalTasks = 0;
  let completedTasks = 0;

  for (const day of journeyDays) {
    for (const task of day.journey_tasks) {
      totalTasks++;
      if (task.user_task_progress.some(p => p.status === "completed")) {
        completedTasks++;
      }
    }
  }

  if (totalTasks === 0) return 0;
  return Math.round((completedTasks / totalTasks) * 100);
}

/**
 * Calculate level from XP
 * Level formula: Each level requires level * 100 XP
 * Level 1: 0-99, Level 2: 100-299, Level 3: 300-599, etc.
 */
function calculateLevel(totalXP: number): { level: number; progress: number; xpToNext: number } {
  let level = 1;
  let xpRequired = 0;
  let nextLevelXP = 100;

  while (totalXP >= xpRequired + nextLevelXP) {
    xpRequired += nextLevelXP;
    level++;
    nextLevelXP = level * 100;
  }

  const currentLevelXP = totalXP - xpRequired;
  const progress = Math.round((currentLevelXP / nextLevelXP) * 100);
  const xpToNext = nextLevelXP - currentLevelXP;

  return { level, progress, xpToNext };
}

/**
 * Get streak at risk status
 */
export async function getStreakAtRiskStatus(userId: string) {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // Check if user has completed any task today
  const completedToday = await prisma.user_task_progress.count({
    where: {
      user_id: userId,
      status: "completed",
      completed_at: { gte: today },
    },
  });

  if (completedToday > 0) {
    return {
      at_risk: false,
      hours_left: 0,
      message: "You've completed tasks today!",
    };
  }

  // Get current streak
  const streak = await prisma.streaks.findFirst({
    where: { user_id: userId, kind: "task_completion" },
  });

  if (!streak || streak.current_length === 0) {
    return {
      at_risk: false,
      hours_left: 0,
      message: "Start your streak today!",
    };
  }

  // Calculate hours left
  const hoursLeft = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60)));

  return {
    at_risk: true,
    current_streak: streak.current_length,
    hours_left: hoursLeft,
    message: `Complete 1 task to save your ${streak.current_length}-day streak!`,
  };
}
