/**
 * Comprehensive Push Notification Cron Service
 *
 * Replaces the old basic cron with a timezone-aware, scenario-complete scheduler.
 * Runs on node-cron schedules and processes time-based notification scenarios
 * for all active users, respecting their local timezone.
 *
 * Schedules:
 *   Every 5 minutes  → Process morning, midday, evening scenarios per user timezone
 *   09:00 UTC Mon     → Weekly leaderboard start
 *   Sunday 18:00 UTC  → Weekly reward summary
 *   Daily 06:00 UTC   → Trial ending soon checks, plan expiration checks
 */

import { db } from "../lib/services.js";
import * as Scenarios from "./notification-scenarios.service.js";

type Logger = Pick<Console, "log" | "error" | "warn">;

async function getCron() {
  try {
    const mod = await import("node-cron");
    return mod.default ?? mod;
  } catch {
    console.warn(
      "[cron] node-cron is not installed. Cron jobs are disabled.\n" +
      "  Run: npm install node-cron && npm install --save-dev @types/node-cron"
    );
    return null;
  }
}

function getUserLocalMinute(now: Date, timezone: string): { minuteOfDay: number; dow: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const map = new Map(parts.map((p) => [p.type, p.value]));
    const hour = Number(map.get("hour") ?? "0");
    const minute = Number(map.get("minute") ?? "0");
    const weekday = map.get("weekday") ?? "Sun";
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    return { minuteOfDay: hour * 60 + minute, dow: dowMap[weekday] ?? 0 };
  } catch {
    return { minuteOfDay: 0, dow: 0 };
  }
}

function isInWindow(minuteOfDay: number, target: number, windowMinutes = 5): boolean {
  return minuteOfDay >= target && minuteOfDay < target + windowMinutes;
}

// ─── Main tick: runs every 5 minutes ───────────────────────────────

async function processTimezoneAwareScenarios(now: Date, logger: Logger) {
  const profiles = await db.profiles.findMany({
    select: { user_id: true, timezone: true },
  });

  const activeJourneyUsers = new Set(
    (await db.journeys.findMany({
      where: { status: "active" },
      select: { user_id: true },
      distinct: ["user_id"],
    })).map((j) => j.user_id)
  );

  const allSettings = await db.notification_settings.findMany();
  const settingsMap = new Map(allSettings.map((s: any) => [s.user_id as string, s]));

  for (const profile of profiles) {
    if (!activeJourneyUsers.has(profile.user_id)) continue;

    const tz = profile.timezone || "UTC";
    const { minuteOfDay, dow } = getUserLocalMinute(now, tz);
    const settings = settingsMap.get(profile.user_id) as any;
    const morningMinute: number = settings?.morning_checkin_minute ?? 480; // 8:00 AM
    const eveningMinute: number = settings?.evening_lastcall_minute ?? 1260; // 9:00 PM
    const middayMinute = 720; // 12:00 PM

    // Morning check-in window (user's chosen time)
    if (isInWindow(minuteOfDay, morningMinute)) {
      await Scenarios.notifyDailyCheckinReady(profile.user_id, logger);
    }

    // Task reminder (~1h after morning check-in if checklist not started)
    if (isInWindow(minuteOfDay, morningMinute + 60)) {
      await Scenarios.notifyTaskReminder(profile.user_id, undefined, logger);
    }

    // Midday rescue (12:00 PM local)
    if (isInWindow(minuteOfDay, middayMinute)) {
      await Scenarios.notifyMiddayRescue(profile.user_id, logger);
      await Scenarios.notifyOpenAppNudge(profile.user_id, logger);
    }

    // Evening last call (user's chosen time)
    if (isInWindow(minuteOfDay, eveningMinute)) {
      await Scenarios.notifyEveningLastCall(profile.user_id, logger);
      await Scenarios.notifyHighRiskWindow(profile.user_id, logger);
    }

    // Weekend support (Friday & Saturday at morning time)
    if ((dow === 5 || dow === 6) && isInWindow(minuteOfDay, morningMinute)) {
      await Scenarios.notifyWeekendSupport(profile.user_id, logger);
    }
  }
}

// ─── Streak at risk: runs evening ────────────────────────────

async function processStreakAtRisk(logger: Logger) {
  const atRisk = await Scenarios.getUsersWithStreaksAtRisk();
  let sent = 0;

  for (const { userId, streakLength } of atRisk) {
    const result = await Scenarios.notifyStreakAtRisk(userId, streakLength, logger);
    if (result) sent++;
  }

  logger.log(`[cron] streak_at_risk: processed=${atRisk.length}, sent=${sent}`);
}

// ─── Missed day recovery: runs morning ──────────────────────

async function processMissedDayRecovery(logger: Logger) {
  const users = await Scenarios.getUsersWhoMissedYesterday();
  let sentRecovery = 0;
  let sentCleanSlate = 0;

  for (const userId of users) {
    const r1 = await Scenarios.notifyMissedDayRecovery(userId, logger);
    if (r1) sentRecovery++;
    const r2 = await Scenarios.notifyDayResetCleanSlate(userId, logger);
    if (r2) sentCleanSlate++;
  }

  logger.log(`[cron] missed_day_recovery: processed=${users.length}, recovery=${sentRecovery}, clean_slate=${sentCleanSlate}`);
}

// ─── Two-miss risk: runs morning ────────────────────────────

async function processTwoMissRisk(logger: Logger) {
  const users = await Scenarios.getUsersWithTwoMissRisk();
  let sent = 0;

  for (const userId of users) {
    const result = await Scenarios.notifyTwoMissRisk(userId, logger);
    if (result) sent++;
  }

  logger.log(`[cron] two_miss_risk: processed=${users.length}, sent=${sent}`);
}

// ─── Buddy nudge prompts: runs evening ──────────────────────

async function processBuddyNudgePrompts(logger: Logger) {
  const targets = await Scenarios.getBuddyNudgeTargets();
  let sent = 0;

  for (const { userId, buddyName } of targets) {
    const result = await Scenarios.notifyNudgeYourBuddy(
      userId,
      buddyName ?? undefined,
      logger
    );
    if (result) sent++;
  }

  logger.log(`[cron] buddy_nudge_prompts: processed=${targets.length}, sent=${sent}`);
}

// ─── Coach daily check-in: runs morning ─────────────────────

async function processCoachDailyCheckin(logger: Logger) {
  const profiles = await db.profiles.findMany({
    select: { user_id: true, timezone: true },
  });

  const now = new Date();
  const allCoachSettings = await db.notification_settings.findMany();
  const settingsMap2 = new Map(allCoachSettings.map((s: any) => [s.user_id as string, s]));

  let sent = 0;

  for (const profile of profiles) {
    const tz = profile.timezone || "UTC";
    const { minuteOfDay } = getUserLocalMinute(now, tz);
    const settings = settingsMap2.get(profile.user_id) as any;
    const morningMinute: number = settings?.morning_checkin_minute ?? 480;

    if (isInWindow(minuteOfDay, morningMinute + 30, 5)) {
      const result = await Scenarios.notifyCoachDailyCheckin(profile.user_id, logger);
      if (result) sent++;
    }
  }

  logger.log(`[cron] coach_daily_checkin: sent=${sent}`);
}

// ─── Coach reflection prompt: runs evening ──────────────────

async function processCoachReflectionPrompt(logger: Logger) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedToday = await db.user_task_progress.groupBy({
    by: ["user_id"],
    where: {
      status: "completed",
      completed_at: { gte: today },
    },
  });

  const now = new Date();
  const profiles = await db.profiles.findMany({
    where: { user_id: { in: completedToday.map((c) => c.user_id) } },
    select: { user_id: true, timezone: true },
  });

  let sent = 0;

  for (const profile of profiles) {
    const tz = profile.timezone || "UTC";
    const { minuteOfDay } = getUserLocalMinute(now, tz);

    // Send reflection prompt around 8:30 PM local
    if (isInWindow(minuteOfDay, 1230, 5)) {
      const result = await Scenarios.notifyCoachReflectionPrompt(profile.user_id, logger);
      if (result) sent++;
    }
  }

  logger.log(`[cron] coach_reflection: sent=${sent}`);
}

// ─── Weekly leaderboard start: Monday morning ───────────────

async function processLeaderboardWeeklyStart(logger: Logger) {
  const activeJourneys = await db.journeys.findMany({
    where: { status: "active" },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  let sent = 0;
  for (const { user_id } of activeJourneys) {
    const result = await Scenarios.notifyLeaderboardWeeklyStart(user_id, logger);
    if (result) sent++;
  }

  logger.log(`[cron] leaderboard_weekly_start: sent=${sent}`);
}

// ─── Weekly reward summary: Sunday evening ──────────────────

async function processWeeklyRewardSummary(logger: Logger) {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const activeJourneys = await db.journeys.findMany({
    where: { status: "active" },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  let sent = 0;

  for (const { user_id } of activeJourneys) {
    const completions = await db.user_task_progress.groupBy({
      by: ["user_id"],
      where: {
        user_id,
        status: "completed",
        completed_at: { gte: weekAgo },
      },
      _count: true,
    });

    const daysCompleted = completions[0]?._count ?? 0;

    const pointsThisWeek = await db.points_ledger.aggregate({
      where: { user_id, awarded_at: { gte: weekAgo } },
      _sum: { amount: true },
    });

    const xpEarned = pointsThisWeek._sum.amount ?? 0;

    const result = await Scenarios.notifyWeeklyRewardSummary(
      user_id,
      daysCompleted,
      xpEarned,
      logger
    );
    if (result) sent++;
  }

  logger.log(`[cron] weekly_reward_summary: sent=${sent}`);
}

// ─── Trial ending soon: daily check ─────────────────────────

async function processTrialEndingSoon(logger: Logger) {
  const targets = await Scenarios.getUsersWithTrialEndingSoon(2);
  let sent = 0;

  for (const { userId, daysRemaining } of targets) {
    const result = await Scenarios.notifyTrialEndingSoon(userId, daysRemaining, logger);
    if (result) sent++;
  }

  logger.log(`[cron] trial_ending_soon: processed=${targets.length}, sent=${sent}`);
}

// ─── Plan expiration: daily check ───────────────────────────

async function processPlanExpiration(logger: Logger) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const completedJourneys = await db.journeys.findMany({
    where: {
      status: "completed",
      planned_days: 21,
    },
    select: { user_id: true, id: true },
  });

  let sent = 0;

  for (const { user_id } of completedJourneys) {
    const hasActiveJourney = await db.journeys.findFirst({
      where: { user_id, status: "active" },
    });
    if (hasActiveJourney) continue;

    const result = await Scenarios.notifyPlanExpiration(user_id, logger);
    if (result) sent++;
  }

  logger.log(`[cron] plan_expiration: sent=${sent}`);
}

// ─── Buddy inactivity: weekly ───────────────────────────────

async function processBuddyInactivity(logger: Logger) {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const activeLinks = await db.buddy_links.findMany({
    where: { status: "active" },
  });

  let sent = 0;

  for (const link of activeLinks) {
    const pairs: Array<[string, string]> = [
      [link.user_a, link.user_b],
      [link.user_b, link.user_a],
    ];

    for (const [userId, buddyId] of pairs) {
      const recentActivity = await db.user_task_progress.count({
        where: {
          user_id: buddyId,
          status: "completed",
          completed_at: { gte: fiveDaysAgo },
        },
      });

      if (recentActivity === 0) {
        const buddyProfile = await db.profiles.findUnique({
          where: { user_id: buddyId },
          select: { full_name: true },
        });

        const result = await Scenarios.notifyBuddyInactivity(
          userId,
          buddyProfile?.full_name ?? undefined,
          logger
        );
        if (result) sent++;
      }
    }
  }

  logger.log(`[cron] buddy_inactivity: sent=${sent}`);
}

// ─── Coach "stuck" detection: runs morning ──────────────────

async function processCoachStuckDetection(logger: Logger) {
  const users = await Scenarios.getUsersWithTwoMissRisk();
  let sent = 0;
  for (const userId of users) {
    const result = await Scenarios.notifyCoachStuckDetection(userId, logger);
    if (result) sent++;
  }
  logger.log(`[cron] coach_stuck_detection: processed=${users.length}, sent=${sent}`);
}

// ─── Phase transition coaching: runs morning ────────────────

async function processPhaseTransition(logger: Logger) {
  const phaseStartDays = [1, 8, 15];

  const activeJourneys = await db.journeys.findMany({
    where: { status: "active", start_date: { not: null } },
    select: { user_id: true, start_date: true, planned_days: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let sent = 0;

  for (const j of activeJourneys) {
    if (!j.start_date) continue;
    const startDate = new Date(j.start_date);
    startDate.setHours(0, 0, 0, 0);
    const dayNumber = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (dayNumber > 0 && dayNumber <= j.planned_days && phaseStartDays.includes(dayNumber)) {
      const result = await Scenarios.notifyCoachPhaseTransition(j.user_id, dayNumber);
      if (result) sent++;
    }
  }

  logger.log(`[cron] phase_transition: sent=${sent}`);
}

// ─── Next badge progress: morning check ─────────────────────

async function processNextBadgeProgress(logger: Logger) {
  const activeJourneys = await db.journeys.findMany({
    where: { status: "active" },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  let sent = 0;

  for (const { user_id } of activeJourneys) {
    const streak = await db.streaks.findFirst({
      where: { user_id, kind: "task_completion" },
    });
    const currentStreak = streak?.current_length ?? 0;

    const badgeRules = await db.badge_rules.findMany({
      where: { rule_type: "streak_days", is_active: true },
      include: { badge_definitions: true },
      orderBy: { threshold: "asc" },
    });

    const earnedBadges = await db.user_badges.findMany({
      where: { user_id },
      select: { badge_id: true },
    });
    const earnedSet = new Set(earnedBadges.map(b => b.badge_id));

    for (const rule of badgeRules) {
      if (earnedSet.has(rule.badge_id)) continue;
      if (rule.threshold - currentStreak === 1) {
        const result = await Scenarios.notifyNextBadgeProgress(user_id, rule.badge_definitions.name, logger);
        if (result) sent++;
        break;
      }
    }
  }

  logger.log(`[cron] next_badge_progress: sent=${sent}`);
}

// ─── Calendar/plan prompt: daily check ──────────────────────

async function processCalendarPlanPrompt(logger: Logger) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const unstartedJourneys = await db.journeys.findMany({
    where: {
      status: "planned",
      start_date: null,
      created_at: { lte: yesterday },
    },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  let sent = 0;
  for (const { user_id } of unstartedJourneys) {
    const result = await Scenarios.notifyCalendarPlanPrompt(user_id);
    if (result) sent++;
  }
  logger.log(`[cron] calendar_plan_prompt: sent=${sent}`);
}

// ─── Leaderboard rank change: weekly summary ────────────────

async function processLeaderboardRankChange(logger: Logger) {
  const activeJourneys = await db.journeys.findMany({
    where: { status: "active" },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  let sent = 0;
  for (const { user_id } of activeJourneys) {
    const result = await Scenarios.notifyLeaderboardRankChange(user_id, "Your rank changed this week.", logger);
    if (result) sent++;
  }
  logger.log(`[cron] leaderboard_rank_change: sent=${sent}`);
}

// ─── Streak freeze offered: daily check ─────────────────────

async function processStreakFreezeOffered(logger: Logger) {
  const qualifiedStreaks = await db.streaks.findMany({
    where: {
      kind: "task_completion",
      current_length: { gte: 7 },
      is_frozen: false,
    },
    select: { user_id: true },
  });

  let sent = 0;
  for (const { user_id } of qualifiedStreaks) {
    const tokens = await db.streak_freeze_tokens.findUnique({ where: { user_id } });
    if (!tokens || tokens.available === 0) {
      const result = await Scenarios.notifyStreakFreezeOffered(user_id);
      if (result) sent++;
    }
  }
  logger.log(`[cron] streak_freeze_offered: sent=${sent}`);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY: Start all cron jobs
// ═══════════════════════════════════════════════════════════════════

export async function startCronJobs(logger: Logger = console) {
  const cron = await getCron();
  if (!cron) return;

  // Every 5 minutes: timezone-aware daily scenario tick
  cron.schedule("*/5 * * * *", async () => {
    const now = new Date();
    try {
      await processTimezoneAwareScenarios(now, logger);
    } catch (e) {
      logger.error("[cron] timezone scenarios tick failed", e);
    }
  }, { timezone: "UTC" });

  // Every 5 minutes: streak at risk (processes evening users)
  cron.schedule("*/5 * * * *", async () => {
    try {
      await processStreakAtRisk(logger);
    } catch (e) {
      logger.error("[cron] streak_at_risk failed", e);
    }
  }, { timezone: "UTC" });

  // Every 5 minutes: missed day recovery + two-miss + coach check-ins + stuck detection
  cron.schedule("*/5 * * * *", async () => {
    try {
      await processMissedDayRecovery(logger);
      await processTwoMissRisk(logger);
      await processCoachDailyCheckin(logger);
      await processCoachReflectionPrompt(logger);
      await processCoachStuckDetection(logger);
    } catch (e) {
      logger.error("[cron] morning/evening batch failed", e);
    }
  }, { timezone: "UTC" });

  // Every 5 minutes: buddy nudge prompts (evening users)
  cron.schedule("*/5 * * * *", async () => {
    try {
      await processBuddyNudgePrompts(logger);
    } catch (e) {
      logger.error("[cron] buddy_nudge_prompts failed", e);
    }
  }, { timezone: "UTC" });

  // Monday 09:00 UTC: weekly leaderboard start
  cron.schedule("0 9 * * 1", async () => {
    try {
      await processLeaderboardWeeklyStart(logger);
    } catch (e) {
      logger.error("[cron] leaderboard_weekly_start failed", e);
    }
  }, { timezone: "UTC" });

  // Sunday 18:00 UTC: weekly reward summary + leaderboard rank change
  cron.schedule("0 18 * * 0", async () => {
    try {
      await processWeeklyRewardSummary(logger);
      await processLeaderboardRankChange(logger);
    } catch (e) {
      logger.error("[cron] weekly_reward_summary failed", e);
    }
  }, { timezone: "UTC" });

  // Daily 06:00 UTC: trial ending, plan expiration, buddy inactivity, phase transition, badges, plan prompt, freeze offered
  cron.schedule("0 6 * * *", async () => {
    try {
      await processTrialEndingSoon(logger);
      await processPlanExpiration(logger);
      await processBuddyInactivity(logger);
      await processPhaseTransition(logger);
      await processNextBadgeProgress(logger);
      await processCalendarPlanPrompt(logger);
      await processStreakFreezeOffered(logger);
    } catch (e) {
      logger.error("[cron] daily billing/expiration check failed", e);
    }
  }, { timezone: "UTC" });

  logger.log("[cron] Comprehensive notification cron jobs scheduled:");
  logger.log("  - */5 min  : timezone-aware daily scenarios (morning/midday/evening/high-risk)");
  logger.log("  - */5 min  : streak at risk, missed day, coach, buddy nudges, stuck detection");
  logger.log("  - Mon 09:00: weekly leaderboard start");
  logger.log("  - Sun 18:00: weekly reward summary + leaderboard rank change");
  logger.log("  - Daily 06:00: trial, plan expiry, buddy inactivity, phase transition, badges, plan prompt, freeze offered");
}
