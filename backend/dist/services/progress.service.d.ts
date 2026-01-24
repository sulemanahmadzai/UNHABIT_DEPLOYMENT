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
export {};
//# sourceMappingURL=progress.service.d.ts.map