/**
 * Get detailed streak information including calendar
 */
export declare function getStreakDetails(userId: string): Promise<{
    current_streak: number;
    longest_streak: number;
    last_activity_date: Date | null | undefined;
    is_frozen: boolean;
    freeze_tokens: {
        available: number;
        used_this_week: number;
        max_per_week: number;
    };
    calendar: {
        date: string;
        day_of_week: number;
        status: "completed" | "missed" | "frozen" | "today" | "future";
    }[];
    streak_rules: {
        keep_alive: string;
        break_chain: string;
        freeze_protection: string;
    };
}>;
/**
 * Use a streak freeze to protect streak
 */
export declare function useStreakFreeze(userId: string): Promise<{
    success: boolean;
    error: string;
    remaining_freezes?: never;
    message?: never;
} | {
    success: boolean;
    remaining_freezes: number;
    message: string;
    error?: never;
}>;
/**
 * Purchase streak freeze with XP
 */
export declare function purchaseStreakFreeze(userId: string): Promise<{
    success: boolean;
    error: string;
    xp_spent?: never;
    available_freezes?: never;
    message?: never;
} | {
    success: boolean;
    xp_spent: number;
    available_freezes: number;
    message: string;
    error?: never;
}>;
/**
 * Get streak at risk status
 */
export declare function getStreakAtRiskStatus(userId: string): Promise<{
    at_risk: boolean;
    current_streak: number;
    message: string;
    hours_left?: never;
    minutes_left?: never;
    time_remaining?: never;
} | {
    at_risk: boolean;
    current_streak: number;
    hours_left: number;
    minutes_left: number;
    time_remaining: string;
    message: string;
}>;
/**
 * Get habit health score
 */
export declare function getHabitHealth(userId: string): Promise<{
    has_active_journey: boolean;
    health_score: number;
    message: string;
    journey_id?: never;
    habit_goal?: never;
    status?: never;
    tasks_completed?: never;
    tasks_total?: never;
} | {
    has_active_journey: boolean;
    journey_id: string;
    habit_goal: string | undefined;
    health_score: number;
    status: "excellent" | "good" | "fair" | "needs_attention";
    tasks_completed: number;
    tasks_total: number;
    message: string;
}>;
/**
 * Calculate available freezes based on XP and consistency
 * Formula: base_freezes + floor(total_xp / 1000) + streak_bonus
 */
export declare function calculateAvailableFreezes(userId: string): Promise<number>;
//# sourceMappingURL=streaks.service.d.ts.map