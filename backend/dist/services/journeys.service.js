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
//# sourceMappingURL=journeys.service.js.map