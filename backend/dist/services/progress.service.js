import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";
/**
 * Mark a task as completed
 */
export async function completeTask(userId, taskId) {
    // Verify task exists and user owns the journey
    const task = await db.journey_tasks.findFirst({
        where: { id: taskId },
        include: {
            journey_days: {
                include: {
                    journeys: true,
                },
            },
        },
    });
    if (!task || task.journey_days.journeys.user_id !== userId) {
        return null;
    }
    // Create or update task progress
    return db.user_task_progress.upsert({
        where: {
            user_id_journey_task_id: {
                user_id: userId,
                journey_task_id: taskId,
            },
        },
        create: {
            user_id: userId,
            journey_task_id: taskId,
            status: "completed",
            completed_at: new Date(),
        },
        update: {
            status: "completed",
            completed_at: new Date(),
        },
    });
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
    return db.reflections.upsert({
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
//# sourceMappingURL=progress.service.js.map