import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";
/**
 * Get point balance for a user
 */
export async function getPointBalance(userId) {
    const balance = await db.point_balances.findUnique({
        where: { user_id: userId },
    });
    return (balance || {
        user_id: userId,
        total_points: 0,
        weekly_points: 0,
        monthly_points: 0,
    });
}
/**
 * Get points history (ledger)
 */
export async function getPointsHistory(userId, limit, offset) {
    return db.points_ledger.findMany({
        where: { user_id: userId },
        include: {
            point_rules: {
                select: {
                    code: true,
                    event_type: true,
                },
            },
        },
        orderBy: { awarded_at: "desc" },
        take: limit,
        skip: offset,
    });
}
/**
 * Get earned badges
 */
export async function getEarnedBadges(userId) {
    return db.user_badges.findMany({
        where: { user_id: userId },
        include: {
            badge_definitions: true,
        },
        orderBy: { earned_at: "desc" },
    });
}
/**
 * Get all badges (earned and unearned)
 */
export async function getAllBadges(userId) {
    const [allBadges, earnedBadges] = await Promise.all([
        db.badge_definitions.findMany({
            orderBy: [{ category: "asc" }, { tier: "asc" }, { name: "asc" }],
        }),
        db.user_badges.findMany({
            where: { user_id: userId },
            select: { badge_id: true, earned_at: true },
        }),
    ]);
    const earnedMap = new Map(earnedBadges.map((b) => [b.badge_id, b.earned_at]));
    return allBadges.map((badge) => ({
        ...badge,
        earned: earnedMap.has(badge.id),
        earned_at: earnedMap.get(badge.id) || null,
    }));
}
/**
 * Get available rewards
 */
export async function getAvailableRewards(userId) {
    // Get all rewards and user's earned rewards
    const [allRewards, earnedRewards] = await Promise.all([
        db.rewards.findMany({
            orderBy: { name: "asc" },
        }),
        db.user_rewards.findMany({
            where: { user_id: userId },
            select: { reward_id: true },
        }),
    ]);
    const earnedIds = new Set(earnedRewards.map((r) => r.reward_id));
    return allRewards.map((reward) => ({
        ...reward,
        earned: earnedIds.has(reward.id),
    }));
}
/**
 * Get earned rewards
 */
export async function getEarnedRewards(userId) {
    return db.user_rewards.findMany({
        where: { user_id: userId },
        include: {
            rewards: true,
        },
        orderBy: { earned_at: "desc" },
    });
}
/**
 * Award points to user
 */
export async function awardPoints(userId, amount, ruleId, sourceEventId) {
    // Create ledger entry
    await db.points_ledger.create({
        data: {
            user_id: userId,
            amount,
            rule_id: ruleId ?? null,
            source_event_id: sourceEventId ?? null,
        },
    });
    // Update balance
    return db.point_balances.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            total_points: amount,
            weekly_points: amount,
            monthly_points: amount,
        },
        update: {
            total_points: { increment: amount },
            weekly_points: { increment: amount },
            monthly_points: { increment: amount },
            updated_at: new Date(),
        },
    });
}
/**
 * Award badge to user
 */
export async function awardBadge(userId, badgeId, evidence) {
    return db.user_badges.upsert({
        where: {
            user_id_badge_id: {
                user_id: userId,
                badge_id: badgeId,
            },
        },
        create: {
            user_id: userId,
            badge_id: badgeId,
            evidence: evidence ? evidence : Prisma.JsonNull,
        },
        update: {},
        include: {
            badge_definitions: true,
        },
    });
}
//# sourceMappingURL=rewards.service.js.map