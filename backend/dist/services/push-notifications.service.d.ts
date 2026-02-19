/**
 * Push Notifications Service
 * Sends push notifications via Expo Push Notification Service.
 *
 * NOTE: Install the SDK before using in production:
 *   npm install expo-server-sdk
 */
export interface PushPayload {
    type: string;
    [key: string]: unknown;
}
/**
 * Send push notifications to a list of Expo push tokens.
 * Silently skips invalid tokens; logs errors but never throws.
 */
export declare function sendPushNotifications(tokens: (string | null | undefined)[], title: string, body: string, data?: PushPayload): Promise<{
    sent: number;
    failed: number;
}>;
/**
 * Retrieve all valid push tokens for a user from the devices table.
 */
export declare function getUserPushTokens(userId: string): Promise<string[]>;
/**
 * Convenience: send push to a user by user ID (fetches tokens internally)
 */
export declare function sendPushToUser(userId: string, title: string, body: string, data?: PushPayload): Promise<{
    sent: number;
    failed: number;
}>;
//# sourceMappingURL=push-notifications.service.d.ts.map