import { db } from "../lib/services.js";
import { sendPushNotifications } from "./push-notifications.service.js";
async function getUserTokens(userId) {
    const devices = await db.devices.findMany({
        where: { user_id: userId, push_token: { not: null } },
        orderBy: { created_at: "desc" },
    });
    return Array.from(new Set(devices.map((d) => d.push_token).filter((t) => !!t)));
}
/**
 * Push notify when a user completes a day (all today's tasks).
 * This is intentionally conservative (one push) and is best-effort.
 */
export async function notifyDailyCompletion(userId) {
    const tokens = await getUserTokens(userId);
    if (!tokens.length)
        return;
    await sendPushNotifications(tokens, "Nice work!", "You completed today's tasks. Keep it going!", {
        screen: "Notifications",
        params: JSON.stringify({}),
        kind: "daily_completion",
    });
}
/**
 * Push notify when user's streak is at risk.
 * This should be called by a scheduler near end-of-day in user's timezone.
 * For now, we expose helper used by cron to create scheduled nudges instead.
 */
export async function notifyStreakAtRisk(userId) {
    const tokens = await getUserTokens(userId);
    if (!tokens.length)
        return;
    await sendPushNotifications(tokens, "Streak at risk", "Only a few hours left to save your streak!", {
        screen: "Notifications",
        params: JSON.stringify({}),
        kind: "streak_at_risk",
    });
}
//# sourceMappingURL=notification-events.service.js.map