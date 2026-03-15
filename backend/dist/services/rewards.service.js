import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";
import * as BadgeAwardingService from "./badge-awarding.service.js";
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
    const balance = await db.point_balances.upsert({
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
    // Check for XP badges (don't await to avoid slowing down the response)
    BadgeAwardingService.checkAndAwardBadgeType(userId, 'xp_earned').catch(err => {
        console.error('Error checking XP badges:', err);
    });
    return balance;
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
/**
 * Get today's XP
 */
export async function getTodayXP(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db.points_ledger.aggregate({
        where: {
            user_id: userId,
            awarded_at: { gte: today },
        },
        _sum: { amount: true },
    });
    // Get breakdown by event type
    const breakdown = await db.points_ledger.findMany({
        where: {
            user_id: userId,
            awarded_at: { gte: today },
        },
        include: {
            point_rules: {
                select: { code: true, event_type: true },
            },
        },
    });
    const groupedByType = {};
    for (const entry of breakdown) {
        const type = entry.point_rules?.event_type ?? "unknown";
        groupedByType[type] = (groupedByType[type] ?? 0) + entry.amount;
    }
    return {
        total: result._sum.amount ?? 0,
        breakdown: groupedByType,
        transactions: breakdown.length,
    };
}
/**
 * Get user level and progress
 */
export async function getLevelInfo(userId) {
    const balance = await db.point_balances.findUnique({
        where: { user_id: userId },
    });
    const totalXP = Number(balance?.total_points ?? 0);
    const levelInfo = calculateLevel(totalXP);
    // Get level milestones
    const milestones = [
        { level: 5, reward: "Silver Badge Frame" },
        { level: 10, reward: "Gold Badge Frame" },
        { level: 15, reward: "Platinum Badge Frame" },
        { level: 20, reward: "Diamond Badge Frame" },
    ];
    const nextMilestone = milestones.find(m => m.level > levelInfo.level);
    return {
        level: levelInfo.level,
        total_xp: totalXP,
        current_level_xp: levelInfo.currentLevelXP,
        xp_for_next_level: levelInfo.nextLevelXP,
        xp_remaining: levelInfo.xpToNext,
        progress_percent: levelInfo.progress,
        next_milestone: nextMilestone,
    };
}
/**
 * Get badge gallery with progress
 */
export async function getBadgeGallery(userId) {
    const [allBadges, earnedBadges, badgeRules, streaks, taskCount] = await Promise.all([
        db.badge_definitions.findMany({
            include: { badge_rules: true },
            orderBy: [{ category: "asc" }, { tier: "asc" }],
        }),
        db.user_badges.findMany({
            where: { user_id: userId },
            select: { badge_id: true, earned_at: true },
        }),
        db.badge_rules.findMany({ where: { is_active: true } }),
        db.streaks.findFirst({ where: { user_id: userId, kind: "task_completion" } }),
        db.user_task_progress.count({ where: { user_id: userId, status: "completed" } }),
    ]);
    const earnedMap = new Map(earnedBadges.map(b => [b.badge_id, b.earned_at]));
    const currentStreak = streaks?.current_length ?? 0;
    // Calculate progress for each badge
    const badges = allBadges.map(badge => {
        const isEarned = earnedMap.has(badge.id);
        const earnedAt = earnedMap.get(badge.id);
        const rule = badge.badge_rules[0];
        let progress = 0;
        let current = 0;
        let required = rule?.threshold ?? 0;
        let daysLeft = null;
        if (rule) {
            switch (rule.rule_type) {
                case "streak_days":
                    current = currentStreak;
                    progress = Math.min(100, Math.round((current / required) * 100));
                    daysLeft = Math.max(0, required - current);
                    break;
                case "tasks_completed":
                    current = taskCount;
                    progress = Math.min(100, Math.round((current / required) * 100));
                    break;
                default:
                    progress = isEarned ? 100 : 0;
            }
        }
        return {
            id: badge.id,
            slug: badge.slug,
            name: badge.name,
            description: badge.description,
            icon_url: badge.icon_url,
            category: badge.category,
            tier: badge.tier,
            earned: isEarned,
            earned_at: earnedAt,
            progress,
            current,
            required,
            days_left: daysLeft,
        };
    });
    // Separate earned and locked badges
    const earnedBadgesList = badges.filter(b => b.earned);
    const lockedBadges = badges.filter(b => !b.earned).sort((a, b) => b.progress - a.progress);
    return {
        earned: earnedBadgesList,
        locked: lockedBadges,
        total_earned: earnedBadgesList.length,
        total_available: badges.length,
    };
}
/**
 * Get next badge to earn
 */
export async function getNextBadge(userId) {
    const [earnedBadges, badgeRules, streaks] = await Promise.all([
        db.user_badges.findMany({
            where: { user_id: userId },
            select: { badge_id: true },
        }),
        db.badge_rules.findMany({
            where: { is_active: true },
            include: { badge_definitions: true },
            orderBy: { threshold: "asc" },
        }),
        db.streaks.findFirst({ where: { user_id: userId, kind: "task_completion" } }),
    ]);
    const earnedBadgeIds = new Set(earnedBadges.map(b => b.badge_id));
    const currentStreak = streaks?.current_length ?? 0;
    // Find the closest badge to earning
    for (const rule of badgeRules) {
        if (earnedBadgeIds.has(rule.badge_id))
            continue;
        if (rule.rule_type === "streak_days") {
            const daysLeft = rule.threshold - currentStreak;
            if (daysLeft > 0) {
                return {
                    id: rule.badge_definitions.id,
                    slug: rule.badge_definitions.slug,
                    name: rule.badge_definitions.name,
                    description: rule.badge_definitions.description,
                    icon_url: rule.badge_definitions.icon_url,
                    category: rule.badge_definitions.category,
                    tier: rule.badge_definitions.tier,
                    progress: Math.round((currentStreak / rule.threshold) * 100),
                    current: currentStreak,
                    required: rule.threshold,
                    days_left: daysLeft,
                };
            }
        }
    }
    // Return first unearned badge if no streak-based found
    const firstUnearned = badgeRules.find(r => !earnedBadgeIds.has(r.badge_id));
    if (firstUnearned) {
        return {
            id: firstUnearned.badge_definitions.id,
            slug: firstUnearned.badge_definitions.slug,
            name: firstUnearned.badge_definitions.name,
            description: firstUnearned.badge_definitions.description,
            icon_url: firstUnearned.badge_definitions.icon_url,
            category: firstUnearned.badge_definitions.category,
            tier: firstUnearned.badge_definitions.tier,
            progress: 0,
            current: 0,
            required: firstUnearned.threshold,
            days_left: firstUnearned.threshold,
        };
    }
    return null;
}
// Helper function
function calculateLevel(totalXP) {
    let level = 1;
    let xpRequired = 0;
    let nextLevelXP = 100;
    while (totalXP >= xpRequired + nextLevelXP) {
        xpRequired += nextLevelXP;
        level++;
        nextLevelXP = level * 100;
    }
    const currentLevelXP = totalXP - xpRequired;
    const progress = Math.round((currentLevelXP / nextLevelXP) * 100);
    const xpToNext = nextLevelXP - currentLevelXP;
    return { level, progress, xpToNext, currentLevelXP, nextLevelXP };
}
//# sourceMappingURL=rewards.service.js.map