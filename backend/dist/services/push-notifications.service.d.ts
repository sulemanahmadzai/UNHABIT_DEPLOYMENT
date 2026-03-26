import type { ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
/**
 * Send push notifications to a list of tokens.
 * @param tokens Array of Expo Push Tokens
 * @param title Notification title
 * @param body Notification body
 * @param data Optional data payload
 */
export declare function sendPushNotifications(tokens: string[], title: string, body: string, data?: Record<string, any>, categoryId?: string): Promise<{
    tickets: ExpoPushTicket[];
    receiptIds: string[];
    tokenTicketPairs: {
        token: string | undefined;
        ticket: ExpoPushTicket;
        receiptId: string | undefined;
    }[];
}>;
/**
 * Send push notification to a specific user by userId (looks up their devices).
 */
export declare function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, any>): Promise<{
    tickets: ExpoPushTicket[];
    receiptIds: string[];
    tokenTicketPairs: {
        token: string | undefined;
        ticket: ExpoPushTicket;
        receiptId: string | undefined;
    }[];
} | null>;
/**
 * Process receipts (optional, for checking delivery errors like invalid tokens)
 */
export declare function checkPushReceipts(receiptIds: string[]): Promise<Record<string, ExpoPushReceipt>>;
//# sourceMappingURL=push-notifications.service.d.ts.map