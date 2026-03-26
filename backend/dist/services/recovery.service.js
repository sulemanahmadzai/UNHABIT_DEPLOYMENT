import { prisma } from "../lib/services.js";
import { getSettingValue } from "./admin.service.js";
/**
 * Check if user missed a day and needs to recover
 */
export async function checkMissedDay(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    // Get main streak
    const streak = await prisma.streaks.findFirst({
        where: { user_id: userId, kind: "task_completion" },
    });
    if (!streak || streak.current_length === 0) {
        return {
            missed: false,
            needs_recovery: false,
            message: "No active streak",
        };
    }
    // Check if user completed any task yesterday
    const yesterdayCompletion = await prisma.user_task_progress.count({
        where: {
            user_id: userId,
            status: "completed",
            completed_at: {
                gte: yesterday,
                lt: today,
            },
        },
    });
    // Check if streak was frozen yesterday
    const wasFreezed = await prisma.streak_freeze_history.findFirst({
        where: {
            user_id: userId,
            action: "used",
            used_for_date: yesterday,
        },
    });
    if (yesterdayCompletion > 0 || wasFreezed) {
        return {
            missed: false,
            needs_recovery: false,
            current_streak: streak.current_length,
        };
    }
    // Check if last activity was yesterday (streak would be at risk)
    const lastEventDate = streak.last_event_date ? new Date(streak.last_event_date) : null;
    if (lastEventDate) {
        lastEventDate.setHours(0, 0, 0, 0);
        const daysSinceLastEvent = Math.floor((today.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastEvent >= 1) {
            // Get available freeze tokens
            const freezeTokens = await prisma.streak_freeze_tokens.findUnique({
                where: { user_id: userId },
            });
            return {
                missed: true,
                needs_recovery: true,
                current_streak: streak.current_length,
                days_missed: daysSinceLastEvent,
                freeze_tokens_available: freezeTokens?.available ?? 0,
                options: [
                    {
                        id: "penalty",
                        title: "Continue with penalty",
                        description: "Streak resets, XP reduced",
                        consequences: {
                            streak_reset: true,
                            xp_penalty: true,
                        },
                    },
                    {
                        id: "freeze",
                        title: "Use streak protection",
                        description: "Streak saved, limited uses",
                        available: (freezeTokens?.available ?? 0) > 0,
                        consequences: {
                            streak_reset: false,
                            uses_freeze: true,
                        },
                    },
                    {
                        id: "restart",
                        title: "Restart 21-Day Plan",
                        description: "Fresh start, XP kept",
                        consequences: {
                            streak_reset: true,
                            journey_restart: true,
                            xp_kept: true,
                        },
                    },
                ],
            };
        }
    }
    return {
        missed: false,
        needs_recovery: false,
        current_streak: streak.current_length,
    };
}
/**
 * Continue with penalty - reset streak and reduce XP
 */
export async function continueWithPenalty(userId) {
    // Get penalty percentage from settings
    const penaltyPercent = await getSettingValue("penalty_xp_percentage", 5);
    // Get current XP
    const balance = await prisma.point_balances.findUnique({
        where: { user_id: userId },
    });
    const currentXP = Number(balance?.total_points ?? 0);
    const xpPenalty = Math.floor(currentXP * (penaltyPercent / 100));
    // Reset streak and apply XP penalty
    await prisma.$transaction([
        // Reset streak
        prisma.streaks.updateMany({
            where: { user_id: userId, kind: "task_completion" },
            data: {
                current_length: 0,
                is_frozen: false,
            },
        }),
        // Apply XP penalty
        ...(xpPenalty > 0 ? [
            prisma.point_balances.update({
                where: { user_id: userId },
                data: {
                    total_points: { decrement: xpPenalty },
                    updated_at: new Date(),
                },
            }),
            // Log the penalty
            prisma.points_ledger.create({
                data: {
                    user_id: userId,
                    amount: -xpPenalty,
                    // No rule_id for penalty
                },
            }),
        ] : []),
    ]);
    return {
        success: true,
        action: "penalty",
        streak_reset: true,
        xp_deducted: xpPenalty,
        penalty_percent: penaltyPercent,
        remaining_xp: currentXP - xpPenalty,
        message: `Streak reset. ${xpPenalty} XP deducted (${penaltyPercent}% penalty).`,
    };
}
/**
 * Use streak protection (freeze token)
 */
export async function useProtection(userId) {
    // Check if user has freeze tokens
    const freezeTokens = await prisma.streak_freeze_tokens.findUnique({
        where: { user_id: userId },
    });
    if (!freezeTokens || freezeTokens.available <= 0) {
        return {
            success: false,
            error: "No freeze tokens available",
        };
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    // Use the freeze for yesterday
    await prisma.$transaction([
        // Decrement available freezes
        prisma.streak_freeze_tokens.update({
            where: { user_id: userId },
            data: {
                available: { decrement: 1 },
                updated_at: new Date(),
            },
        }),
        // Record freeze usage
        prisma.streak_freeze_history.create({
            data: {
                user_id: userId,
                action: "used",
                streak_kind: "task_completion",
                used_for_date: yesterday,
            },
        }),
    ]);
    // Get current streak
    const streak = await prisma.streaks.findFirst({
        where: { user_id: userId, kind: "task_completion" },
    });
    return {
        success: true,
        action: "protection",
        streak_saved: true,
        current_streak: streak?.current_length ?? 0,
        remaining_freezes: freezeTokens.available - 1,
        message: "Streak protected! Your streak is safe.",
    };
}
/**
 * Restart 21-Day Plan (keep XP, reset journey)
 */
export async function restartPlan(userId) {
    // Get active journey
    const activeJourney = await prisma.journeys.findFirst({
        where: {
            user_id: userId,
            status: "active",
        },
    });
    if (!activeJourney) {
        return {
            success: false,
            error: "No active journey to restart",
        };
    }
    // Reset streak
    await prisma.streaks.updateMany({
        where: { user_id: userId, kind: "task_completion" },
        data: {
            current_length: 0,
            is_frozen: false,
        },
    });
    // Get journey days for resetting progress
    const journeyDays = await prisma.journey_days.findMany({
        where: { journey_id: activeJourney.id },
        select: { id: true },
    });
    const dayIds = journeyDays.map(d => d.id);
    const tasks = await prisma.journey_tasks.findMany({
        where: { journey_day_id: { in: dayIds } },
        select: { id: true },
    });
    const taskIds = tasks.map(t => t.id);
    // Reset journey progress
    await prisma.$transaction([
        // Delete all task progress
        prisma.user_task_progress.deleteMany({
            where: {
                user_id: userId,
                journey_task_id: { in: taskIds },
            },
        }),
        // Delete all reflections
        prisma.reflections.deleteMany({
            where: {
                user_id: userId,
                journey_day_id: { in: dayIds },
            },
        }),
        // Reset journey to active with new start date
        prisma.journeys.update({
            where: { id: activeJourney.id },
            data: {
                status: "active",
                start_date: new Date(),
            },
        }),
    ]);
    // Get current XP (unchanged)
    const balance = await prisma.point_balances.findUnique({
        where: { user_id: userId },
    });
    return {
        success: true,
        action: "restart",
        journey_id: activeJourney.id,
        streak_reset: true,
        xp_kept: Number(balance?.total_points ?? 0),
        message: "Journey restarted! Your XP is preserved. Day 1 begins now.",
    };
}
//# sourceMappingURL=recovery.service.js.map