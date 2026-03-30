interface BadgeAwardResult {
    awarded: boolean;
    badge_id?: string;
    badge_name?: string;
    badge_slug?: string;
}
/**
 * Check and award badges for a user based on their current stats
 * This should be called after completing tasks, streaks, etc.
 */
export declare function checkAndAwardBadges(userId: string): Promise<BadgeAwardResult[]>;
/**
 * Check specific badge type and award if satisfied
 */
export declare function checkAndAwardBadgeType(userId: string, ruleType: string): Promise<BadgeAwardResult | null>;
/**
 * Invalidate user stats cache (call after completing tasks, earning badges, etc.)
 */
export declare function invalidateUserStatsCache(userId: string): Promise<void>;
/**
 * Called after task completion to check badges and update streak
 */
export declare function onTaskCompleted(userId: string, taskId: string): Promise<{
    streak_updated: boolean;
    new_badges: BadgeAwardResult[];
}>;
export {};
//# sourceMappingURL=badge-awarding.service.d.ts.map