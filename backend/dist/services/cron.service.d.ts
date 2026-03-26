/**
 * Push Notification Cron Jobs
 *
 * Schedules:
 *  - 09:00 UTC daily  → Daily Challenge Reminder
 *  - 20:00 UTC daily  → Streak Saver Warning
 *
 * To enable: import and call `startCronJobs()` from server.ts
 *
 * NOTE: Requires node-cron:
 *   npm install node-cron
 *   npm install --save-dev @types/node-cron
 */
/**
 * Start all cron jobs.
 * Call this once from server.ts after the server starts.
 */
export declare function startCronJobs(): Promise<void>;
//# sourceMappingURL=cron.service.d.ts.map