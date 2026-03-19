type Logger = Pick<Console, "log" | "error" | "warn">;
export declare function processDueTaskReminders(now: Date, logger?: Logger): Promise<void>;
export declare function processDueScheduledNudges(now: Date, logger?: Logger): Promise<void>;
export declare function processPushReceipts(now: Date, logger?: Logger): Promise<void>;
export declare function startNotificationCron(options?: {
    intervalMs?: number;
    logger?: Logger;
}): () => void;
export {};
//# sourceMappingURL=notification-cron.service.d.ts.map