import { Expo } from 'expo-server-sdk';
const expo = new Expo();
/**
 * Send push notifications to a list of tokens.
 * @param tokens Array of Expo Push Tokens
 * @param title Notification title
 * @param body Notification body
 * @param data Optional data payload
 */
export async function sendPushNotifications(tokens, title, body, data = {}, categoryId) {
    const messages = [];
    const messageTokens = [];
    for (const token of tokens) {
        if (!Expo.isExpoPushToken(token)) {
            console.error(`Push token ${token} is not a valid Expo push token`);
            continue;
        }
        messageTokens.push(token);
        messages.push({
            to: token,
            sound: 'default',
            title,
            body,
            data,
            ...(categoryId !== undefined && { categoryId }),
        });
    }
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
        try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log('Push tickets:', ticketChunk);
            tickets.push(...ticketChunk);
        }
        catch (error) {
            console.error('Error sending push notification chunk:', error);
        }
    }
    // Expo returns tickets in the same order as the messages sent.
    const tokenTicketPairs = tickets.map((ticket, i) => ({
        token: messageTokens[i],
        ticket,
        receiptId: (ticket.status === 'ok' ? ticket.id : undefined),
    }));
    return {
        tickets,
        receiptIds: tokenTicketPairs.map(p => p.receiptId).filter((id) => !!id),
        tokenTicketPairs,
    };
}
/**
 * Send push notification to a specific user by userId (looks up their devices).
 */
export async function sendPushToUser(userId, title, body, data = {}) {
    const { db } = await import("../lib/services.js");
    const devices = await db.devices.findMany({
        where: { user_id: userId, push_token: { not: null } },
        orderBy: { created_at: "desc" },
    });
    const tokens = Array.from(new Set(devices.map((d) => d.push_token).filter((t) => !!t)));
    if (tokens.length === 0)
        return null;
    return sendPushNotifications(tokens, title, body, data);
}
/**
 * Process receipts (optional, for checking delivery errors like invalid tokens)
 */
export async function checkPushReceipts(receiptIds) {
    const validIds = receiptIds.filter((id) => Expo.isExpoPushToken(id));
    if (validIds.length === 0)
        return {};
    const chunks = expo.chunkPushNotificationReceiptIds(validIds);
    const receipts = {};
    for (const chunk of chunks) {
        try {
            const chunkReceipts = await expo.getPushNotificationReceiptsAsync(chunk);
            Object.assign(receipts, chunkReceipts);
        }
        catch (error) {
            console.error('Error checking push receipts:', error);
        }
    }
    return receipts;
}
//# sourceMappingURL=push-notifications.service.js.map