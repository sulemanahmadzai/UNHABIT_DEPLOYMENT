/**
 * Notification Scenarios Service
 *
 * Implements ALL push notification scenarios from the Push Notification Spec.
 * Each function is an event trigger called from routes/services when the event occurs.
 * Time-based scenarios are driven by the cron service.
 *
 * Every send goes through governance (frequency cap, quiet hours, category check)
 * and uses privacy-safe templates by default.
 */

import { db } from "../lib/services.js";
import { sendPushToUser } from "./push-notifications.service.js";
import { checkDeliveryGate, recordNotificationSent, hasCompletedToday } from "./notification-governance.service.js";
import { getNotificationCopy, getPrivacySafeCopy, type ScenarioKey, type TemplateOptions } from "./notification-templates.service.js";
import { getCategoryDefinition } from "./notification-categories.service.js";

type Logger = Pick<Console, "log" | "error" | "warn">;

/**
 * Unified send helper: governance check → template → push → log.
 * Returns true if sent, false if suppressed.
 */
async function sendScenarioNotification(
  userId: string,
  category: string,
  scenario: ScenarioKey,
  opts: TemplateOptions & { data?: Record<string, any>; isBillingOrSecurity?: boolean } = {},
  logger: Logger = console
): Promise<boolean> {
  try {
    const gate = await checkDeliveryGate(
      userId,
      category,
      scenario,
      opts.isBillingOrSecurity ?? false
    );

    if (!gate.allowed) {
      logger.log(`[notify] suppressed ${scenario} for ${userId}: ${gate.reason}`);
      return false;
    }

    const copy = await getNotificationCopy(userId, scenario, opts);
    const catDef = getCategoryDefinition(category);

    const pushData: Record<string, any> = {
      screen: opts.data?.screen ?? "Notifications",
      params: opts.data?.params ?? JSON.stringify({}),
      kind: scenario,
      category,
      ...(catDef?.androidChannelId && { channelId: catDef.androidChannelId }),
      ...opts.data,
    };

    await sendPushToUser(userId, copy.title, copy.body, pushData);
    await recordNotificationSent(userId, category, scenario);

    logger.log(`[notify] sent ${scenario} to ${userId}`);
    return true;
  } catch (e) {
    logger.error(`[notify] failed ${scenario} for ${userId}`, e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CORE DAILY HABIT LOOP SCENARIOS (Category: daily_reminders)
// ═══════════════════════════════════════════════════════════════════

/**
 * Daily plan available: sent at user's chosen morning check-in time.
 * Trigger: cron (time-based, user timezone).
 */
export async function notifyDailyCheckinReady(userId: string, logger?: Logger) {
  const completed = await hasCompletedToday(userId);
  if (completed) return false;
  return sendScenarioNotification(userId, "daily_reminders", "daily_checkin_ready", {
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Task reminder: sent at 1st reminder window if checklist not started.
 * Trigger: cron (time-based).
 */
export async function notifyTaskReminder(userId: string, taskTitle?: string, logger?: Logger) {
  const completed = await hasCompletedToday(userId);
  if (completed) return false;
  return sendScenarioNotification(userId, "daily_reminders", "task_reminder", {
    ...(taskTitle != null && { taskTitle }),
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Midday rescue: no progress by midday.
 * Trigger: cron (time-based, ~12:00 user local time).
 */
export async function notifyMiddayRescue(userId: string, logger?: Logger) {
  const completed = await hasCompletedToday(userId);
  if (completed) return false;
  return sendScenarioNotification(userId, "daily_reminders", "midday_rescue", {
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Evening last call: not completed 2-3 hours before bedtime.
 * Trigger: cron (time-based, user's evening_lastcall_minute setting).
 */
export async function notifyEveningLastCall(userId: string, logger?: Logger) {
  const completed = await hasCompletedToday(userId);
  if (completed) return false;
  return sendScenarioNotification(userId, "daily_reminders", "evening_last_call", {
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Completion reinforcement: immediately after user taps "Complete Today".
 * Trigger: event (from progress.service when day is completed).
 */
export async function notifyCompletionReinforcement(userId: string, streakLength?: number) {
  return sendScenarioNotification(userId, "daily_reminders", "completion_reinforcement", {
    ...(streakLength != null && { streakLength }),
    data: { screen: "Home" },
  });
}

/**
 * Micro-streak reinforcement: 2+ days in a row.
 * Trigger: event (from progress.service on day completion check).
 */
export async function notifyMicroStreak(userId: string, streakLength: number) {
  if (streakLength < 2) return false;
  return sendScenarioNotification(userId, "daily_reminders", "micro_streak", {
    streakLength,
    data: { screen: "Home" },
  });
}

/**
 * Day reset + clean slate: user missed yesterday, morning notification.
 * Trigger: cron (time-based, morning).
 */
export async function notifyDayResetCleanSlate(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "daily_reminders", "day_reset_clean_slate", {
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * "Open app" nudge: user hasn't opened app today, midday.
 * Trigger: cron (time-based, midday).
 */
export async function notifyOpenAppNudge(userId: string, logger?: Logger) {
  const completed = await hasCompletedToday(userId);
  if (completed) return false;
  return sendScenarioNotification(userId, "daily_reminders", "open_app_nudge", {
    data: { screen: "Home" },
  }, logger);
}

/**
 * Habit health movement: significant change in habit health metric.
 * Trigger: event (from analytics or progress service).
 */
export async function notifyHabitHealthChange(userId: string) {
  return sendScenarioNotification(userId, "daily_reminders", "habit_health_change", {
    data: { screen: "Analytics" },
  });
}

/**
 * Calendar/plan prompt: user viewed plan but didn't schedule.
 * Trigger: event (within 24 hours of viewing).
 */
export async function notifyCalendarPlanPrompt(userId: string) {
  return sendScenarioNotification(userId, "daily_reminders", "calendar_plan_prompt", {
    data: { screen: "Settings" },
  });
}

// ═══════════════════════════════════════════════════════════════════
// STREAK PROTECTION & RELAPSE SCENARIOS (Category: streak_protection)
// ═══════════════════════════════════════════════════════════════════

/**
 * Streak at risk: late in the day, day incomplete, active streak.
 * Trigger: cron (evening, only if streak > 0 and no completion today).
 */
export async function notifyStreakAtRisk(userId: string, streakLength?: number, logger?: Logger) {
  return sendScenarioNotification(userId, "streak_protection", "streak_at_risk", {
    ...(streakLength != null && { streakLength }),
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Missed-day recovery: user missed yesterday, morning "no shame" message.
 * Trigger: cron (morning, after detecting yesterday was missed).
 */
export async function notifyMissedDayRecovery(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "streak_protection", "missed_day_recovery", {
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Two-miss risk: user missed 2 of last 3 days.
 * Trigger: cron (morning or midday).
 */
export async function notifyTwoMissRisk(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "streak_protection", "two_miss_risk", {
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Relapse logged: user logged a slip/relapse event.
 * Trigger: event (from progress.service when slip is recorded).
 */
export async function notifyRelapsLogged(userId: string) {
  return sendScenarioNotification(userId, "streak_protection", "relapse_logged", {
    data: { screen: "Recovery" },
  });
}

/**
 * High-risk window: user-selected trigger time (e.g., after work, late night).
 * Trigger: cron (scheduled in user's chosen high-risk window).
 * Opt-in only.
 */
export async function notifyHighRiskWindow(userId: string, logger?: Logger) {
  const settings = await db.notification_settings.findUnique({ where: { user_id: userId } });
  if (!settings?.high_risk_reminders) return false;
  return sendScenarioNotification(userId, "streak_protection", "high_risk_window", {
    data: { screen: "FocusTools" },
  }, logger);
}

/**
 * Weekend support: habit categories that suggest weekends are hard.
 * Trigger: cron (Fri/Sat at user time, only if opted in).
 */
export async function notifyWeekendSupport(userId: string, logger?: Logger) {
  const settings = await db.notification_settings.findUnique({ where: { user_id: userId } });
  if (!settings?.weekend_support) return false;
  return sendScenarioNotification(userId, "streak_protection", "weekend_support", {
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Streak freeze offered: user qualifies (e.g., 7-day streak).
 * Trigger: event (from streaks.service when qualifying condition met).
 */
export async function notifyStreakFreezeOffered(userId: string) {
  return sendScenarioNotification(userId, "streak_protection", "streak_freeze_offered", {
    data: { screen: "Streaks" },
  });
}

/**
 * Streak freeze used: confirmation.
 * Trigger: event (from streaks.service when freeze is used).
 */
export async function notifyStreakFreezeUsed(userId: string) {
  return sendScenarioNotification(userId, "streak_protection", "streak_freeze_used", {
    data: { screen: "Streaks" },
  });
}

/**
 * Streak milestone: 7/14/21 days.
 * Trigger: event (from progress/streak service on completion).
 */
export async function notifyStreakMilestone(userId: string, streakLength: number) {
  return sendScenarioNotification(userId, "streak_protection", "streak_milestone", {
    streakLength,
    data: { screen: "Streaks" },
  });
}

/**
 * Post-21 maintenance: day 21 completed, transition to maintenance.
 * Trigger: event (from journeys.service when day 21 completes).
 */
export async function notifyPost21Maintenance(userId: string) {
  return sendScenarioNotification(userId, "streak_protection", "post_21_maintenance", {
    data: { screen: "Journey" },
  });
}

// ═══════════════════════════════════════════════════════════════════
// COACH NUDGE SCENARIOS (Category: coach_nudge)
// ═══════════════════════════════════════════════════════════════════

/**
 * New coach reply: AI coach responded to user's message.
 * Trigger: event (from coach.service when AI responds).
 */
export async function notifyCoachReply(userId: string, sessionId?: string) {
  return sendScenarioNotification(userId, "coach_nudge", "coach_reply", {
    data: { screen: "CoachChat", params: JSON.stringify({ sessionId }) },
  });
}

/**
 * Daily proactive coach check-in: user opted into coach nudges.
 * Trigger: cron (morning or user-chosen time, max 1/day).
 */
export async function notifyCoachDailyCheckin(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "coach_nudge", "coach_daily_checkin", {
    data: { screen: "CoachChat" },
  }, logger);
}

/**
 * "You're stuck" detection: user repeats same struggle or misses tasks.
 * Trigger: cron/event (next day after detection).
 */
export async function notifyCoachStuckDetection(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "coach_nudge", "coach_stuck_detection", {
    data: { screen: "JourneyToday" },
  }, logger);
}

/**
 * Phase transition coaching: user enters new phase of the plan.
 * Trigger: event (when journey day transitions to new phase).
 */
export async function notifyCoachPhaseTransition(userId: string, dayNumber: number) {
  return sendScenarioNotification(userId, "coach_nudge", "coach_phase_transition", {
    dayNumber,
    data: { screen: "CoachChat" },
  });
}

/**
 * Skill tool suggestion: user logs trigger (stress, boredom).
 * Trigger: event (shortly after logging a trigger/slip).
 */
export async function notifyCoachSkillSuggestion(userId: string) {
  return sendScenarioNotification(userId, "coach_nudge", "coach_skill_suggestion", {
    data: { screen: "FocusTools" },
  });
}

/**
 * Reflection prompt: after completion, evening.
 * Trigger: cron (evening, after completion).
 */
export async function notifyCoachReflectionPrompt(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "coach_nudge", "coach_reflection_prompt", {
    data: { screen: "Reflection" },
  }, logger);
}

// ═══════════════════════════════════════════════════════════════════
// BUDDY & SOCIAL SCENARIOS (Category: buddy_social)
// ═══════════════════════════════════════════════════════════════════

/**
 * Buddy invite received.
 * Trigger: event (when someone creates invite targeting this user).
 */
export async function notifyBuddyInviteReceived(userId: string) {
  return sendScenarioNotification(userId, "buddy_social", "buddy_invite_received", {
    data: { screen: "BuddyInvites" },
  });
}

/**
 * Buddy invite accepted: notify the inviter.
 * Trigger: event (when acceptInvite succeeds).
 */
export async function notifyBuddyInviteAccepted(inviterId: string, buddyName?: string) {
  return sendScenarioNotification(inviterId, "buddy_social", "buddy_invite_accepted", {
    ...(buddyName != null && { buddyName }),
    data: { screen: "Buddies" },
  });
}

/**
 * Buddy completed today: notify user that buddy finished tasks.
 * Trigger: event (when buddy completes day; opt-in).
 */
export async function notifyBuddyCompletedToday(userId: string, buddyName?: string) {
  return sendScenarioNotification(userId, "buddy_social", "buddy_completed_today", {
    ...(buddyName != null && { buddyName }),
    data: { screen: "Buddies" },
  });
}

/**
 * Buddy streak milestone: buddy hits 7/14/21 days.
 * Trigger: event (from streak milestone check).
 */
export async function notifyBuddyStreakMilestone(
  userId: string,
  buddyName: string,
  streakLength: number
) {
  return sendScenarioNotification(userId, "buddy_social", "buddy_streak_milestone", {
    buddyName,
    streakLength,
    data: { screen: "Buddies" },
  });
}

/**
 * "Nudge your buddy" prompt: user completed, buddy hasn't (opt-in).
 * Trigger: cron (evening).
 */
export async function notifyNudgeYourBuddy(
  userId: string,
  buddyName?: string,
  logger?: Logger
) {
  return sendScenarioNotification(userId, "buddy_social", "nudge_your_buddy", {
    ...(buddyName != null && { buddyName }),
    data: { screen: "Buddies" },
  }, logger);
}

/**
 * Leaderboard weekly start: new weekly leaderboard begins.
 * Trigger: cron (Monday morning).
 */
export async function notifyLeaderboardWeeklyStart(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "buddy_social", "leaderboard_weekly_start", {
    data: { screen: "Leaderboard" },
  }, logger);
}

/**
 * Leaderboard rank change: rank crosses meaningful threshold.
 * Trigger: cron (weekly summary time).
 */
export async function notifyLeaderboardRankChange(
  userId: string,
  rankChange: string,
  logger?: Logger
) {
  return sendScenarioNotification(userId, "buddy_social", "leaderboard_rank_change", {
    rankChange,
    data: { screen: "Leaderboard" },
  }, logger);
}

/**
 * Buddy inactivity support: buddy inactive for X days (opt-in).
 * Trigger: cron (weekly).
 */
export async function notifyBuddyInactivity(
  userId: string,
  buddyName?: string,
  logger?: Logger
) {
  return sendScenarioNotification(userId, "buddy_social", "buddy_inactivity", {
    ...(buddyName != null && { buddyName }),
    data: { screen: "Buddies" },
  }, logger);
}

// ═══════════════════════════════════════════════════════════════════
// REWARDS, XP, BADGES (Category: rewards_xp)
// ═══════════════════════════════════════════════════════════════════

/**
 * XP earned confirmation.
 * Trigger: event (on task completion, kept light — only notable amounts).
 */
export async function notifyXpEarned(userId: string, xpAmount: number) {
  if (xpAmount < 10) return false; // Only notify for meaningful XP
  return sendScenarioNotification(userId, "rewards_xp", "xp_earned", {
    xpAmount,
    data: { screen: "Rewards" },
  });
}

/**
 * Level up notification.
 * Trigger: event (when XP crosses level threshold).
 */
export async function notifyLevelUp(userId: string, level: number) {
  return sendScenarioNotification(userId, "rewards_xp", "level_up", {
    level,
    data: { screen: "Rewards" },
  });
}

/**
 * Badge unlocked.
 * Trigger: event (from badge-awarding.service).
 */
export async function notifyBadgeUnlocked(userId: string, badgeName: string) {
  return sendScenarioNotification(userId, "rewards_xp", "badge_unlocked", {
    badgeName,
    data: { screen: "BadgeGallery" },
  });
}

/**
 * Next badge progress: user is 1 day away from a badge.
 * Trigger: cron (morning).
 */
export async function notifyNextBadgeProgress(userId: string, badgeName: string, logger?: Logger) {
  return sendScenarioNotification(userId, "rewards_xp", "next_badge_progress", {
    badgeName,
    data: { screen: "BadgeGallery" },
  }, logger);
}

/**
 * Weekly reward summary.
 * Trigger: cron (weekly, user's chosen time).
 */
export async function notifyWeeklyRewardSummary(
  userId: string,
  daysCompleted: number,
  xpEarned: number,
  logger?: Logger
) {
  return sendScenarioNotification(userId, "weekly_review", "weekly_reward_summary", {
    dayNumber: daysCompleted,
    xpAmount: xpEarned,
    data: { screen: "Rewards" },
  }, logger);
}

/**
 * Share prompt: user hit a milestone.
 * Trigger: event (after milestone, next day).
 */
export async function notifySharePrompt(userId: string) {
  return sendScenarioNotification(userId, "rewards_xp", "share_prompt", {
    data: { screen: "Share" },
  });
}

// ═══════════════════════════════════════════════════════════════════
// ACCOUNT & BILLING SCENARIOS (Category: account_billing)
// ═══════════════════════════════════════════════════════════════════

/**
 * Trial started.
 * Trigger: event (from stripe.service on trial creation).
 */
export async function notifyTrialStarted(userId: string) {
  return sendScenarioNotification(userId, "account_billing", "trial_started", {
    isBillingOrSecurity: true,
    data: { screen: "Settings" },
  });
}

/**
 * Trial ending soon (48h/24h before).
 * Trigger: cron (scheduled check against subscription trial_end).
 */
export async function notifyTrialEndingSoon(userId: string, daysRemaining: number, logger?: Logger) {
  return sendScenarioNotification(userId, "account_billing", "trial_ending_soon", {
    daysRemaining,
    isBillingOrSecurity: true,
    data: { screen: "Subscription" },
  }, logger);
}

/**
 * Subscription renewed.
 * Trigger: event (from stripe webhook handler).
 */
export async function notifySubscriptionRenewed(userId: string) {
  return sendScenarioNotification(userId, "account_billing", "subscription_renewed", {
    isBillingOrSecurity: true,
    data: { screen: "Settings" },
  });
}

/**
 * Billing failure.
 * Trigger: event (from stripe webhook handler).
 */
export async function notifyBillingFailure(userId: string) {
  return sendScenarioNotification(userId, "account_billing", "billing_failure", {
    isBillingOrSecurity: true,
    data: { screen: "Subscription" },
  });
}

/**
 * Plan expiration: 21-day plan finished, next day.
 * Trigger: cron (day after plan ends).
 */
export async function notifyPlanExpiration(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "account_billing", "plan_expiration", {
    isBillingOrSecurity: false,
    data: { screen: "Journey" },
  }, logger);
}

/**
 * Promotional offer (only if user opted into promotions).
 * Trigger: event/cron (marketing decision).
 */
export async function notifyPromotionalOffer(userId: string, logger?: Logger) {
  return sendScenarioNotification(userId, "promotions", "promotional_offer", {
    data: { screen: "Subscription" },
  }, logger);
}

// ═══════════════════════════════════════════════════════════════════
// BATCH HELPERS (for cron jobs processing multiple users)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all users with active journeys who haven't completed today.
 */
export async function getUsersWithIncompleteDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeJourneys = await db.journeys.findMany({
    where: { status: "active" },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const userIds = activeJourneys.map((j) => j.user_id);
  if (userIds.length === 0) return [];

  const completedUsers = await db.user_task_progress.groupBy({
    by: ["user_id"],
    where: {
      user_id: { in: userIds },
      status: "completed",
      completed_at: { gte: today },
    },
  });

  const completedSet = new Set(completedUsers.map((c) => c.user_id));
  return userIds.filter((id) => !completedSet.has(id));
}

/**
 * Get users who missed yesterday (had active journey but no completions).
 */
export async function getUsersWhoMissedYesterday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const activeJourneys = await db.journeys.findMany({
    where: { status: "active" },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const userIds = activeJourneys.map((j) => j.user_id);
  if (userIds.length === 0) return [];

  const completedYesterday = await db.user_task_progress.groupBy({
    by: ["user_id"],
    where: {
      user_id: { in: userIds },
      status: "completed",
      completed_at: { gte: yesterday, lt: today },
    },
  });

  const completedSet = new Set(completedYesterday.map((c) => c.user_id));
  return userIds.filter((id) => !completedSet.has(id));
}

/**
 * Get users who missed 2 of last 3 days.
 */
export async function getUsersWithTwoMissRisk() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const activeJourneys = await db.journeys.findMany({
    where: { status: "active" },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const userIds = activeJourneys.map((j) => j.user_id);
  if (userIds.length === 0) return [];

  const result: string[] = [];

  for (const userId of userIds) {
    let missedCount = 0;
    for (let i = 1; i <= 3; i++) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await db.user_task_progress.count({
        where: {
          user_id: userId,
          status: "completed",
          completed_at: { gte: dayStart, lt: dayEnd },
        },
      });

      if (count === 0) missedCount++;
    }
    if (missedCount >= 2) result.push(userId);
  }

  return result;
}

/**
 * Get users with streaks at risk (streak > 0, not completed today).
 */
export async function getUsersWithStreaksAtRisk() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const streaks = await db.streaks.findMany({
    where: {
      kind: "task_completion",
      current_length: { gt: 0 },
      is_frozen: false,
    },
    select: { user_id: true, current_length: true },
  });

  if (streaks.length === 0) return [];

  const userIds = streaks.map((s) => s.user_id);
  const completedToday = await db.user_task_progress.groupBy({
    by: ["user_id"],
    where: {
      user_id: { in: userIds },
      status: "completed",
      completed_at: { gte: today },
    },
  });

  const completedSet = new Set(completedToday.map((c) => c.user_id));
  const streakMap = new Map(streaks.map((s) => [s.user_id, s.current_length]));

  return streaks
    .filter((s) => !completedSet.has(s.user_id))
    .map((s) => ({ userId: s.user_id, streakLength: s.current_length }));
}

/**
 * Get buddy pairs where user completed today but buddy hasn't.
 */
export async function getBuddyNudgeTargets() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeLinks = await db.buddy_links.findMany({
    where: { status: "active" },
  });

  const allUserIds = new Set<string>();
  for (const link of activeLinks) {
    allUserIds.add(link.user_a);
    allUserIds.add(link.user_b);
  }

  const completedToday = await db.user_task_progress.groupBy({
    by: ["user_id"],
    where: {
      user_id: { in: Array.from(allUserIds) },
      status: "completed",
      completed_at: { gte: today },
    },
  });

  const completedSet = new Set(completedToday.map((c) => c.user_id));

  const targets: Array<{ userId: string; buddyName: string | null }> = [];

  for (const link of activeLinks) {
    const userACompleted = completedSet.has(link.user_a);
    const userBCompleted = completedSet.has(link.user_b);

    if (userACompleted && !userBCompleted) {
      const profile = await db.profiles.findUnique({
        where: { user_id: link.user_b },
        select: { full_name: true },
      });
      targets.push({ userId: link.user_a, buddyName: profile?.full_name ?? null });
    }
    if (userBCompleted && !userACompleted) {
      const profile = await db.profiles.findUnique({
        where: { user_id: link.user_a },
        select: { full_name: true },
      });
      targets.push({ userId: link.user_b, buddyName: profile?.full_name ?? null });
    }
  }

  return targets;
}

/**
 * Get users with trials ending within N days.
 */
export async function getUsersWithTrialEndingSoon(withinDays: number) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + withinDays);

  const subs = await db.subscriptions.findMany({
    where: {
      status: "trialing",
      trial_end: { gte: now, lte: cutoff },
    },
    select: { user_id: true, trial_end: true },
  });

  return subs.map((s) => ({
    userId: s.user_id,
    daysRemaining: Math.ceil(
      ((s.trial_end?.getTime() ?? now.getTime()) - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
}
