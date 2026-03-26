/**
 * Notifications Feed Service
 * Handles user notification feed (using nudge_deliveries as notification source)
 */
export interface NotificationItem {
    id: string;
    type: string;
    title: string;
    message: string;
    created_at: Date;
    is_read: boolean;
    icon_name?: string | undefined;
    action_data?: Record<string, unknown> | undefined;
    related_entity_id?: string | undefined;
}
/**
 * Get all notifications for a user
 */
export declare function getNotifications(userId: string, options?: {
    status?: "read" | "unread" | undefined;
    type?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}): Promise<NotificationItem[]>;
/**
 * Mark notification as read
 */
export declare function markNotificationAsRead(userId: string, notificationId: string): Promise<{
    id: string;
    status: string;
    meta: import("@prisma/client/runtime/library").JsonValue | null;
    sent_at: Date | null;
    scheduled_nudge_id: string;
    opened_at: Date | null;
    engaged: boolean | null;
} | {
    id: string;
    read: boolean;
} | null>;
/**
 * Mark all notifications as read
 */
export declare function markAllNotificationsAsRead(userId: string): Promise<{
    marked: number;
}>;
/**
 * Delete a notification
 */
export declare function deleteNotification(userId: string, notificationId: string): Promise<boolean>;
//# sourceMappingURL=notifications-feed.service.d.ts.map