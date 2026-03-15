import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";
/**
 * Get all journeys for a user
 */
export async function getUserJourneys(userId, status) {
    return db.journeys.findMany({
        where: {
            user_id: userId,
            ...(status && { status: status }),
        },
        include: {
            user_habits: {
                select: {
                    id: true,
                    goal_text: true,
                },
            },
            journey_blueprints: {
                select: {
                    id: true,
                    code: true,
                    title: true,
                },
            },
            _count: {
                select: {
                    journey_days: true,
                },
            },
        },
        orderBy: { created_at: "desc" },
    });
}
/**
 * Get a journey by ID with all details
 */
export async function getJourneyById(userId, journeyId) {
    return db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
        },
        include: {
            user_habits: true,
            journey_blueprints: true,
            journey_days: {
                include: {
                    journey_tasks: true,
                },
                orderBy: { day_number: "asc" },
            },
            adherence_scores: {
                orderBy: { day_number: "asc" },
            },
        },
    });
}
/**
 * Create a new journey with days and tasks
 */
export async function createJourney(userId, data) {
    // Verify habit ownership
    const habit = await db.user_habits.findFirst({
        where: {
            id: data.user_habit_id,
            user_id: userId,
        },
    });
    if (!habit) {
        throw new Error("Habit not found");
    }
    // Create journey with nested days and tasks
    return db.journeys.create({
        data: {
            user_id: userId,
            user_habit_id: data.user_habit_id,
            blueprint_id: data.blueprint_id ?? null,
            start_date: data.start_date ?? null,
            planned_days: data.plan_data.days.length,
            status: data.start_date ? "active" : "planned",
            type: data.blueprint_id ? "blueprint" : "custom",
            journey_days: {
                create: data.plan_data.days.map((day) => ({
                    day_number: day.day_number,
                    theme: day.theme ?? null,
                    prompts: day.prompts || [],
                    journey_tasks: {
                        create: day.tasks.map((task) => ({
                            title: task.title,
                            kind: task.kind ?? null,
                            effort: task.effort ?? null,
                            meta: task.meta ? task.meta : Prisma.JsonNull,
                        })),
                    },
                })),
            },
        },
        include: {
            journey_days: {
                include: {
                    journey_tasks: true,
                },
                orderBy: { day_number: "asc" },
            },
        },
    });
}
/**
 * Update a journey
 */
export async function updateJourney(userId, journeyId, data) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
        },
    });
    if (!journey) {
        return null;
    }
    return db.journeys.update({
        where: { id: journeyId },
        data: {
            ...(data.status && { status: data.status }),
            ...(data.start_date && { start_date: data.start_date }),
        },
        include: {
            journey_days: {
                include: {
                    journey_tasks: true,
                },
                orderBy: { day_number: "asc" },
            },
        },
    });
}
/**
 * Get all days for a journey
 */
export async function getJourneyDays(userId, journeyId) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
        },
    });
    if (!journey) {
        return null;
    }
    return db.journey_days.findMany({
        where: { journey_id: journeyId },
        include: {
            journey_tasks: true,
            reflections: {
                where: { user_id: userId },
            },
        },
        orderBy: { day_number: "asc" },
    });
}
/**
 * Get a specific day with tasks
 */
export async function getJourneyDay(userId, journeyId, dayNumber) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
        },
    });
    if (!journey) {
        return null;
    }
    const day = await db.journey_days.findFirst({
        where: {
            journey_id: journeyId,
            day_number: dayNumber,
        },
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
    });
    return day;
}
/**
 * Start a journey
 */
export async function startJourney(userId, journeyId) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
        },
    });
    if (!journey) {
        return null;
    }
    return db.journeys.update({
        where: { id: journeyId },
        data: {
            status: "active",
            start_date: new Date(),
        },
    });
}
/**
 * Pause a journey
 */
export async function pauseJourney(userId, journeyId) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
            status: "active",
        },
    });
    if (!journey) {
        return null;
    }
    return db.journeys.update({
        where: { id: journeyId },
        data: { status: "paused" },
    });
}
/**
 * Resume a journey
 */
export async function resumeJourney(userId, journeyId) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
            status: "paused",
        },
    });
    if (!journey) {
        return null;
    }
    return db.journeys.update({
        where: { id: journeyId },
        data: { status: "active" },
    });
}
/**
 * Get active journey for a user
 */
export async function getActiveJourney(userId) {
    return db.journeys.findFirst({
        where: {
            user_id: userId,
            status: "active",
        },
        include: {
            user_habits: true,
            journey_blueprints: true,
            _count: {
                select: { journey_days: true },
            },
        },
        orderBy: { created_at: "desc" },
    });
}
/**
 * Get today's journey day with tasks and progress
 */
export async function getTodayJourneyDay(userId, journeyId) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
            status: "active",
        },
    });
    if (!journey || !journey.start_date) {
        return null;
    }
    // Calculate current day number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(journey.start_date);
    startDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const currentDayNumber = Math.min(Math.max(diffDays + 1, 1), journey.planned_days);
    const journeyDay = await db.journey_days.findFirst({
        where: {
            journey_id: journeyId,
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
            reflections: {
                where: { user_id: userId },
            },
        },
    });
    if (!journeyDay) {
        return null;
    }
    // Format tasks with completion status
    const tasks = journeyDay.journey_tasks.map(task => {
        const meta = task.meta;
        return {
            id: task.id,
            title: task.title,
            kind: task.kind,
            effort: task.effort,
            description: meta?.description ?? null,
            meta,
            completed: task.user_task_progress.some(p => p.status === "completed"),
            completed_at: task.user_task_progress.find(p => p.status === "completed")?.completed_at,
        };
    });
    const completedCount = tasks.filter(t => t.completed).length;
    return {
        journey_id: journeyId,
        day_id: journeyDay.id,
        day_number: currentDayNumber,
        total_days: journey.planned_days,
        theme: journeyDay.theme,
        prompts: journeyDay.prompts,
        tasks,
        tasks_completed: completedCount,
        tasks_total: tasks.length,
        all_completed: completedCount === tasks.length,
        reflection: journeyDay.reflections[0] ?? null,
        habit_goal: journey.user_habit_id ? (await db.user_habits.findUnique({ where: { id: journey.user_habit_id } }))?.goal_text : null,
    };
}
/**
 * Restart a journey (reset to day 1)
 */
export async function restartJourney(userId, journeyId) {
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
        },
    });
    if (!journey) {
        return null;
    }
    // Reset all task progress for this journey
    const journeyDays = await db.journey_days.findMany({
        where: { journey_id: journeyId },
        select: { id: true },
    });
    const dayIds = journeyDays.map(d => d.id);
    const tasks = await db.journey_tasks.findMany({
        where: { journey_day_id: { in: dayIds } },
        select: { id: true },
    });
    const taskIds = tasks.map(t => t.id);
    // Delete all task progress
    await db.user_task_progress.deleteMany({
        where: {
            user_id: userId,
            journey_task_id: { in: taskIds },
        },
    });
    // Delete all reflections
    await db.reflections.deleteMany({
        where: {
            user_id: userId,
            journey_day_id: { in: dayIds },
        },
    });
    // Reset journey to active with new start date
    return db.journeys.update({
        where: { id: journeyId },
        data: {
            status: "active",
            start_date: new Date(),
        },
        include: {
            user_habits: true,
            journey_days: {
                include: { journey_tasks: true },
                orderBy: { day_number: "asc" },
            },
        },
    });
}
/**
 * Get journey calendar data
 */
export async function getJourneyCalendar(userId, journeyId) {
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
                },
                orderBy: { day_number: "asc" },
            },
        },
    });
    if (!journey) {
        return null;
    }
    // Build calendar data
    const calendarDays = journey.journey_days.map(day => {
        const totalTasks = day.journey_tasks.length;
        const completedTasks = day.journey_tasks.filter(t => t.user_task_progress.some(p => p.status === "completed")).length;
        let status = "upcoming";
        if (journey.start_date) {
            const startDate = new Date(journey.start_date);
            startDate.setHours(0, 0, 0, 0);
            const dayDate = new Date(startDate);
            dayDate.setDate(dayDate.getDate() + day.day_number - 1);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dayDate.getTime() === today.getTime()) {
                status = completedTasks === totalTasks ? "completed" : "today";
            }
            else if (dayDate < today) {
                if (completedTasks === totalTasks) {
                    status = "completed";
                }
                else if (completedTasks > 0) {
                    status = "partial";
                }
                else {
                    status = "missed";
                }
            }
        }
        return {
            day_number: day.day_number,
            date: journey.start_date
                ? new Date(new Date(journey.start_date).getTime() + (day.day_number - 1) * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                : null,
            theme: day.theme,
            tasks_total: totalTasks,
            tasks_completed: completedTasks,
            status,
        };
    });
    return {
        journey_id: journeyId,
        start_date: journey.start_date,
        planned_days: journey.planned_days,
        status: journey.status,
        days: calendarDays,
    };
}
//# sourceMappingURL=journeys.service.js.map