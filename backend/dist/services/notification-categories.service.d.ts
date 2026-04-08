/**
 * Notification Categories Service
 *
 * Defines the 9 notification categories from the push notification spec.
 * Each category maps to an Android notification channel and an in-app toggle.
 */
export interface NotificationCategory {
    id: string;
    name: string;
    description: string;
    androidChannelId: string;
    tier: "core" | "core_light" | "required" | "optional";
    defaultEnabled: boolean;
    requiresExplicitOptIn: boolean;
}
export declare const NOTIFICATION_CATEGORIES: NotificationCategory[];
export declare function getCategoryDefinition(categoryId: string): NotificationCategory | undefined;
export declare function getAllCategories(): NotificationCategory[];
/**
 * Returns the full Android channel configuration for the React Native client
 * to create channels on app startup.
 */
export declare function getAndroidChannelConfig(): {
    channelId: string;
    channelName: string;
    description: string;
    importance: string;
    categoryId: string;
}[];
/**
 * Get user's category preferences, creating defaults if missing.
 */
export declare function getUserCategoryPrefs(userId: string): Promise<{
    category: string;
    enabled: boolean;
    tier: string;
    name: string;
}[]>;
/**
 * Update a specific category preference for a user.
 * Account & billing (required) cannot be disabled.
 */
export declare function updateCategoryPref(userId: string, category: string, enabled: boolean): Promise<{
    user_id: string;
    id: string;
    category: string;
    enabled: boolean;
}>;
/**
 * Bulk update category preferences.
 */
export declare function bulkUpdateCategoryPrefs(userId: string, prefs: Array<{
    category: string;
    enabled: boolean;
}>): Promise<{
    user_id: string;
    id: string;
    category: string;
    enabled: boolean;
}[]>;
/**
 * Check if a category is enabled for a user.
 */
export declare function isCategoryEnabled(userId: string, category: string): Promise<boolean>;
//# sourceMappingURL=notification-categories.service.d.ts.map