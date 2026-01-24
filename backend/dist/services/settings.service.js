import { db } from "../lib/services.js";
/**
 * Get privacy settings
 */
export async function getPrivacySettings(userId) {
    const settings = await db.privacy_settings.findUnique({
        where: { user_id: userId },
    });
    return (settings || {
        user_id: userId,
        share_with_buddy: false,
        allow_research: false,
        data_export_requested_at: null,
        data_delete_requested_at: null,
    });
}
/**
 * Update privacy settings
 */
export async function updatePrivacySettings(userId, data) {
    return db.privacy_settings.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            share_with_buddy: data.share_with_buddy ?? false,
            allow_research: data.allow_research ?? false,
        },
        update: {
            ...(data.share_with_buddy !== undefined && {
                share_with_buddy: data.share_with_buddy,
            }),
            ...(data.allow_research !== undefined && {
                allow_research: data.allow_research,
            }),
            updated_at: new Date(),
        },
    });
}
/**
 * Get share preferences
 */
export async function getSharePreferences(userId) {
    const prefs = await db.share_preferences.findUnique({
        where: { user_id: userId },
    });
    return (prefs || {
        user_id: userId,
        share_metrics: true,
        share_streaks: true,
    });
}
/**
 * Update share preferences
 */
export async function updateSharePreferences(userId, data) {
    return db.share_preferences.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            share_metrics: data.share_metrics ?? true,
            share_streaks: data.share_streaks ?? true,
        },
        update: {
            ...(data.share_metrics !== undefined && { share_metrics: data.share_metrics }),
            ...(data.share_streaks !== undefined && { share_streaks: data.share_streaks }),
        },
    });
}
/**
 * Get registered devices
 */
export async function getDevices(userId) {
    return db.devices.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
    });
}
/**
 * Register a device
 */
export async function registerDevice(userId, data) {
    return db.devices.create({
        data: {
            user_id: userId,
            platform: data.platform,
            push_token: data.push_token ?? null,
            app_version: data.app_version ?? null,
        },
    });
}
/**
 * Unregister a device
 */
export async function unregisterDevice(userId, deviceId) {
    const device = await db.devices.findFirst({
        where: {
            id: deviceId,
            user_id: userId,
        },
    });
    if (!device) {
        return false;
    }
    await db.devices.delete({
        where: { id: deviceId },
    });
    return true;
}
/**
 * Request data export
 */
export async function requestDataExport(userId) {
    return db.privacy_settings.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            data_export_requested_at: new Date(),
        },
        update: {
            data_export_requested_at: new Date(),
            updated_at: new Date(),
        },
    });
}
/**
 * Request account deletion
 */
export async function requestAccountDeletion(userId) {
    return db.privacy_settings.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            data_delete_requested_at: new Date(),
        },
        update: {
            data_delete_requested_at: new Date(),
            updated_at: new Date(),
        },
    });
}
//# sourceMappingURL=settings.service.js.map