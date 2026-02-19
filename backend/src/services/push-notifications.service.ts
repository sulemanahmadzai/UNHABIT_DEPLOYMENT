/**
 * Push Notifications Service
 * Sends push notifications via Expo Push Notification Service.
 *
 * NOTE: Install the SDK before using in production:
 *   npm install expo-server-sdk
 */

import { db } from "../lib/services.js";

// Lazy-load Expo SDK so the server doesn't crash if it isn't installed yet
let Expo: any = null;
let expoClient: any = null;

async function getExpoClient() {
    if (expoClient) return expoClient;
    try {
        const { Expo: ExpoClass } = await import("expo-server-sdk");
        Expo = ExpoClass;
        expoClient = new ExpoClass();
        return expoClient;
    } catch {
        console.warn(
            "⚠️  expo-server-sdk is not installed. Push notifications are disabled.\n" +
            "   Run: npm install expo-server-sdk"
        );
        return null;
    }
}

export interface PushPayload {
    type: string;
    [key: string]: unknown;
}

/**
 * Send push notifications to a list of Expo push tokens.
 * Silently skips invalid tokens; logs errors but never throws.
 */
export async function sendPushNotifications(
    tokens: (string | null | undefined)[],
    title: string,
    body: string,
    data: PushPayload = { type: "general" }
): Promise<{ sent: number; failed: number }> {
    const expo = await getExpoClient();
    if (!expo) {
        console.warn("Push notification skipped (expo-server-sdk not available)");
        return { sent: 0, failed: 0 };
    }

    // Filter only valid Expo push tokens
    const validTokens = tokens.filter(
        (token): token is string => typeof token === "string" && expo.isExpoPushToken(token)
    );

    if (validTokens.length === 0) {
        return { sent: 0, failed: 0 };
    }

    const messages = validTokens.map((pushToken) => ({
        to: pushToken,
        sound: "default" as const,
        title,
        body,
        data,
    }));

    let sent = 0;
    let failed = 0;

    try {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            const receipts = await expo.sendPushNotificationsAsync(chunk);
            for (const receipt of receipts) {
                if (receipt.status === "ok") {
                    sent++;
                } else {
                    failed++;
                    console.error("Push notification failed:", receipt.message, receipt.details);
                }
            }
        }
    } catch (err) {
        console.error("Error sending push notifications:", err);
        failed += messages.length;
    }

    return { sent, failed };
}

/**
 * Retrieve all valid push tokens for a user from the devices table.
 */
export async function getUserPushTokens(userId: string): Promise<string[]> {
    const devices = await db.devices.findMany({
        where: {
            user_id: userId,
            push_token: { not: null },
        },
        select: { push_token: true },
    });

    return devices
        .map((d) => d.push_token)
        .filter((t): t is string => typeof t === "string" && t.length > 0);
}

/**
 * Convenience: send push to a user by user ID (fetches tokens internally)
 */
export async function sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data: PushPayload = { type: "general" }
): Promise<{ sent: number; failed: number }> {
    const tokens = await getUserPushTokens(userId);
    return sendPushNotifications(tokens, title, body, data);
}
