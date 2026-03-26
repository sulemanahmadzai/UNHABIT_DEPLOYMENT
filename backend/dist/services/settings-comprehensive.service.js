/**
 * Comprehensive Settings Service
 * Aggregates all user settings
 */
import { db } from "../lib/services.js";
import * as SettingsService from "./settings.service.js";
import * as NotificationsService from "./notifications.service.js";
/**
 * Get all user settings
 */
export async function getAllSettings(userId) {
    const [privacy, share, notifications, devices] = await Promise.all([
        SettingsService.getPrivacySettings(userId),
        SettingsService.getSharePreferences(userId),
        NotificationsService.getPreferences(userId),
        SettingsService.getDevices(userId),
    ]);
    return {
        privacy,
        share,
        notifications,
        devices,
    };
}
/**
 * Get AI Coach preferences
 */
export async function getAICoachPreferences(userId) {
    // For now, return default preferences
    // This could be stored in a user_preferences table or profiles table
    const profile = await db.profiles.findUnique({
        where: { user_id: userId },
        select: {
            user_id: true,
            // Add AI coach preferences to profiles table if needed
        },
    });
    return {
        enabled: true,
        tone: "supportive", // supportive, motivational, direct
        frequency: "daily", // daily, weekly, on_demand
        topics: ["motivation", "tips", "challenges"],
    };
}
/**
 * Update AI Coach preferences
 */
export async function updateAICoachPreferences(userId, data) {
    // For now, just return the updated preferences
    // In the future, store in profiles table or separate preferences table
    const current = await getAICoachPreferences(userId);
    return {
        ...current,
        ...data,
    };
}
//# sourceMappingURL=settings-comprehensive.service.js.map