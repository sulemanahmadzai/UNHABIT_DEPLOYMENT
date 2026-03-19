/**
 * Push notify when a user completes a day (all today's tasks).
 * This is intentionally conservative (one push) and is best-effort.
 */
export declare function notifyDailyCompletion(userId: string): Promise<void>;
/**
 * Push notify when user's streak is at risk.
 * This should be called by a scheduler near end-of-day in user's timezone.
 * For now, we expose helper used by cron to create scheduled nudges instead.
 */
export declare function notifyStreakAtRisk(userId: string): Promise<void>;
//# sourceMappingURL=notification-events.service.d.ts.map