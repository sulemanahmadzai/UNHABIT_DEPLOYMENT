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
type Logger = Pick<Console, "log" | "error" | "warn">;
/**
 * Daily plan available: sent at user's chosen morning check-in time.
 * Trigger: cron (time-based, user timezone).
 */
export declare function notifyDailyCheckinReady(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Task reminder: sent at 1st reminder window if checklist not started.
 * Trigger: cron (time-based).
 */
export declare function notifyTaskReminder(userId: string, taskTitle?: string, logger?: Logger): Promise<boolean>;
/**
 * Midday rescue: no progress by midday.
 * Trigger: cron (time-based, ~12:00 user local time).
 */
export declare function notifyMiddayRescue(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Evening last call: not completed 2-3 hours before bedtime.
 * Trigger: cron (time-based, user's evening_lastcall_minute setting).
 */
export declare function notifyEveningLastCall(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Completion reinforcement: immediately after user taps "Complete Today".
 * Trigger: event (from progress.service when day is completed).
 */
export declare function notifyCompletionReinforcement(userId: string, streakLength?: number): Promise<boolean>;
/**
 * Micro-streak reinforcement: 2+ days in a row.
 * Trigger: event (from progress.service on day completion check).
 */
export declare function notifyMicroStreak(userId: string, streakLength: number): Promise<boolean>;
/**
 * Day reset + clean slate: user missed yesterday, morning notification.
 * Trigger: cron (time-based, morning).
 */
export declare function notifyDayResetCleanSlate(userId: string, logger?: Logger): Promise<boolean>;
/**
 * "Open app" nudge: user hasn't opened app today, midday.
 * Trigger: cron (time-based, midday).
 */
export declare function notifyOpenAppNudge(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Habit health movement: significant change in habit health metric.
 * Trigger: event (from analytics or progress service).
 */
export declare function notifyHabitHealthChange(userId: string): Promise<boolean>;
/**
 * Calendar/plan prompt: user viewed plan but didn't schedule.
 * Trigger: event (within 24 hours of viewing).
 */
export declare function notifyCalendarPlanPrompt(userId: string): Promise<boolean>;
/**
 * Streak at risk: late in the day, day incomplete, active streak.
 * Trigger: cron (evening, only if streak > 0 and no completion today).
 */
export declare function notifyStreakAtRisk(userId: string, streakLength?: number, logger?: Logger): Promise<boolean>;
/**
 * Missed-day recovery: user missed yesterday, morning "no shame" message.
 * Trigger: cron (morning, after detecting yesterday was missed).
 */
export declare function notifyMissedDayRecovery(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Two-miss risk: user missed 2 of last 3 days.
 * Trigger: cron (morning or midday).
 */
export declare function notifyTwoMissRisk(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Relapse logged: user logged a slip/relapse event.
 * Trigger: event (from progress.service when slip is recorded).
 */
export declare function notifyRelapsLogged(userId: string): Promise<boolean>;
/**
 * High-risk window: user-selected trigger time (e.g., after work, late night).
 * Trigger: cron (scheduled in user's chosen high-risk window).
 * Opt-in only.
 */
export declare function notifyHighRiskWindow(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Weekend support: habit categories that suggest weekends are hard.
 * Trigger: cron (Fri/Sat at user time, only if opted in).
 */
export declare function notifyWeekendSupport(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Streak freeze offered: user qualifies (e.g., 7-day streak).
 * Trigger: event (from streaks.service when qualifying condition met).
 */
export declare function notifyStreakFreezeOffered(userId: string): Promise<boolean>;
/**
 * Streak freeze used: confirmation.
 * Trigger: event (from streaks.service when freeze is used).
 */
export declare function notifyStreakFreezeUsed(userId: string): Promise<boolean>;
/**
 * Streak milestone: 7/14/21 days.
 * Trigger: event (from progress/streak service on completion).
 */
export declare function notifyStreakMilestone(userId: string, streakLength: number): Promise<boolean>;
/**
 * Post-21 maintenance: day 21 completed, transition to maintenance.
 * Trigger: event (from journeys.service when day 21 completes).
 */
export declare function notifyPost21Maintenance(userId: string): Promise<boolean>;
/**
 * New coach reply: AI coach responded to user's message.
 * Trigger: event (from coach.service when AI responds).
 */
export declare function notifyCoachReply(userId: string, sessionId?: string): Promise<boolean>;
/**
 * Daily proactive coach check-in: user opted into coach nudges.
 * Trigger: cron (morning or user-chosen time, max 1/day).
 */
export declare function notifyCoachDailyCheckin(userId: string, logger?: Logger): Promise<boolean>;
/**
 * "You're stuck" detection: user repeats same struggle or misses tasks.
 * Trigger: cron/event (next day after detection).
 */
export declare function notifyCoachStuckDetection(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Phase transition coaching: user enters new phase of the plan.
 * Trigger: event (when journey day transitions to new phase).
 */
export declare function notifyCoachPhaseTransition(userId: string, dayNumber: number): Promise<boolean>;
/**
 * Skill tool suggestion: user logs trigger (stress, boredom).
 * Trigger: event (shortly after logging a trigger/slip).
 */
export declare function notifyCoachSkillSuggestion(userId: string): Promise<boolean>;
/**
 * Reflection prompt: after completion, evening.
 * Trigger: cron (evening, after completion).
 */
export declare function notifyCoachReflectionPrompt(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Buddy invite received.
 * Trigger: event (when someone creates invite targeting this user).
 */
export declare function notifyBuddyInviteReceived(userId: string): Promise<boolean>;
/**
 * Buddy invite accepted: notify the inviter.
 * Trigger: event (when acceptInvite succeeds).
 */
export declare function notifyBuddyInviteAccepted(inviterId: string, buddyName?: string): Promise<boolean>;
/**
 * Buddy completed today: notify user that buddy finished tasks.
 * Trigger: event (when buddy completes day; opt-in).
 */
export declare function notifyBuddyCompletedToday(userId: string, buddyName?: string): Promise<boolean>;
/**
 * Buddy streak milestone: buddy hits 7/14/21 days.
 * Trigger: event (from streak milestone check).
 */
export declare function notifyBuddyStreakMilestone(userId: string, buddyName: string, streakLength: number): Promise<boolean>;
/**
 * "Nudge your buddy" prompt: user completed, buddy hasn't (opt-in).
 * Trigger: cron (evening).
 */
export declare function notifyNudgeYourBuddy(userId: string, buddyName?: string, logger?: Logger): Promise<boolean>;
/**
 * Leaderboard weekly start: new weekly leaderboard begins.
 * Trigger: cron (Monday morning).
 */
export declare function notifyLeaderboardWeeklyStart(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Leaderboard rank change: rank crosses meaningful threshold.
 * Trigger: cron (weekly summary time).
 */
export declare function notifyLeaderboardRankChange(userId: string, rankChange: string, logger?: Logger): Promise<boolean>;
/**
 * Buddy inactivity support: buddy inactive for X days (opt-in).
 * Trigger: cron (weekly).
 */
export declare function notifyBuddyInactivity(userId: string, buddyName?: string, logger?: Logger): Promise<boolean>;
/**
 * XP earned confirmation.
 * Trigger: event (on task completion, kept light — only notable amounts).
 */
export declare function notifyXpEarned(userId: string, xpAmount: number): Promise<boolean>;
/**
 * Level up notification.
 * Trigger: event (when XP crosses level threshold).
 */
export declare function notifyLevelUp(userId: string, level: number): Promise<boolean>;
/**
 * Badge unlocked.
 * Trigger: event (from badge-awarding.service).
 */
export declare function notifyBadgeUnlocked(userId: string, badgeName: string): Promise<boolean>;
/**
 * Next badge progress: user is 1 day away from a badge.
 * Trigger: cron (morning).
 */
export declare function notifyNextBadgeProgress(userId: string, badgeName: string, logger?: Logger): Promise<boolean>;
/**
 * Weekly reward summary.
 * Trigger: cron (weekly, user's chosen time).
 */
export declare function notifyWeeklyRewardSummary(userId: string, daysCompleted: number, xpEarned: number, logger?: Logger): Promise<boolean>;
/**
 * Share prompt: user hit a milestone.
 * Trigger: event (after milestone, next day).
 */
export declare function notifySharePrompt(userId: string): Promise<boolean>;
/**
 * Trial started.
 * Trigger: event (from stripe.service on trial creation).
 */
export declare function notifyTrialStarted(userId: string): Promise<boolean>;
/**
 * Trial ending soon (48h/24h before).
 * Trigger: cron (scheduled check against subscription trial_end).
 */
export declare function notifyTrialEndingSoon(userId: string, daysRemaining: number, logger?: Logger): Promise<boolean>;
/**
 * Subscription renewed.
 * Trigger: event (from stripe webhook handler).
 */
export declare function notifySubscriptionRenewed(userId: string): Promise<boolean>;
/**
 * Billing failure.
 * Trigger: event (from stripe webhook handler).
 */
export declare function notifyBillingFailure(userId: string): Promise<boolean>;
/**
 * Plan expiration: 21-day plan finished, next day.
 * Trigger: cron (day after plan ends).
 */
export declare function notifyPlanExpiration(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Promotional offer (only if user opted into promotions).
 * Trigger: event/cron (marketing decision).
 */
export declare function notifyPromotionalOffer(userId: string, logger?: Logger): Promise<boolean>;
/**
 * Get all users with active journeys who haven't completed today.
 */
export declare function getUsersWithIncompleteDays(): Promise<string[]>;
/**
 * Get users who missed yesterday (had active journey but no completions).
 */
export declare function getUsersWhoMissedYesterday(): Promise<string[]>;
/**
 * Get users who missed 2 of last 3 days.
 */
export declare function getUsersWithTwoMissRisk(): Promise<string[]>;
/**
 * Get users with streaks at risk (streak > 0, not completed today).
 */
export declare function getUsersWithStreaksAtRisk(): Promise<{
    userId: string;
    streakLength: number;
}[]>;
/**
 * Get buddy pairs where user completed today but buddy hasn't.
 */
export declare function getBuddyNudgeTargets(): Promise<{
    userId: string;
    buddyName: string | null;
}[]>;
/**
 * Get users with trials ending within N days.
 */
export declare function getUsersWithTrialEndingSoon(withinDays: number): Promise<{
    userId: string;
    daysRemaining: number;
}[]>;
export {};
//# sourceMappingURL=notification-scenarios.service.d.ts.map