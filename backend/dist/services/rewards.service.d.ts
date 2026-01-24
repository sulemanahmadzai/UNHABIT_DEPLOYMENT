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
    rule_id: string | null;
    source_event_id: string | null;
    amount: number;
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
//# sourceMappingURL=rewards.service.d.ts.map