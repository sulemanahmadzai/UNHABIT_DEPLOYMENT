import { prisma } from "../lib/services.js";
/**
 * Generate shareable progress data
 */
export async function generateProgressShare(userId) {
    const [profile, streaks, balance, activeJourney, earnedBadges] = await Promise.all([
        prisma.profiles.findUnique({ where: { user_id: userId } }),
        prisma.streaks.findFirst({ where: { user_id: userId, kind: "task_completion" } }),
        prisma.point_balances.findUnique({ where: { user_id: userId } }),
        prisma.journeys.findFirst({
            where: { user_id: userId, status: "active" },
            include: { user_habits: true },
        }),
        prisma.user_badges.count({ where: { user_id: userId } }),
    ]);
    const totalXP = Number(balance?.total_points ?? 0);
    const level = calculateLevel(totalXP);
    // Calculate journey progress
    let journeyProgress = 0;
    let currentDay = 0;
    if (activeJourney && activeJourney.start_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(activeJourney.start_date);
        startDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - startDate.getTime();
        currentDay = Math.min(Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1, activeJourney.planned_days);
        journeyProgress = Math.round((currentDay / activeJourney.planned_days) * 100);
    }
    // Generate unique share code
    const shareCode = generateShareCode(userId);
    // Generate share URL
    const baseUrl = process.env.APP_BASE_URL || "https://unhabit.app";
    const shareUrl = `${baseUrl}/share/${shareCode}`;
    // Build share data
    const shareData = {
        share_url: shareUrl,
        share_code: shareCode,
        user: {
            name: profile?.full_name ?? "Anonymous",
            avatar_url: profile?.avatar_url,
        },
        stats: {
            streak: streaks?.current_length ?? 0,
            best_streak: streaks?.best_length ?? 0,
            level: level.level,
            total_xp: totalXP,
            badges_earned: earnedBadges,
        },
        journey: activeJourney ? {
            habit: activeJourney.user_habits?.goal_text ?? "Building a new habit",
            day: currentDay,
            total_days: activeJourney.planned_days,
            progress: journeyProgress,
        } : null,
        // Open Graph metadata for link previews
        og_metadata: {
            title: `${profile?.full_name ?? "Someone"} is on a ${streaks?.current_length ?? 0}-day streak!`,
            description: activeJourney
                ? `Day ${currentDay} of ${activeJourney.planned_days} on their journey to ${activeJourney.user_habits?.goal_text ?? "build a new habit"}`
                : "Building better habits with UnHabit",
            image: `${baseUrl}/og/progress/${shareCode}`,
        },
    };
    return shareData;
}
/**
 * Generate shareable achievement data
 */
export async function generateAchievementShare(userId, achievementType, achievementId) {
    const profile = await prisma.profiles.findUnique({ where: { user_id: userId } });
    const shareCode = generateShareCode(userId);
    const baseUrl = process.env.APP_BASE_URL || "https://unhabit.app";
    const shareUrl = `${baseUrl}/share/${shareCode}`;
    let achievementData = {};
    let title = "";
    let description = "";
    switch (achievementType) {
        case "badge": {
            if (achievementId) {
                const userBadge = await prisma.user_badges.findFirst({
                    where: { id: achievementId, user_id: userId },
                    include: { badge_definitions: true },
                });
                if (userBadge) {
                    achievementData = {
                        type: "badge",
                        badge: {
                            name: userBadge.badge_definitions.name,
                            slug: userBadge.badge_definitions.slug,
                            description: userBadge.badge_definitions.description,
                            icon_url: userBadge.badge_definitions.icon_url,
                        },
                        earned_at: userBadge.earned_at,
                    };
                    title = `${profile?.full_name ?? "Someone"} earned the ${userBadge.badge_definitions.name} badge!`;
                    description = userBadge.badge_definitions.description ?? "";
                }
            }
            break;
        }
        case "streak": {
            const streak = await prisma.streaks.findFirst({
                where: { user_id: userId, kind: "task_completion" },
            });
            achievementData = {
                type: "streak",
                streak: streak?.current_length ?? 0,
            };
            title = `${profile?.full_name ?? "Someone"} is on a ${streak?.current_length ?? 0}-day streak!`;
            description = "Consistency is key to building lasting habits.";
            break;
        }
        case "level": {
            const balance = await prisma.point_balances.findUnique({ where: { user_id: userId } });
            const level = calculateLevel(Number(balance?.total_points ?? 0));
            achievementData = {
                type: "level",
                level: level.level,
                total_xp: Number(balance?.total_points ?? 0),
            };
            title = `${profile?.full_name ?? "Someone"} reached Level ${level.level}!`;
            description = `${Number(balance?.total_points ?? 0)} XP earned through dedication and consistency.`;
            break;
        }
        case "journey_complete": {
            if (achievementId) {
                const journey = await prisma.journeys.findFirst({
                    where: { id: achievementId, user_id: userId },
                    include: { user_habits: true },
                });
                if (journey) {
                    achievementData = {
                        type: "journey_complete",
                        journey: {
                            habit: journey.user_habits?.goal_text,
                            days: journey.planned_days,
                        },
                    };
                    title = `${profile?.full_name ?? "Someone"} completed their ${journey.planned_days}-day journey!`;
                    description = journey.user_habits?.goal_text ?? "Successfully completed the habit journey!";
                }
            }
            break;
        }
    }
    return {
        share_url: shareUrl,
        share_code: shareCode,
        achievement: achievementData,
        user: {
            name: profile?.full_name ?? "Anonymous",
            avatar_url: profile?.avatar_url,
        },
        og_metadata: {
            title,
            description,
            image: `${baseUrl}/og/achievement/${shareCode}`,
        },
    };
}
// Helper functions
function generateShareCode(userId) {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    const userPart = userId.substring(0, 4);
    return `${userPart}${timestamp}${randomPart}`;
}
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
    return { level, progress };
}
//# sourceMappingURL=share.service.js.map