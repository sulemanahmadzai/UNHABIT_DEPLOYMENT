import { prisma } from "../lib/services.js";
import { getSettingValue } from "./admin.service.js";
/**
 * Get detailed streak information including calendar
 */
export async function getStreakDetails(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [streaks, freezeTokens, freezeHistory, taskProgress] = await Promise.all([
        prisma.streaks.findMany({ where: { user_id: userId } }),
        prisma.streak_freeze_tokens.findUnique({ where: { user_id: userId } }),
        prisma.streak_freeze_history.findMany({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
            take: 30,
        }),
        // Get task completions for the last 30 days for calendar
        prisma.user_task_progress.findMany({
            where: {
                user_id: userId,
                status: "completed",
                completed_at: {
                    gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
                },
            },
            select: { completed_at: true },
        }),
    ]);
    const mainStreak = streaks.find(s => s.kind === "task_completion");
    // Build completion calendar (last 30 days)
    const calendar = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0];
        const hasCompletion = taskProgress.some(p => {
            if (!p.completed_at)
                return false;
            const completedDate = new Date(p.completed_at);
            completedDate.setHours(0, 0, 0, 0);
            return completedDate.getTime() === date.getTime();
        });
        const wasFrozen = freezeHistory.some(h => {
            if (!h.used_for_date)
                return false;
            const freezeDate = new Date(h.used_for_date);
            freezeDate.setHours(0, 0, 0, 0);
            return h.action === "used" && freezeDate.getTime() === date.getTime();
        });
        let status;
        if (i === 0) {
            status = hasCompletion ? "completed" : "today";
        }
        else if (hasCompletion) {
            status = "completed";
        }
        else if (wasFrozen) {
            status = "frozen";
        }
        else {
            status = "missed";
        }
        if (dateStr) {
            calendar.push({
                date: dateStr,
                day_of_week: date.getDay(),
                status,
            });
        }
    }
    // Calculate freeze availability
    const freezesUsedThisWeek = await getFreezesUsedThisWeek(userId);
    const maxFreezesPerWeek = await getSettingValue("max_freezes_purchasable_per_week", 3);
    const baseFreezes = await getSettingValue("base_freezes_per_week", 1);
    return {
        current_streak: mainStreak?.current_length ?? 0,
        longest_streak: mainStreak?.best_length ?? 0,
        last_activity_date: mainStreak?.last_event_date,
        is_frozen: mainStreak?.is_frozen ?? false,
        freeze_tokens: {
            available: freezeTokens?.available ?? 0,
            used_this_week: freezesUsedThisWeek,
            max_per_week: maxFreezesPerWeek,
        },
        calendar,
        streak_rules: {
            keep_alive: "Complete at least 1 core task per day",
            break_chain: "Missing a day breaks the streak",
            freeze_protection: "Use a freeze to protect your streak when you miss a day",
        },
    };
}
/**
 * Use a streak freeze to protect streak
 */
export async function useStreakFreeze(userId) {
    // Check if user has freeze tokens
    const freezeTokens = await prisma.streak_freeze_tokens.findUnique({
        where: { user_id: userId },
    });
    if (!freezeTokens || freezeTokens.available <= 0) {
        return { success: false, error: "No freeze tokens available" };
    }
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Check if already used a freeze today
    const existingFreeze = await prisma.streak_freeze_history.findFirst({
        where: {
            user_id: userId,
            action: "used",
            used_for_date: today,
        },
    });
    if (existingFreeze) {
        return { success: false, error: "Already used a freeze today" };
    }
    // Use the freeze
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
                used_for_date: today,
            },
        }),
        // Mark streak as frozen for today
        prisma.streaks.update({
            where: {
                user_id_kind: {
                    user_id: userId,
                    kind: "task_completion",
                },
            },
            data: { is_frozen: true },
        }),
    ]);
    return {
        success: true,
        remaining_freezes: freezeTokens.available - 1,
        message: "Streak freeze used successfully",
    };
}
/**
 * Purchase streak freeze with XP
 */
export async function purchaseStreakFreeze(userId) {
    const freezeCostXP = await getSettingValue("streak_freeze_cost_xp", 100);
    const maxPerWeek = await getSettingValue("max_freezes_purchasable_per_week", 3);
    // Check if user has enough XP
    const pointBalance = await prisma.point_balances.findUnique({
        where: { user_id: userId },
    });
    if (!pointBalance || Number(pointBalance.total_points) < freezeCostXP) {
        return { success: false, error: `Not enough XP. Need ${freezeCostXP} XP.` };
    }
    // Check purchase limit this week
    const purchasedThisWeek = await getFreezesUsedThisWeek(userId);
    if (purchasedThisWeek >= maxPerWeek) {
        return { success: false, error: `Maximum ${maxPerWeek} freezes per week` };
    }
    // Purchase the freeze
    await prisma.$transaction([
        // Deduct XP
        prisma.point_balances.update({
            where: { user_id: userId },
            data: {
                total_points: { decrement: freezeCostXP },
                updated_at: new Date(),
            },
        }),
        // Add freeze token
        prisma.streak_freeze_tokens.upsert({
            where: { user_id: userId },
            update: {
                available: { increment: 1 },
                updated_at: new Date(),
            },
            create: {
                user_id: userId,
                available: 1,
            },
        }),
        // Record purchase
        prisma.streak_freeze_history.create({
            data: {
                user_id: userId,
                action: "purchased",
                xp_spent: freezeCostXP,
            },
        }),
    ]);
    const updatedTokens = await prisma.streak_freeze_tokens.findUnique({
        where: { user_id: userId },
    });
    return {
        success: true,
        xp_spent: freezeCostXP,
        available_freezes: updatedTokens?.available ?? 0,
        message: "Streak freeze purchased successfully",
    };
}
/**
 * Get streak at risk status
 */
export async function getStreakAtRiskStatus(userId) {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    // Check if user has completed any task today
    const completedToday = await prisma.user_task_progress.count({
        where: {
            user_id: userId,
            status: "completed",
            completed_at: { gte: today },
        },
    });
    const streak = await prisma.streaks.findFirst({
        where: { user_id: userId, kind: "task_completion" },
    });
    if (completedToday > 0) {
        return {
            at_risk: false,
            current_streak: streak?.current_length ?? 0,
            message: "You've completed tasks today! Streak safe.",
        };
    }
    if (!streak || streak.current_length === 0) {
        return {
            at_risk: false,
            current_streak: 0,
            message: "Start your streak today!",
        };
    }
    // Calculate time remaining
    const msRemaining = endOfDay.getTime() - now.getTime();
    const hoursLeft = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesLeft = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    return {
        at_risk: true,
        current_streak: streak.current_length,
        hours_left: hoursLeft,
        minutes_left: minutesLeft,
        time_remaining: `${hoursLeft.toString().padStart(2, "0")}:${minutesLeft.toString().padStart(2, "0")}:00`,
        message: `Complete 1 task to save your ${streak.current_length}-day streak!`,
    };
}
/**
 * Get habit health score
 */
export async function getHabitHealth(userId) {
    const activeJourney = await prisma.journeys.findFirst({
        where: { user_id: userId, status: "active" },
        include: {
            journey_days: {
                include: {
                    journey_tasks: {
                        include: {
                            user_task_progress: {
                                where: { user_id: userId },
                            },
                        },
                    },
                },
            },
            user_habits: true,
        },
    });
    if (!activeJourney) {
        return {
            has_active_journey: false,
            health_score: 0,
            message: "No active journey",
        };
    }
    let totalTasks = 0;
    let completedTasks = 0;
    for (const day of activeJourney.journey_days) {
        for (const task of day.journey_tasks) {
            totalTasks++;
            if (task.user_task_progress.some(p => p.status === "completed")) {
                completedTasks++;
            }
        }
    }
    const healthScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    // Determine health status
    let status;
    if (healthScore >= 80)
        status = "excellent";
    else if (healthScore >= 60)
        status = "good";
    else if (healthScore >= 40)
        status = "fair";
    else
        status = "needs_attention";
    return {
        has_active_journey: true,
        journey_id: activeJourney.id,
        habit_goal: activeJourney.user_habits?.goal_text,
        health_score: healthScore,
        status,
        tasks_completed: completedTasks,
        tasks_total: totalTasks,
        message: getHealthMessage(healthScore),
    };
}
// Helper functions
async function getFreezesUsedThisWeek(userId) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const count = await prisma.streak_freeze_history.count({
        where: {
            user_id: userId,
            action: { in: ["used", "purchased"] },
            created_at: { gte: startOfWeek },
        },
    });
    return count;
}
function getHealthMessage(score) {
    if (score >= 80)
        return "Excellent! You're building a strong habit.";
    if (score >= 60)
        return "Good progress! Keep pushing forward.";
    if (score >= 40)
        return "You're making progress. Try to be more consistent.";
    return "Your habit needs attention. Let's get back on track!";
}
/**
 * Reset streak (Continue with penalty)
 * Sets current_length to 0 so user can start fresh from tomorrow
 */
export async function resetStreak(userId) {
    const streak = await prisma.streaks.findFirst({
        where: { user_id: userId, kind: "task_completion" },
    });
    if (!streak) {
        // No streak record yet — nothing to reset
        return { success: true, current_streak: 0, message: "No active streak to reset" };
    }
    await prisma.streaks.update({
        where: {
            user_id_kind: {
                user_id: userId,
                kind: "task_completion",
            },
        },
        data: {
            current_length: 0,
            last_event_date: null,
            is_frozen: false,
        },
    });
    return {
        success: true,
        current_streak: 0,
        message: "Streak reset successfully. Start fresh from today!",
    };
}
/**
 * Calculate available freezes based on XP and consistency
 * Formula: base_freezes + floor(total_xp / 1000) + streak_bonus
 */
export async function calculateAvailableFreezes(userId) {
    const baseFreezes = await getSettingValue("base_freezes_per_week", 1);
    const [pointBalance, streak] = await Promise.all([
        prisma.point_balances.findUnique({ where: { user_id: userId } }),
        prisma.streaks.findFirst({ where: { user_id: userId, kind: "task_completion" } }),
    ]);
    const totalXP = Number(pointBalance?.total_points ?? 0);
    const currentStreak = streak?.current_length ?? 0;
    // XP bonus: 1 extra freeze per 1000 XP (max 2 from XP)
    const xpBonus = Math.min(Math.floor(totalXP / 1000), 2);
    // Streak bonus: 1 extra freeze if streak >= 14 days
    const streakBonus = currentStreak >= 14 ? 1 : 0;
    return baseFreezes + xpBonus + streakBonus;
}
//# sourceMappingURL=streaks.service.js.map