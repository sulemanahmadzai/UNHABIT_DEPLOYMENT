/**
 * Notification Templates Service
 *
 * Privacy-safe copy templates for all push notification scenarios.
 * Default: generic supportive language (no habit details on lock screen).
 * Detailed: includes habit specifics (only if user opted in via show_habit_details_lockscreen).
 *
 * Per Apple 4.5.4: push must not send sensitive personal info.
 * Android: lock-screen "sensitive content hidden" support.
 */
import { db } from "../lib/services.js";
const PRIVACY_SAFE_TEMPLATES = {
    // --- Core daily habit loop ---
    daily_checkin_ready: () => ({
        title: "Good morning",
        body: "Your daily check-in is ready.",
    }),
    task_reminder: () => ({
        title: "Reminder",
        body: "Small step today — tap to continue.",
    }),
    midday_rescue: () => ({
        title: "Quick win available",
        body: "Small steps still count. Want to do today's micro-task?",
    }),
    evening_last_call: () => ({
        title: "Almost done",
        body: "You're close — finish today in under 2 minutes.",
    }),
    completion_reinforcement: (opts) => ({
        title: "Nice work!",
        body: opts.streakLength
            ? `Streak protected. ${opts.streakLength} days strong.`
            : "Streak protected. Nice work today.",
    }),
    micro_streak: (opts) => ({
        title: "Momentum building",
        body: `${opts.streakLength ?? 2} days strong. Keep it going!`,
    }),
    day_reset_clean_slate: () => ({
        title: "Fresh start",
        body: "New day, fresh start. Today's step is ready.",
    }),
    open_app_nudge: () => ({
        title: "Check in",
        body: "Your check-in is waiting — no pressure, just progress.",
    }),
    habit_health_change: () => ({
        title: "Progress update",
        body: "Your progress moved — see what changed.",
    }),
    calendar_plan_prompt: () => ({
        title: "Plan your day",
        body: "Want to set a reminder time that fits your day?",
    }),
    // --- Streak protection & relapse ---
    streak_at_risk: () => ({
        title: "Protect your streak",
        body: "Want to protect your streak tonight?",
    }),
    missed_day_recovery: () => ({
        title: "Fresh start today",
        body: "Fresh start today. One small win is enough.",
    }),
    two_miss_risk: () => ({
        title: "Quick restart",
        body: "Restart with a tiny step — tap to begin.",
    }),
    relapse_logged: () => ({
        title: "Recovery plan ready",
        body: "Setbacks happen. Your recovery plan is ready — tap to see.",
    }),
    high_risk_window: () => ({
        title: "Support reminder",
        body: "This is your high-risk time. Tools are ready for you.",
    }),
    weekend_support: () => ({
        title: "Weekend check-in",
        body: "Weekend can be tough. Your plan is ready.",
    }),
    streak_freeze_offered: () => ({
        title: "Freeze available",
        body: "You've earned a streak freeze. Use it to protect your progress.",
    }),
    streak_freeze_used: () => ({
        title: "Freeze activated",
        body: "Streak protected. Tomorrow is a fresh day.",
    }),
    streak_milestone: (opts) => ({
        title: "Milestone reached!",
        body: `${opts.streakLength ?? 7} days — incredible consistency!`,
    }),
    post_21_maintenance: () => ({
        title: "Plan complete",
        body: "Your 21-day plan is complete. See what's next.",
    }),
    // --- Coach ---
    coach_reply: () => ({
        title: "Coach Nudge",
        body: "Coach Nudge replied — tap to see your next step.",
    }),
    coach_daily_checkin: () => ({
        title: "Coach check-in",
        body: "Your coach has a message for you today.",
    }),
    coach_stuck_detection: () => ({
        title: "Simpler step ready",
        body: "Let's try something different. A simpler task is waiting.",
    }),
    coach_phase_transition: (opts) => ({
        title: "New phase",
        body: opts.dayNumber
            ? `Day ${opts.dayNumber} starts a new phase. See what changes.`
            : "A new phase begins. See what changes now.",
    }),
    coach_skill_suggestion: () => ({
        title: "Coping tool",
        body: "Try the 60-second urge surf tool now.",
    }),
    coach_reflection_prompt: () => ({
        title: "Reflection time",
        body: "Take a moment to reflect on today's progress.",
    }),
    // --- Buddy & social ---
    buddy_invite_received: () => ({
        title: "Buddy invite",
        body: "You got a new buddy invite.",
    }),
    buddy_invite_accepted: (opts) => ({
        title: "Buddy connected",
        body: opts.buddyName
            ? `${opts.buddyName} accepted your invite!`
            : "Your buddy invite was accepted!",
    }),
    buddy_completed_today: (opts) => ({
        title: "Buddy update",
        body: opts.buddyName
            ? `${opts.buddyName} completed today's tasks.`
            : "Your buddy completed today's tasks.",
    }),
    buddy_streak_milestone: (opts) => ({
        title: "Buddy milestone",
        body: opts.buddyName
            ? `${opts.buddyName} hit a ${opts.streakLength ?? 7}-day streak!`
            : `Your buddy hit a ${opts.streakLength ?? 7}-day streak!`,
    }),
    nudge_your_buddy: (opts) => ({
        title: "Encourage your buddy",
        body: opts.buddyName
            ? `${opts.buddyName} hasn't checked in yet. Send encouragement?`
            : "Your buddy hasn't checked in yet. Send encouragement?",
    }),
    leaderboard_weekly_start: () => ({
        title: "New week",
        body: "The weekly leaderboard just reset. Time to climb!",
    }),
    leaderboard_rank_change: (opts) => ({
        title: "Leaderboard update",
        body: opts.rankChange ?? "Your leaderboard rank changed this week.",
    }),
    buddy_inactivity: (opts) => ({
        title: "Check on buddy",
        body: opts.buddyName
            ? `${opts.buddyName} has been quiet. Want to send a check-in?`
            : "Your buddy has been quiet. Want to send a check-in?",
    }),
    // --- Rewards & XP ---
    xp_earned: (opts) => ({
        title: "XP earned",
        body: `+${opts.xpAmount ?? 0} XP earned!`,
    }),
    level_up: (opts) => ({
        title: "Level up!",
        body: `Level ${opts.level ?? 2} unlocked — see your new badge path.`,
    }),
    badge_unlocked: (opts) => ({
        title: "Badge unlocked!",
        body: opts.badgeName
            ? `You earned the "${opts.badgeName}" badge!`
            : "You earned a new badge!",
    }),
    next_badge_progress: (opts) => ({
        title: "Almost there",
        body: opts.badgeName
            ? `1 day away from the "${opts.badgeName}" badge!`
            : "You're 1 day away from your next badge!",
    }),
    weekly_reward_summary: (opts) => ({
        title: "Your week in review",
        body: opts.xpAmount
            ? `${opts.dayNumber ?? 0} days completed, ${opts.xpAmount} XP earned this week.`
            : "See your weekly progress summary.",
    }),
    share_prompt: () => ({
        title: "Share your win",
        body: "You hit a milestone. Want to share your progress?",
    }),
    // --- Account & billing ---
    trial_started: () => ({
        title: "Trial started",
        body: "Your free trial has started. Explore all features!",
    }),
    trial_ending_soon: (opts) => ({
        title: "Trial ending soon",
        body: opts.daysRemaining
            ? `Your trial ends in ${opts.daysRemaining} day${opts.daysRemaining === 1 ? "" : "s"}.`
            : "Your trial is ending soon.",
    }),
    subscription_renewed: () => ({
        title: "Subscription renewed",
        body: "Your subscription has been renewed.",
    }),
    billing_failure: () => ({
        title: "Action needed",
        body: "Action needed: update your payment method.",
    }),
    plan_expiration: () => ({
        title: "Plan complete",
        body: "Your plan has finished. See your maintenance options.",
    }),
    promotional_offer: () => ({
        title: "Special offer",
        body: "A special offer is available for you.",
    }),
};
/**
 * Detailed templates (shown only when user has show_habit_details_lockscreen = true)
 */
const DETAILED_OVERRIDES = {
    daily_checkin_ready: (opts) => ({
        title: "Good morning",
        body: opts.habitGoal
            ? `Your "${opts.habitGoal}" check-in is ready.`
            : "Your daily check-in is ready.",
    }),
    task_reminder: (opts) => ({
        title: "Task reminder",
        body: opts.taskTitle
            ? `Don't forget: ${opts.taskTitle}`
            : "Small step today — tap to continue.",
    }),
    streak_at_risk: (opts) => ({
        title: "Streak at risk",
        body: opts.streakLength
            ? `Only a few hours left to save your ${opts.streakLength}-day streak!`
            : "Want to protect your streak tonight?",
    }),
    streak_milestone: (opts) => ({
        title: `${opts.streakLength}-day milestone!`,
        body: opts.habitGoal
            ? `${opts.streakLength} days working on "${opts.habitGoal}" — incredible!`
            : `${opts.streakLength ?? 7} days — incredible consistency!`,
    }),
};
/**
 * Get notification copy for a scenario, respecting user's lockscreen privacy setting.
 */
export async function getNotificationCopy(userId, scenario, opts = {}) {
    const settings = await db.notification_settings.findUnique({
        where: { user_id: userId },
    });
    const showDetails = settings?.show_habit_details_lockscreen ?? false;
    if (showDetails && DETAILED_OVERRIDES[scenario]) {
        return DETAILED_OVERRIDES[scenario](opts);
    }
    const template = PRIVACY_SAFE_TEMPLATES[scenario];
    if (!template) {
        return { title: "UnHabit", body: "You have a new notification." };
    }
    return template(opts);
}
/**
 * Get privacy-safe copy directly (no DB lookup, for cron batch use).
 */
export function getPrivacySafeCopy(scenario, opts = {}) {
    const template = PRIVACY_SAFE_TEMPLATES[scenario];
    if (!template)
        return { title: "UnHabit", body: "You have a new notification." };
    return template(opts);
}
/**
 * Get detailed copy (for users who opted in to habit details on lockscreen).
 */
export function getDetailedCopy(scenario, opts = {}) {
    const override = DETAILED_OVERRIDES[scenario];
    if (override)
        return override(opts);
    return getPrivacySafeCopy(scenario, opts);
}
//# sourceMappingURL=notification-templates.service.js.map