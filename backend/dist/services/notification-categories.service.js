/**
 * Notification Categories Service
 *
 * Defines the 9 notification categories from the push notification spec.
 * Each category maps to an Android notification channel and an in-app toggle.
 */
import { db } from "../lib/services.js";
export const NOTIFICATION_CATEGORIES = [
    {
        id: "daily_reminders",
        name: "Daily Reminders & Check-ins",
        description: "Morning check-in, task reminders, midday rescue, evening last call",
        androidChannelId: "unhabit_daily_reminders",
        tier: "core",
        defaultEnabled: true,
        requiresExplicitOptIn: false,
    },
    {
        id: "streak_protection",
        name: "Streak & Relapse Protection",
        description: "Streak at risk, missed-day recovery, relapse support, freeze alerts",
        androidChannelId: "unhabit_streak_protection",
        tier: "core",
        defaultEnabled: true,
        requiresExplicitOptIn: false,
    },
    {
        id: "coach_nudge",
        name: "Coach Nudge Messages",
        description: "Coach replies, proactive check-ins, skill suggestions, reflections",
        androidChannelId: "unhabit_coach_nudge",
        tier: "core",
        defaultEnabled: true,
        requiresExplicitOptIn: false,
    },
    {
        id: "buddy_social",
        name: "Buddy & Social Accountability",
        description: "Buddy invites, completions, streak milestones, nudges",
        androidChannelId: "unhabit_buddy_social",
        tier: "core",
        defaultEnabled: true,
        requiresExplicitOptIn: false,
    },
    {
        id: "rewards_xp",
        name: "Rewards, XP & Milestones",
        description: "Level ups, badges, XP earned, weekly reward summaries",
        androidChannelId: "unhabit_rewards_xp",
        tier: "core_light",
        defaultEnabled: true,
        requiresExplicitOptIn: false,
    },
    {
        id: "weekly_review",
        name: "Weekly Review & Planning",
        description: "Weekly progress summaries, leaderboard updates, planning prompts",
        androidChannelId: "unhabit_weekly_review",
        tier: "core_light",
        defaultEnabled: true,
        requiresExplicitOptIn: false,
    },
    {
        id: "account_billing",
        name: "Account & Billing",
        description: "Trial alerts, subscription renewals, billing failures, security",
        androidChannelId: "unhabit_account_billing",
        tier: "required",
        defaultEnabled: true,
        requiresExplicitOptIn: false,
    },
    {
        id: "product_updates",
        name: "Product Updates",
        description: "New features, app updates, improvements",
        androidChannelId: "unhabit_product_updates",
        tier: "optional",
        defaultEnabled: false,
        requiresExplicitOptIn: false,
    },
    {
        id: "promotions",
        name: "Promotions & Upsells",
        description: "Discounts, special offers, subscription upsells",
        androidChannelId: "unhabit_promotions",
        tier: "optional",
        defaultEnabled: false,
        requiresExplicitOptIn: true, // iOS requires explicit opt-in + in-app opt-out
    },
];
const CATEGORY_MAP = new Map(NOTIFICATION_CATEGORIES.map((c) => [c.id, c]));
export function getCategoryDefinition(categoryId) {
    return CATEGORY_MAP.get(categoryId);
}
export function getAllCategories() {
    return NOTIFICATION_CATEGORIES;
}
/**
 * Returns the full Android channel configuration for the React Native client
 * to create channels on app startup.
 */
export function getAndroidChannelConfig() {
    return NOTIFICATION_CATEGORIES.map((c) => ({
        channelId: c.androidChannelId,
        channelName: c.name,
        description: c.description,
        importance: c.tier === "required" ? "high" : c.tier === "core" ? "default" : "low",
        categoryId: c.id,
    }));
}
/**
 * Get user's category preferences, creating defaults if missing.
 */
export async function getUserCategoryPrefs(userId) {
    const existing = await db.notification_category_prefs.findMany({
        where: { user_id: userId },
    });
    const existingMap = new Map(existing.map((p) => [p.category, p]));
    const result = [];
    for (const cat of NOTIFICATION_CATEGORIES) {
        const pref = existingMap.get(cat.id);
        result.push({
            category: cat.id,
            enabled: pref ? pref.enabled : cat.defaultEnabled,
            tier: cat.tier,
            name: cat.name,
        });
    }
    return result;
}
/**
 * Update a specific category preference for a user.
 * Account & billing (required) cannot be disabled.
 */
export async function updateCategoryPref(userId, category, enabled) {
    const def = CATEGORY_MAP.get(category);
    if (!def)
        throw new Error(`Unknown notification category: ${category}`);
    if (def.tier === "required" && !enabled) {
        throw new Error("Account & billing notifications cannot be disabled");
    }
    return db.notification_category_prefs.upsert({
        where: { user_id_category: { user_id: userId, category } },
        create: { user_id: userId, category, enabled },
        update: { enabled },
    });
}
/**
 * Bulk update category preferences.
 */
export async function bulkUpdateCategoryPrefs(userId, prefs) {
    const results = [];
    for (const p of prefs) {
        results.push(await updateCategoryPref(userId, p.category, p.enabled));
    }
    return results;
}
/**
 * Check if a category is enabled for a user.
 */
export async function isCategoryEnabled(userId, category) {
    const def = CATEGORY_MAP.get(category);
    if (!def)
        return false;
    if (def.tier === "required")
        return true;
    const pref = await db.notification_category_prefs.findUnique({
        where: { user_id_category: { user_id: userId, category } },
    });
    return pref ? pref.enabled : def.defaultEnabled;
}
//# sourceMappingURL=notification-categories.service.js.map