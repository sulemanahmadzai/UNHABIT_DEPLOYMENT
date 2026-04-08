interface CreateHabitData {
    goal_text: string;
    template_id?: string | null;
    started_at?: Date | null;
}
interface UpdateHabitData {
    goal_text?: string | undefined;
    status?: string | undefined;
    started_at?: Date | undefined;
}
/**
 * Get all habits for a user
 */
export declare function getUserHabits(userId: string): Promise<({
    user_habit_triggers: ({
        triggers: {
            name: string;
            id: string;
            description: string | null;
        };
    } & {
        user_habit_id: string;
        trigger_id: string;
    })[];
    habit_templates: {
        id: string;
        category_id: string | null;
        slug: string | null;
        title: string;
        description: string | null;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    status: string;
    template_id: string | null;
    goal_text: string;
    started_at: Date | null;
})[]>;
/**
 * Get a single habit by ID
 */
export declare function getHabitById(userId: string, habitId: string): Promise<({
    journeys: {
        id: string;
        status: import("@prisma/client").$Enums.journey_status;
        start_date: Date | null;
        planned_days: number;
    }[];
    user_habit_triggers: ({
        triggers: {
            name: string;
            id: string;
            description: string | null;
        };
    } & {
        user_habit_id: string;
        trigger_id: string;
    })[];
    habit_templates: {
        id: string;
        category_id: string | null;
        slug: string | null;
        title: string;
        description: string | null;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    status: string;
    template_id: string | null;
    goal_text: string;
    started_at: Date | null;
}) | null>;
/**
 * Create a new habit
 */
export declare function createHabit(userId: string, data: CreateHabitData): Promise<{
    habit_templates: {
        id: string;
        category_id: string | null;
        slug: string | null;
        title: string;
        description: string | null;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    status: string;
    template_id: string | null;
    goal_text: string;
    started_at: Date | null;
}>;
/**
 * Update a habit
 */
export declare function updateHabit(userId: string, habitId: string, data: UpdateHabitData): Promise<({
    habit_templates: {
        id: string;
        category_id: string | null;
        slug: string | null;
        title: string;
        description: string | null;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    status: string;
    template_id: string | null;
    goal_text: string;
    started_at: Date | null;
}) | null>;
/**
 * Delete a habit
 */
export declare function deleteHabit(userId: string, habitId: string): Promise<boolean>;
/**
 * Get triggers for a habit
 */
export declare function getHabitTriggers(userId: string, habitId: string): Promise<{
    name: string;
    id: string;
    description: string | null;
}[] | null>;
/**
 * Add a trigger to a habit
 */
export declare function addTriggerToHabit(userId: string, habitId: string, triggerId: string): Promise<{
    name: string;
    id: string;
    description: string | null;
} | null>;
/**
 * Remove a trigger from a habit
 */
export declare function removeTriggerFromHabit(userId: string, habitId: string, triggerId: string): Promise<boolean>;
/**
 * Get all available triggers
 */
export declare function getAllTriggers(): Promise<{
    name: string;
    id: string;
    description: string | null;
}[]>;
export {};
//# sourceMappingURL=habits.service.d.ts.map