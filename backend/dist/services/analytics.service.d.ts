/**
 * Get all streaks for a user
 */
export declare function getStreaks(userId: string): Promise<{
    daily_login: {
        user_id: string;
        kind: import("@prisma/client").$Enums.streak_kind;
        current_length: number;
        best_length: number;
        last_event_date: Date | null;
        is_frozen: boolean;
    } | {
        current_length: number;
        best_length: number;
        is_frozen: false;
    };
    task_completion: {
        user_id: string;
        kind: import("@prisma/client").$Enums.streak_kind;
        current_length: number;
        best_length: number;
        last_event_date: Date | null;
        is_frozen: boolean;
    } | {
        current_length: number;
        best_length: number;
        is_frozen: false;
    };
    no_slip: {
        user_id: string;
        kind: import("@prisma/client").$Enums.streak_kind;
        current_length: number;
        best_length: number;
        last_event_date: Date | null;
        is_frozen: boolean;
    } | {
        current_length: number;
        best_length: number;
        is_frozen: false;
    };
}>;
/**
 * Get identity score history
 */
export declare function getIdentityScoreHistory(userId: string, days: number): Promise<{
    user_id: string;
    score: import("@prisma/client/runtime/library").Decimal;
    recorded_at: Date;
    inputs: import("@prisma/client/runtime/library").JsonValue | null;
}[]>;
/**
 * Get consistency index
 */
export declare function getConsistencyIndex(userId: string, timeWindow: string): Promise<{
    time_window: string;
    current: number;
    average: number;
    history: {
        user_id: string;
        value: import("@prisma/client/runtime/library").Decimal;
        recorded_at: Date;
        time_window: string;
    }[];
}>;
/**
 * Get adherence scores for a journey
 */
export declare function getAdherenceScores(userId: string, journeyId: string): Promise<{
    id: string;
    day_number: number;
    journey_id: string;
    score: import("@prisma/client/runtime/library").Decimal;
    computed_at: Date;
}[] | null>;
/**
 * Get personalized insights
 */
export declare function getInsights(userId: string, limit: number): Promise<{
    user_id: string;
    id: string;
    title: string;
    source: string;
    body: string | null;
    valid_from: Date | null;
    valid_to: Date | null;
}[]>;
/**
 * Get trigger heatmap data
 */
export declare function getTriggerHeatmap(userId: string, days: number): Promise<{
    period_days: number;
    total_slips: number;
    heatmap: Record<string, Record<string, number>>;
}>;
/**
 * Get daily metrics
 */
export declare function getDailyMetrics(userId: string, days: number): Promise<{
    user_id: string;
    day: Date;
    metrics: import("@prisma/client/runtime/library").JsonValue;
}[]>;
/**
 * Export user data
 */
export declare function exportUserData(userId: string, format: "json" | "csv"): Promise<unknown>;
//# sourceMappingURL=analytics.service.d.ts.map