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
type Logger = Pick<Console, "log" | "error" | "warn">;
export declare function startCronJobs(logger?: Logger): Promise<void>;
export {};
//# sourceMappingURL=cron.service.d.ts.map