/**
 * Notification Governance Service
 *
 * Enforces:
 * - Frequency caps per intensity level (Light: 0-1/day, Standard: 1-2/day, High: up to 3/day)
 * - Quiet hours (never send outside, except billing/security)
 * - Suppression rules (app opened recently, day already completed)
 * - Per-category enabled checks
 * - Promotional opt-in enforcement (iOS compliance)
 */
import { db } from "../lib/services.js";
import { isCategoryEnabled } from "./notification-categories.service.js";
const INTENSITY_CAPS = {
    light: 1,
    standard: 2,
    high_support: 3,
};
function getLocalParts(now, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(now);
    const map = new Map(parts.map((p) => [p.type, p.value]));
    const hour = Number(map.get("hour") ?? "0");
    const minute = Number(map.get("minute") ?? "0");
    return hour * 60 + minute;
}
function isInRange(minuteOfDay, start, end) {
    if (start === end)
        return false;
    if (start < end)
        return minuteOfDay >= start && minuteOfDay < end;
    return minuteOfDay >= start || minuteOfDay < end;
}
/**
 * Full delivery gate: checks all governance rules before sending a notification.
 *
 * @param category - Notification category id
 * @param kind - Specific scenario kind (e.g., "daily_checkin_ready")
 * @param isBillingOrSecurity - If true, bypasses quiet hours and frequency caps
 */
export async function checkDeliveryGate(userId, category, kind, isBillingOrSecurity = false) {
    const now = new Date();
    // 1. Check global enabled
    const prefs = await db.user_nudge_prefs.findUnique({ where: { user_id: userId } });
    const globalEnabled = prefs?.enabled ?? true;
    if (!globalEnabled && !isBillingOrSecurity) {
        return { allowed: false, reason: "disabled" };
    }
    // 2. Check category enabled
    if (!isBillingOrSecurity) {
        const catEnabled = await isCategoryEnabled(userId, category);
        if (!catEnabled)
            return { allowed: false, reason: "category_disabled" };
    }
    // 3. Promotional opt-in check (iOS compliance)
    if (category === "promotions") {
        const settings = await db.notification_settings.findUnique({ where: { user_id: userId } });
        if (!settings?.promotional_opt_in) {
            return { allowed: false, reason: "promotional_not_opted_in" };
        }
    }
    // 4. Get timezone
    const profile = await db.profiles.findUnique({ where: { user_id: userId } });
    const timeZone = profile?.timezone || "UTC";
    const minuteOfDay = getLocalParts(now, timeZone);
    // 5. Quiet hours (bypass for billing/security)
    if (!isBillingOrSecurity) {
        const quietHours = await db.quiet_hours.findFirst({ where: { user_id: userId } });
        if (quietHours && isInRange(minuteOfDay, quietHours.start_minute, quietHours.end_minute)) {
            return { allowed: false, reason: "quiet_hours" };
        }
    }
    // 6. Frequency cap (bypass for billing/security)
    if (!isBillingOrSecurity) {
        const settings = await db.notification_settings.findUnique({ where: { user_id: userId } });
        const intensity = settings?.intensity || "standard";
        const cap = INTENSITY_CAPS[intensity] ?? 2;
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const sentToday = await db.notification_daily_log.count({
            where: {
                user_id: userId,
                sent_at: { gte: todayStart },
                category: { not: "account_billing" },
            },
        });
        if (sentToday >= cap) {
            return { allowed: false, reason: "frequency_cap" };
        }
    }
    return { allowed: true, timeZone };
}
/**
 * Record that a notification was sent (for frequency cap tracking).
 */
export async function recordNotificationSent(userId, category, kind) {
    await db.notification_daily_log.create({
        data: { user_id: userId, category, kind },
    });
}
/**
 * Check if user completed today's tasks (suppression: no more daily reminders).
 */
export async function hasCompletedToday(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await db.user_task_progress.count({
        where: {
            user_id: userId,
            status: "completed",
            completed_at: { gte: today },
        },
    });
    return count > 0;
}
/**
 * Get user's notification intensity level.
 */
export async function getUserIntensity(userId) {
    const settings = await db.notification_settings.findUnique({
        where: { user_id: userId },
    });
    return settings?.intensity || "standard";
}
/**
 * Get user's notification settings or defaults.
 */
export async function getNotificationSettings(userId) {
    const settings = await db.notification_settings.findUnique({
        where: { user_id: userId },
    });
    return settings || {
        user_id: userId,
        intensity: "standard",
        show_habit_details_lockscreen: false,
        promotional_opt_in: false,
        weekend_support: false,
        high_risk_reminders: false,
        morning_checkin_minute: 480,
        evening_lastcall_minute: 1260,
        updated_at: new Date(),
    };
}
/**
 * Update notification settings.
 */
export async function updateNotificationSettings(userId, data) {
    return db.notification_settings.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            intensity: data.intensity ?? "standard",
            show_habit_details_lockscreen: data.show_habit_details_lockscreen ?? false,
            promotional_opt_in: data.promotional_opt_in ?? false,
            weekend_support: data.weekend_support ?? false,
            high_risk_reminders: data.high_risk_reminders ?? false,
            morning_checkin_minute: data.morning_checkin_minute ?? 480,
            evening_lastcall_minute: data.evening_lastcall_minute ?? 1260,
        },
        update: {
            ...(data.intensity !== undefined && { intensity: data.intensity }),
            ...(data.show_habit_details_lockscreen !== undefined && {
                show_habit_details_lockscreen: data.show_habit_details_lockscreen,
            }),
            ...(data.promotional_opt_in !== undefined && {
                promotional_opt_in: data.promotional_opt_in,
            }),
            ...(data.weekend_support !== undefined && { weekend_support: data.weekend_support }),
            ...(data.high_risk_reminders !== undefined && {
                high_risk_reminders: data.high_risk_reminders,
            }),
            ...(data.morning_checkin_minute !== undefined && {
                morning_checkin_minute: data.morning_checkin_minute,
            }),
            ...(data.evening_lastcall_minute !== undefined && {
                evening_lastcall_minute: data.evening_lastcall_minute,
            }),
            updated_at: new Date(),
        },
    });
}
/**
 * Get the count of notifications sent today for a user.
 */
export async function getSentTodayCount(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return db.notification_daily_log.count({
        where: { user_id: userId, sent_at: { gte: today } },
    });
}
//# sourceMappingURL=notification-governance.service.js.map