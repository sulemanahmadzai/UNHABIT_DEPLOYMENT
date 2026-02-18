import { Prisma } from "@prisma/client";
/**
 * Get point balance for a user
 */
export declare function getPointBalance(userId: string): Promise<{
    user_id: string;
    updated_at: Date;
    total_points: bigint;
    weekly_points: bigint;
    monthly_points: bigint;
} | {
    user_id: string;
    total_points: number;
    weekly_points: number;
    monthly_points: number;
}>;
/**
 * Get points history (ledger)
 */
export declare function getPointsHistory(userId: string, limit: number, offset: number): Promise<({
    point_rules: {
        code: string;
        event_type: string;
    } | null;
} & {
    user_id: string;
    id: string;
    amount: number;
    rule_id: string | null;
    source_event_id: string | null;
    awarded_at: Date;
})[]>;
/**
 * Get earned badges
 */
export declare function getEarnedBadges(userId: string): Promise<({
    badge_definitions: {
        name: string;
        id: string;
        slug: string;
        description: string | null;
        icon_url: string | null;
        category: string | null;
        tier: string | null;
    };
} & {
    user_id: string;
    id: string;
    badge_id: string;
    earned_at: Date;
    evidence: Prisma.JsonValue | null;
})[]>;
/**
 * Get all badges (earned and unearned)
 */
export declare function getAllBadges(userId: string): Promise<{
    earned: boolean;
    earned_at: Date | null;
    name: string;
    id: string;
    slug: string;
    description: string | null;
    icon_url: string | null;
    category: string | null;
    tier: string | null;
}[]>;
/**
 * Get available rewards
 */
export declare function getAvailableRewards(userId: string): Promise<{
    earned: boolean;
    name: string;
    id: string;
    slug: string;
    description: string | null;
    icon_url: string | null;
}[]>;
/**
 * Get earned rewards
 */
export declare function getEarnedRewards(userId: string): Promise<({
    rewards: {
        name: string;
        id: string;
        slug: string;
        description: string | null;
        icon_url: string | null;
    };
} & {
    user_id: string;
    id: string;
    earned_at: Date;
    reward_id: string;
})[]>;
/**
 * Award points to user
 */
export declare function awardPoints(userId: string, amount: number, ruleId?: string | null, sourceEventId?: string | null): Promise<{
    user_id: string;
    updated_at: Date;
    total_points: bigint;
    weekly_points: bigint;
    monthly_points: bigint;
}>;
/**
 * Award badge to user
 */
export declare function awardBadge(userId: string, badgeId: string, evidence?: Record<string, unknown> | null): Promise<{
    badge_definitions: {
        name: string;
        id: string;
        slug: string;
        description: string | null;
        icon_url: string | null;
        category: string | null;
        tier: string | null;
    };
} & {
    user_id: string;
    id: string;
    badge_id: string;
    earned_at: Date;
    evidence: Prisma.JsonValue | null;
}>;
/**
 * Get today's XP
 */
export declare function getTodayXP(userId: string): Promise<{
    total: number;
    breakdown: Record<string, number>;
    transactions: number;
}>;
/**
 * Get user level and progress
 */
export declare function getLevelInfo(userId: string): Promise<{
    level: number;
    total_xp: number;
    current_level_xp: number;
    xp_for_next_level: number;
    xp_remaining: number;
    progress_percent: number;
    next_milestone: {
        level: number;
        reward: string;
    } | undefined;
}>;
/**
 * Get badge gallery with progress
 */
export declare function getBadgeGallery(userId: string): Promise<{
    earned: {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        icon_url: string | null;
        category: string | null;
        tier: string | null;
        earned: boolean;
        earned_at: Date | undefined;
        progress: number;
        current: number;
        required: number;
        days_left: number | null;
    }[];
    locked: {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        icon_url: string | null;
        category: string | null;
        tier: string | null;
        earned: boolean;
        earned_at: Date | undefined;
        progress: number;
        current: number;
        required: number;
        days_left: number | null;
    }[];
    total_earned: number;
    total_available: number;
}>;
/**
 * Get next badge to earn
 */
export declare function getNextBadge(userId: string): Promise<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    category: string | null;
    tier: string | null;
    progress: number;
    current: number;
    required: number;
    days_left: number;
} | null>;
//# sourceMappingURL=rewards.service.d.ts.map