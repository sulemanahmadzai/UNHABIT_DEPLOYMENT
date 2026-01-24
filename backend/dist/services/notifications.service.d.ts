interface PrimeTimeWindow {
    dow: number;
    start_minute: number;
    end_minute: number;
}
interface QuietHoursData {
    start_minute: number;
    end_minute: number;
}
/**
 * Get notification preferences
 */
export declare function getPreferences(userId: string): Promise<{
    user_id: string;
    enabled: boolean;
    max_per_day: number;
    escalate_to_buddy: boolean;
}>;
/**
 * Update notification preferences
 */
export declare function updatePreferences(userId: string, data: {
    enabled?: boolean | undefined;
    max_per_day?: number | undefined;
    escalate_to_buddy?: boolean | undefined;
}): Promise<{
    user_id: string;
    enabled: boolean;
    max_per_day: number;
    escalate_to_buddy: boolean;
}>;
/**
 * Get scheduled nudges
 */
export declare function getScheduledNudges(userId: string, limit: number): Promise<({
    journey_tasks: {
        id: string;
        title: string;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    channel: import("@prisma/client").$Enums.nudge_channel;
    scheduled_for: Date;
    reason: string | null;
    place_id: string | null;
    journey_task_id: string | null;
})[]>;
/**
 * Set prime time windows
 */
export declare function setPrimeTimeWindows(userId: string, windows: PrimeTimeWindow[]): Promise<{
    user_id: string;
    id: string;
    dow: number;
    start_minute: number;
    end_minute: number;
}[]>;
/**
 * Get prime time windows
 */
export declare function getPrimeTimeWindows(userId: string): Promise<{
    user_id: string;
    id: string;
    dow: number;
    start_minute: number;
    end_minute: number;
}[]>;
/**
 * Set quiet hours
 */
export declare function setQuietHours(userId: string, data: QuietHoursData): Promise<{
    user_id: string;
    id: string;
    start_minute: number;
    end_minute: number;
}>;
/**
 * Get quiet hours
 */
export declare function getQuietHours(userId: string): Promise<{
    user_id: string;
    id: string;
    start_minute: number;
    end_minute: number;
}[]>;
/**
 * Get notification delivery history
 */
export declare function getDeliveryHistory(userId: string, limit: number, offset: number): Promise<{
    id: string;
    scheduled_nudge_id: string;
    scheduled_for: Date;
    channel: import("@prisma/client").$Enums.nudge_channel;
    reason: string | null;
    task: {
        id: string;
        title: string;
    } | null;
    sent_at: Date | null;
    status: string;
    opened_at: Date | null;
    engaged: boolean | null;
}[]>;
export {};
//# sourceMappingURL=notifications.service.d.ts.map