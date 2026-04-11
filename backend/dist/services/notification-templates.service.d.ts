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
export interface NotificationCopy {
    title: string;
    body: string;
}
interface TemplateOptions {
    streakLength?: number | undefined;
    buddyName?: string | undefined;
    dayNumber?: number | undefined;
    xpAmount?: number | undefined;
    level?: number | undefined;
    badgeName?: string | undefined;
    taskTitle?: string | undefined;
    habitGoal?: string | undefined;
    daysRemaining?: number | undefined;
    rankChange?: string | undefined;
}
type ScenarioKey = "daily_checkin_ready" | "task_reminder" | "midday_rescue" | "evening_last_call" | "completion_reinforcement" | "micro_streak" | "day_reset_clean_slate" | "open_app_nudge" | "habit_health_change" | "calendar_plan_prompt" | "streak_at_risk" | "missed_day_recovery" | "two_miss_risk" | "relapse_logged" | "high_risk_window" | "weekend_support" | "streak_freeze_offered" | "streak_freeze_used" | "streak_milestone" | "post_21_maintenance" | "coach_reply" | "coach_daily_checkin" | "coach_stuck_detection" | "coach_phase_transition" | "coach_skill_suggestion" | "coach_reflection_prompt" | "buddy_invite_received" | "buddy_invite_accepted" | "buddy_completed_today" | "buddy_streak_milestone" | "nudge_your_buddy" | "leaderboard_weekly_start" | "leaderboard_rank_change" | "buddy_inactivity" | "xp_earned" | "level_up" | "badge_unlocked" | "next_badge_progress" | "weekly_reward_summary" | "share_prompt" | "trial_started" | "trial_ending_soon" | "subscription_renewed" | "billing_failure" | "plan_expiration" | "promotional_offer";
/**
 * Get notification copy for a scenario, respecting user's lockscreen privacy setting.
 */
export declare function getNotificationCopy(userId: string, scenario: ScenarioKey, opts?: TemplateOptions): Promise<NotificationCopy>;
/**
 * Get privacy-safe copy directly (no DB lookup, for cron batch use).
 */
export declare function getPrivacySafeCopy(scenario: ScenarioKey, opts?: TemplateOptions): NotificationCopy;
/**
 * Get detailed copy (for users who opted in to habit details on lockscreen).
 */
export declare function getDetailedCopy(scenario: ScenarioKey, opts?: TemplateOptions): NotificationCopy;
export type { ScenarioKey, TemplateOptions };
//# sourceMappingURL=notification-templates.service.d.ts.map