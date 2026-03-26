import { db } from "../lib/services.js";
/**
 * Get all habits for a user
 */
export async function getUserHabits(userId) {
    return db.user_habits.findMany({
        where: { user_id: userId },
        include: {
            habit_templates: true,
            user_habit_triggers: {
                include: {
                    triggers: true,
                },
            },
        },
        orderBy: { created_at: "desc" },
    });
}
/**
 * Get a single habit by ID
 */
export async function getHabitById(userId, habitId) {
    return db.user_habits.findFirst({
        where: {
            id: habitId,
            user_id: userId,
        },
        include: {
            habit_templates: true,
            user_habit_triggers: {
                include: {
                    triggers: true,
                },
            },
            journeys: {
                select: {
                    id: true,
                    status: true,
                    start_date: true,
                    planned_days: true,
                },
            },
        },
    });
}
/**
 * Create a new habit
 */
export async function createHabit(userId, data) {
    return db.user_habits.create({
        data: {
            user_id: userId,
            goal_text: data.goal_text,
            template_id: data.template_id ?? null,
            started_at: data.started_at ?? null,
            status: "active",
        },
        include: {
            habit_templates: true,
        },
    });
}
/**
 * Update a habit
 */
export async function updateHabit(userId, habitId, data) {
    // First verify ownership
    const habit = await db.user_habits.findFirst({
        where: {
            id: habitId,
            user_id: userId,
        },
    });
    if (!habit) {
        return null;
    }
    return db.user_habits.update({
        where: { id: habitId },
        data: {
            ...(data.goal_text && { goal_text: data.goal_text }),
            ...(data.status && { status: data.status }),
            ...(data.started_at && { started_at: data.started_at }),
        },
        include: {
            habit_templates: true,
        },
    });
}
/**
 * Delete a habit
 */
export async function deleteHabit(userId, habitId) {
    // First verify ownership
    const habit = await db.user_habits.findFirst({
        where: {
            id: habitId,
            user_id: userId,
        },
    });
    if (!habit) {
        return false;
    }
    await db.user_habits.delete({
        where: { id: habitId },
    });
    return true;
}
/**
 * Get triggers for a habit
 */
export async function getHabitTriggers(userId, habitId) {
    const habit = await db.user_habits.findFirst({
        where: {
            id: habitId,
            user_id: userId,
        },
        include: {
            user_habit_triggers: {
                include: {
                    triggers: true,
                },
            },
        },
    });
    if (!habit) {
        return null;
    }
    return habit.user_habit_triggers.map((uht) => uht.triggers);
}
/**
 * Add a trigger to a habit
 */
export async function addTriggerToHabit(userId, habitId, triggerId) {
    // Verify habit ownership
    const habit = await db.user_habits.findFirst({
        where: {
            id: habitId,
            user_id: userId,
        },
    });
    if (!habit) {
        return null;
    }
    // Verify trigger exists
    const trigger = await db.triggers.findUnique({
        where: { id: triggerId },
    });
    if (!trigger) {
        return null;
    }
    // Create the link (upsert to avoid duplicates)
    const result = await db.user_habit_triggers.upsert({
        where: {
            user_habit_id_trigger_id: {
                user_habit_id: habitId,
                trigger_id: triggerId,
            },
        },
        create: {
            user_habit_id: habitId,
            trigger_id: triggerId,
        },
        update: {},
        include: {
            triggers: true,
        },
    });
    return result.triggers;
}
/**
 * Remove a trigger from a habit
 */
export async function removeTriggerFromHabit(userId, habitId, triggerId) {
    // Verify habit ownership
    const habit = await db.user_habits.findFirst({
        where: {
            id: habitId,
            user_id: userId,
        },
    });
    if (!habit) {
        return false;
    }
    try {
        await db.user_habit_triggers.delete({
            where: {
                user_habit_id_trigger_id: {
                    user_habit_id: habitId,
                    trigger_id: triggerId,
                },
            },
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get all available triggers
 */
export async function getAllTriggers() {
    return db.triggers.findMany({
        orderBy: { name: "asc" },
    });
}
//# sourceMappingURL=habits.service.js.map