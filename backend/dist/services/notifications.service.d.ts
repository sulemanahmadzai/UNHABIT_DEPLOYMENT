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
    start_minute: number;
    end_minute: number;
    dow: number;
}[]>;
/**
 * Get prime time windows
 */
export declare function getPrimeTimeWindows(userId: string): Promise<{
    user_id: string;
    id: string;
    start_minute: number;
    end_minute: number;
    dow: number;
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
/**
 * Add a task reminder
 */
export declare function addTaskReminder(userId: string, data: {
    journey_task_id: string;
    remind_at: Date;
}): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    journey_task_id: string;
    remind_at: Date;
    sent: boolean;
} | null>;
/**
 * Get task reminders
 */
export declare function getTaskReminders(userId: string): Promise<({
    journey_tasks: {
        id: string;
        title: string;
        kind: string | null;
    };
} & {
    user_id: string;
    created_at: Date;
    id: string;
    journey_task_id: string;
    remind_at: Date;
    sent: boolean;
})[]>;
/**
 * Delete a task reminder
 */
export declare function deleteTaskReminder(userId: string, reminderId: string): Promise<boolean>;
export {};
//# sourceMappingURL=notifications.service.d.ts.map