/**
 * Notification Events Service
 *
 * Backward-compatible wrappers that delegate to the comprehensive
 * notification-scenarios.service. Existing callers don't need to change.
 */
/**
 * Push notify when a user completes a day (all today's tasks).
 * Called from progress route (complete-day).
 */
export declare function notifyDailyCompletion(userId: string): Promise<boolean>;
/**
 * Push notify when user's streak is at risk.
 * Called by cron near end-of-day in user's timezone.
 */
export declare function notifyStreakAtRisk(userId: string): Promise<boolean>;
//# sourceMappingURL=notification-events.service.d.ts.map