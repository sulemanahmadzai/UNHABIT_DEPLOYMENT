import { Prisma } from "@prisma/client";
interface PlanData {
    days: Array<{
        day_number: number;
        theme?: string | null;
        tasks: Array<{
            title: string;
            kind?: string | null;
            effort?: number | null;
            meta?: Record<string, unknown> | null;
        }>;
        prompts?: string[] | null;
    }>;
}
interface CreateJourneyData {
    user_habit_id: string;
    blueprint_id?: string | null | undefined;
    plan_data: PlanData;
    start_date?: Date | null | undefined;
}
interface UpdateJourneyData {
    status?: string | undefined;
    start_date?: Date | undefined;
}
/**
 * Get all journeys for a user
 */
export declare function getUserJourneys(userId: string, status?: string): Promise<({
    user_habits: {
        id: string;
        goal_text: string;
    } | null;
    _count: {
        journey_days: number;
    };
    journey_blueprints: {
        id: string;
        title: string;
        code: string;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
})[]>;
/**
 * Get a journey by ID with all details
 */
export declare function getJourneyById(userId: string, journeyId: string): Promise<({
    user_habits: {
        user_id: string;
        created_at: Date;
        id: string;
        template_id: string | null;
        goal_text: string;
        started_at: Date | null;
        status: string;
    } | null;
    adherence_scores: {
        id: string;
        day_number: number;
        journey_id: string;
        score: Prisma.Decimal;
        computed_at: Date;
    }[];
    journey_days: ({
        journey_tasks: {
            id: string;
            title: string;
            kind: string | null;
            effort: number | null;
            meta: Prisma.JsonValue | null;
            journey_day_id: string;
        }[];
    } & {
        id: string;
        day_number: number;
        journey_id: string;
        theme: string | null;
        prompts: Prisma.JsonValue | null;
    })[];
    journey_blueprints: {
        id: string;
        title: string;
        description: string | null;
        code: string;
        days: Prisma.JsonValue | null;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
}) | null>;
/**
 * Create a new journey with days and tasks
 */
export declare function createJourney(userId: string, data: CreateJourneyData): Promise<{
    journey_days: ({
        journey_tasks: {
            id: string;
            title: string;
            kind: string | null;
            effort: number | null;
            meta: Prisma.JsonValue | null;
            journey_day_id: string;
        }[];
    } & {
        id: string;
        day_number: number;
        journey_id: string;
        theme: string | null;
        prompts: Prisma.JsonValue | null;
    })[];
} & {
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
}>;
/**
 * Update a journey
 */
export declare function updateJourney(userId: string, journeyId: string, data: UpdateJourneyData): Promise<({
    journey_days: ({
        journey_tasks: {
            id: string;
            title: string;
            kind: string | null;
            effort: number | null;
            meta: Prisma.JsonValue | null;
            journey_day_id: string;
        }[];
    } & {
        id: string;
        day_number: number;
        journey_id: string;
        theme: string | null;
        prompts: Prisma.JsonValue | null;
    })[];
} & {
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
}) | null>;
/**
 * Get all days for a journey
 */
export declare function getJourneyDays(userId: string, journeyId: string): Promise<({
    journey_tasks: {
        id: string;
        title: string;
        kind: string | null;
        effort: number | null;
        meta: Prisma.JsonValue | null;
        journey_day_id: string;
    }[];
    reflections: {
        user_id: string;
        created_at: Date;
        id: string;
        journey_day_id: string;
        content: string | null;
        answers: Prisma.JsonValue | null;
    }[];
} & {
    id: string;
    day_number: number;
    journey_id: string;
    theme: string | null;
    prompts: Prisma.JsonValue | null;
})[] | null>;
/**
 * Get a specific day with tasks
 */
export declare function getJourneyDay(userId: string, journeyId: string, dayNumber: number): Promise<({
    journey_tasks: ({
        user_task_progress: {
            user_id: string;
            created_at: Date;
            id: string;
            status: string;
            journey_task_id: string;
            completed_at: Date | null;
        }[];
    } & {
        id: string;
        title: string;
        kind: string | null;
        effort: number | null;
        meta: Prisma.JsonValue | null;
        journey_day_id: string;
    })[];
    reflections: {
        user_id: string;
        created_at: Date;
        id: string;
        journey_day_id: string;
        content: string | null;
        answers: Prisma.JsonValue | null;
    }[];
} & {
    id: string;
    day_number: number;
    journey_id: string;
    theme: string | null;
    prompts: Prisma.JsonValue | null;
}) | null>;
/**
 * Start a journey
 */
export declare function startJourney(userId: string, journeyId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
} | null>;
/**
 * Pause a journey
 */
export declare function pauseJourney(userId: string, journeyId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
} | null>;
/**
 * Resume a journey
 */
export declare function resumeJourney(userId: string, journeyId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
} | null>;
/**
 * Get active journey for a user
 */
export declare function getActiveJourney(userId: string): Promise<({
    user_habits: {
        user_id: string;
        created_at: Date;
        id: string;
        template_id: string | null;
        goal_text: string;
        started_at: Date | null;
        status: string;
    } | null;
    _count: {
        journey_days: number;
    };
    journey_blueprints: {
        id: string;
        title: string;
        description: string | null;
        code: string;
        days: Prisma.JsonValue | null;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
}) | null>;
/**
 * Get today's journey day with tasks and progress
 */
export declare function getTodayJourneyDay(userId: string, journeyId: string): Promise<{
    journey_id: string;
    day_id: string;
    day_number: number;
    total_days: number;
    theme: string | null;
    prompts: Prisma.JsonValue;
    tasks: {
        id: string;
        title: string;
        kind: string | null;
        effort: number | null;
        meta: Prisma.JsonValue;
        completed: boolean;
        completed_at: Date | null | undefined;
    }[];
    tasks_completed: number;
    tasks_total: number;
    all_completed: boolean;
    reflection: {
        user_id: string;
        created_at: Date;
        id: string;
        journey_day_id: string;
        content: string | null;
        answers: Prisma.JsonValue | null;
    } | null;
    habit_goal: string | null | undefined;
} | null>;
/**
 * Restart a journey (reset to day 1)
 */
export declare function restartJourney(userId: string, journeyId: string): Promise<({
    user_habits: {
        user_id: string;
        created_at: Date;
        id: string;
        template_id: string | null;
        goal_text: string;
        started_at: Date | null;
        status: string;
    } | null;
    journey_days: ({
        journey_tasks: {
            id: string;
            title: string;
            kind: string | null;
            effort: number | null;
            meta: Prisma.JsonValue | null;
            journey_day_id: string;
        }[];
    } & {
        id: string;
        day_number: number;
        journey_id: string;
        theme: string | null;
        prompts: Prisma.JsonValue | null;
    })[];
} & {
    user_id: string;
    created_at: Date;
    id: string;
    type: import("@prisma/client").$Enums.journey_type;
    status: import("@prisma/client").$Enums.journey_status;
    user_habit_id: string | null;
    blueprint_id: string | null;
    start_date: Date | null;
    planned_days: number;
}) | null>;
/**
 * Get journey calendar data
 */
export declare function getJourneyCalendar(userId: string, journeyId: string): Promise<{
    journey_id: string;
    start_date: Date | null;
    planned_days: number;
    status: import("@prisma/client").$Enums.journey_status;
    days: {
        day_number: number;
        date: string | null | undefined;
        theme: string | null;
        tasks_total: number;
        tasks_completed: number;
        status: "completed" | "partial" | "missed" | "upcoming" | "today";
    }[];
} | null>;
export {};
//# sourceMappingURL=journeys.service.d.ts.map