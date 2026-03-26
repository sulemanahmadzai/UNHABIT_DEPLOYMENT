import { Prisma } from "@prisma/client";
interface ReflectionData {
    journey_day_id: string;
    content?: string | null;
    answers?: Record<string, string | number | boolean> | null;
}
interface SlipData {
    user_habit_id?: string | null;
    happened_at: Date;
    context?: Record<string, unknown> | null;
}
/**
 * Mark a task as completed
 */
export declare function completeTask(userId: string, taskId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    status: string;
    journey_task_id: string;
    completed_at: Date | null;
} | null>;
/**
 * Mark a task as not completed (undo)
 */
export declare function uncompleteTask(userId: string, taskId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    status: string;
    journey_task_id: string;
    completed_at: Date | null;
} | null>;
/**
 * Get user's task progress
 */
export declare function getUserTaskProgress(userId: string, journeyId?: string): Promise<({
    journey_tasks: {
        journey_days: {
            day_number: number;
            journey_id: string;
        };
    } & {
        id: string;
        title: string;
        kind: string | null;
        effort: number | null;
        meta: Prisma.JsonValue | null;
        journey_day_id: string;
    };
} & {
    user_id: string;
    created_at: Date;
    id: string;
    status: string;
    journey_task_id: string;
    completed_at: Date | null;
})[]>;
/**
 * Get journey progress summary
 */
export declare function getJourneyProgressSummary(userId: string, journeyId: string): Promise<{
    journey_id: string;
    status: import("@prisma/client").$Enums.journey_status;
    total_days: number;
    total_tasks: number;
    completed_tasks: number;
    completion_rate: number;
    days_with_reflection: number;
    reflection_rate: number;
    latest_adherence_score: Prisma.Decimal | null;
    days: {
        day_number: number;
        theme: string | null;
        tasks_total: number;
        tasks_completed: number;
        has_reflection: boolean;
    }[];
} | null>;
/**
 * Submit a daily reflection
 */
export declare function submitReflection(userId: string, data: ReflectionData): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    journey_day_id: string;
    content: string | null;
    answers: Prisma.JsonValue | null;
}>;
/**
 * Get reflection for a day
 */
export declare function getReflection(userId: string, journeyDayId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    journey_day_id: string;
    content: string | null;
    answers: Prisma.JsonValue | null;
} | null>;
/**
 * Report a slip event
 */
export declare function reportSlip(userId: string, data: SlipData): Promise<{
    user_id: string;
    id: string;
    user_habit_id: string | null;
    happened_at: Date;
    context: Prisma.JsonValue | null;
}>;
/**
 * Get slip history
 */
export declare function getSlipHistory(userId: string, limit: number, offset: number): Promise<({
    user_habits: {
        id: string;
        goal_text: string;
    } | null;
} & {
    user_id: string;
    id: string;
    user_habit_id: string | null;
    happened_at: Date;
    context: Prisma.JsonValue | null;
})[]>;
/**
 * Get today's progress (tasks for the current journey day)
 */
export declare function getTodayProgress(userId: string): Promise<{
    has_active_journey: boolean;
    tasks: never[];
    tasks_completed: number;
    tasks_total: number;
    journey_id?: never;
    day_number?: never;
    day_id?: never;
    total_days?: never;
    theme?: never;
    habit_goal?: never;
    all_completed?: never;
} | {
    has_active_journey: boolean;
    journey_id: string;
    day_number: number;
    tasks: never[];
    tasks_completed: number;
    tasks_total: number;
    day_id?: never;
    total_days?: never;
    theme?: never;
    habit_goal?: never;
    all_completed?: never;
} | {
    has_active_journey: boolean;
    journey_id: string;
    day_id: string;
    day_number: number;
    total_days: number;
    theme: string | null;
    habit_goal: string | undefined;
    tasks: {
        id: string;
        title: string;
        kind: string | null;
        effort: number | null;
        completed: boolean;
        completed_at: Date | null | undefined;
        xp: number;
    }[];
    tasks_completed: number;
    tasks_total: number;
    all_completed: boolean;
}>;
/**
 * Complete all tasks for today
 */
export declare function completeDayTasks(userId: string): Promise<{
    completed: number;
    already_completed: number;
    total?: never;
} | {
    completed: number;
    already_completed: number;
    total: number;
}>;
/**
 * Get progress snapshot (XP, streak, habit health, next badge)
 */
export declare function getProgressSnapshot(userId: string): Promise<{
    xp: {
        total: number;
        today: number;
        if_completed_today: number;
    };
    streak: {
        current: number;
        impact: string;
    };
    habit_health: {
        current: number;
        change: string;
    };
    level: {
        current: number;
        progress: number;
    };
    badges: {
        earned: number;
        next: {
            name: string;
            days_left: number;
        } | null;
    };
}>;
export {};
//# sourceMappingURL=progress.service.d.ts.map