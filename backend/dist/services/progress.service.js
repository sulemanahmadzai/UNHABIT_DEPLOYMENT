import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";
import * as BadgeAwardingService from "./badge-awarding.service.js";
/**
 * Mark a task as completed
 */
export async function completeTask(userId, taskId) {
    // Single DB round-trip:
    // - verifies task ownership through journey -> user
    // - inserts or updates completion state atomically
    const rows = await db.$queryRaw `
    INSERT INTO user_task_progress (user_id, journey_task_id, status, completed_at)
    SELECT ${userId}::uuid, jt.id, 'completed', NOW()
    FROM journey_tasks jt
    INNER JOIN journey_days jd ON jd.id = jt.journey_day_id
    INNER JOIN journeys j ON j.id = jd.journey_id
    WHERE jt.id = ${taskId}::uuid
      AND j.user_id = ${userId}::uuid
    ON CONFLICT (user_id, journey_task_id)
    DO UPDATE SET
      status = 'completed',
      completed_at = NOW()
    RETURNING id, user_id, journey_task_id, status, completed_at, created_at
  `;
    return rows[0] ?? null;
}
/**
 * Mark a task as not completed (undo)
 */
export async function uncompleteTask(userId, taskId) {
    try {
        return await db.user_task_progress.update({
            where: {
                user_id_journey_task_id: {
                    user_id: userId,
                    journey_task_id: taskId,
                },
            },
            data: {
                status: "pending",
                completed_at: null,
            },
        });
    }
    catch {
        return null;
    }
}
/**
 * Get user's task progress
 */
export async function getUserTaskProgress(userId, journeyId) {
    const where = {
        user_id: userId,
    };
    if (journeyId) {
        where.journey_tasks = {
            journey_days: {
                journey_id: journeyId,
            },
        };
    }
    return db.user_task_progress.findMany({
        where,
        include: {
            journey_tasks: {
                include: {
                    journey_days: {
                        select: {
                            day_number: true,
                            journey_id: true,
                        },
                    },
                },
            },
        },
        orderBy: { created_at: "desc" },
    });
}
/**
 * Get journey progress summary
 */
export async function getJourneyProgressSummary(userId, journeyId) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
        },
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
                    reflections: {
                        where: { user_id: userId },
                    },
                },
                orderBy: { day_number: "asc" },
            },
            adherence_scores: {
                orderBy: { day_number: "desc" },
                take: 1,
            },
        },
    });
    if (!journey) {
        return null;
    }
    // Calculate statistics
    let totalTasks = 0;
    let completedTasks = 0;
    let totalDays = journey.journey_days.length;
    let daysWithReflection = 0;
    for (const day of journey.journey_days) {
        totalTasks += day.journey_tasks.length;
        completedTasks += day.journey_tasks.filter((t) => t.user_task_progress.some((p) => p.status === "completed")).length;
        if (day.reflections.length > 0) {
            daysWithReflection++;
        }
    }
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const reflectionRate = totalDays > 0 ? (daysWithReflection / totalDays) * 100 : 0;
    return {
        journey_id: journeyId,
        status: journey.status,
        total_days: totalDays,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        completion_rate: Math.round(completionRate * 100) / 100,
        days_with_reflection: daysWithReflection,
        reflection_rate: Math.round(reflectionRate * 100) / 100,
        latest_adherence_score: journey.adherence_scores[0]?.score || null,
        days: journey.journey_days.map((day) => ({
            day_number: day.day_number,
            theme: day.theme,
            tasks_total: day.journey_tasks.length,
            tasks_completed: day.journey_tasks.filter((t) => t.user_task_progress.some((p) => p.status === "completed")).length,
            has_reflection: day.reflections.length > 0,
        })),
    };
}
/**
 * Submit a daily reflection
 */
export async function submitReflection(userId, data) {
    // Verify day exists and user owns the journey
    const day = await db.journey_days.findFirst({
        where: { id: data.journey_day_id },
        include: {
            journeys: true,
        },
    });
    if (!day || day.journeys.user_id !== userId) {
        throw new Error("Journey day not found");
    }
    // Upsert reflection
    const reflection = await db.reflections.upsert({
        where: {
            user_id_journey_day_id: {
                user_id: userId,
                journey_day_id: data.journey_day_id,
            },
        },
        create: {
            user_id: userId,
            journey_day_id: data.journey_day_id,
            content: data.content ?? null,
            answers: data.answers || {},
        },
        update: {
            content: data.content ?? null,
            answers: data.answers || {},
        },
    });
    // Check for reflection badges
    await BadgeAwardingService.checkAndAwardBadgeType(userId, 'reflections_submitted');
    return reflection;
}
/**
 * Get reflection for a day
 */
export async function getReflection(userId, journeyDayId) {
    return db.reflections.findFirst({
        where: {
            user_id: userId,
            journey_day_id: journeyDayId,
        },
    });
}
/**
 * Report a slip event
 */
export async function reportSlip(userId, data) {
    // If habit ID provided, verify ownership
    if (data.user_habit_id) {
        const habit = await db.user_habits.findFirst({
            where: {
                id: data.user_habit_id,
                user_id: userId,
            },
        });
        if (!habit) {
            throw new Error("Habit not found");
        }
    }
    return db.slip_events.create({
        data: {
            user_id: userId,
            user_habit_id: data.user_habit_id ?? null,
            happened_at: data.happened_at,
            context: data.context ? data.context : Prisma.JsonNull,
        },
    });
}
/**
 * Get slip history
 */
export async function getSlipHistory(userId, limit, offset) {
    return db.slip_events.findMany({
        where: { user_id: userId },
        include: {
            user_habits: {
                select: {
                    id: true,
                    goal_text: true,
                },
            },
        },
        orderBy: { happened_at: "desc" },
        take: limit,
        skip: offset,
    });
}
/**
 * Get today's progress (tasks for the current journey day)
 */
export async function getTodayProgress(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Get active journey
    const activeJourney = await db.journeys.findFirst({
        where: {
            user_id: userId,
            status: "active",
        },
        include: {
            user_habits: true,
        },
    });
    if (!activeJourney || !activeJourney.start_date) {
        return {
            has_active_journey: false,
            tasks: [],
            tasks_completed: 0,
            tasks_total: 0,
        };
    }
    // Calculate current day number
    const startDate = new Date(activeJourney.start_date);
    startDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const currentDayNumber = Math.min(Math.max(diffDays + 1, 1), activeJourney.planned_days);
    // Get today's journey day with tasks
    const journeyDay = await db.journey_days.findFirst({
        where: {
            journey_id: activeJourney.id,
            day_number: currentDayNumber,
        },
        include: {
            journey_tasks: {
                include: {
                    user_task_progress: {
                        where: { user_id: userId },
                    },
                },
            },
        },
    });
    if (!journeyDay) {
        return {
            has_active_journey: true,
            journey_id: activeJourney.id,
            day_number: currentDayNumber,
            tasks: [],
            tasks_completed: 0,
            tasks_total: 0,
        };
    }
    const tasks = journeyDay.journey_tasks.map(task => ({
        id: task.id,
        title: task.title,
        kind: task.kind,
        effort: task.effort,
        completed: task.user_task_progress.some(p => p.status === "completed"),
        completed_at: task.user_task_progress.find(p => p.status === "completed")?.completed_at,
        xp: 10, // Default XP per task
    }));
    const completedCount = tasks.filter(t => t.completed).length;
    return {
        has_active_journey: true,
        journey_id: activeJourney.id,
        day_id: journeyDay.id,
        day_number: currentDayNumber,
        total_days: activeJourney.planned_days,
        theme: journeyDay.theme,
        habit_goal: activeJourney.user_habits?.goal_text,
        tasks,
        tasks_completed: completedCount,
        tasks_total: tasks.length,
        all_completed: completedCount === tasks.length && tasks.length > 0,
    };
}
/**
 * Complete all tasks for today
 */
export async function completeDayTasks(userId) {
    const todayProgress = await getTodayProgress(userId);
    if (!todayProgress.has_active_journey || todayProgress.tasks.length === 0) {
        return {
            completed: 0,
            already_completed: 0,
        };
    }
    let completed = 0;
    let alreadyCompleted = 0;
    for (const task of todayProgress.tasks) {
        if (task.completed) {
            alreadyCompleted++;
            continue;
        }
        await db.user_task_progress.upsert({
            where: {
                user_id_journey_task_id: {
                    user_id: userId,
                    journey_task_id: task.id,
                },
            },
            create: {
                user_id: userId,
                journey_task_id: task.id,
                status: "completed",
                completed_at: new Date(),
            },
            update: {
                status: "completed",
                completed_at: new Date(),
            },
        });
        completed++;
    }
    return {
        completed,
        already_completed: alreadyCompleted,
        total: todayProgress.tasks.length,
    };
}
/**
 * Get progress snapshot (XP, streak, habit health, next badge)
 */
export async function getProgressSnapshot(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [pointBalance, todayXP, streaks, activeJourney, earnedBadgesCount, nextBadgeInfo,] = await Promise.all([
        db.point_balances.findUnique({ where: { user_id: userId } }),
        getTodayXPInternal(userId),
        db.streaks.findMany({ where: { user_id: userId } }),
        db.journeys.findFirst({
            where: { user_id: userId, status: "active" },
            include: { journey_days: { include: { journey_tasks: { include: { user_task_progress: { where: { user_id: userId } } } } } } },
        }),
        db.user_badges.count({ where: { user_id: userId } }),
        getNextBadgeInfo(userId),
    ]);
    const mainStreak = streaks.find(s => s.kind === "task_completion");
    // Calculate habit health
    let habitHealth = 0;
    if (activeJourney) {
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
        habitHealth = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    }
    // Calculate level
    const totalXP = Number(pointBalance?.total_points ?? 0);
    const level = calculateLevelFromXP(totalXP);
    return {
        xp: {
            total: totalXP,
            today: todayXP,
            if_completed_today: todayXP + (await getRemainingXPToday(userId)),
        },
        streak: {
            current: mainStreak?.current_length ?? 0,
            impact: mainStreak?.current_length ? "+1 day" : "Start streak",
        },
        habit_health: {
            current: habitHealth,
            change: "+5%", // Placeholder - could calculate actual change
        },
        level: {
            current: level.level,
            progress: level.progress,
        },
        badges: {
            earned: earnedBadgesCount,
            next: nextBadgeInfo,
        },
    };
}
// Helper functions
async function getTodayXPInternal(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db.points_ledger.aggregate({
        where: {
            user_id: userId,
            awarded_at: { gte: today },
        },
        _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
}
async function getRemainingXPToday(userId) {
    const todayProgress = await getTodayProgress(userId);
    const remainingTasks = todayProgress.tasks.filter(t => !t.completed).length;
    return remainingTasks * 10; // 10 XP per task
}
async function getNextBadgeInfo(userId) {
    const earnedBadges = await db.user_badges.findMany({
        where: { user_id: userId },
        select: { badge_id: true },
    });
    const earnedBadgeIds = earnedBadges.map(b => b.badge_id);
    const availableRules = await db.badge_rules.findMany({
        where: {
            is_active: true,
            badge_id: { notIn: earnedBadgeIds },
        },
        include: { badge_definitions: true },
        orderBy: { threshold: "asc" },
    });
    if (availableRules.length === 0)
        return null;
    const streak = await db.streaks.findFirst({
        where: { user_id: userId, kind: "task_completion" },
    });
    const currentStreak = streak?.current_length ?? 0;
    for (const rule of availableRules) {
        if (rule.rule_type === "streak_days") {
            const daysLeft = rule.threshold - currentStreak;
            if (daysLeft > 0) {
                return {
                    name: rule.badge_definitions.name,
                    days_left: daysLeft,
                };
            }
        }
    }
    return {
        name: availableRules[0]?.badge_definitions.name ?? "Unknown",
        days_left: availableRules[0]?.threshold ?? 0,
    };
}
function calculateLevelFromXP(totalXP) {
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
//# sourceMappingURL=progress.service.js.map