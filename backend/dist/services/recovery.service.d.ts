/**
 * Check if user missed a day and needs to recover
 */
export declare function checkMissedDay(userId: string): Promise<{
    missed: boolean;
    needs_recovery: boolean;
    message: string;
    current_streak?: never;
    days_missed?: never;
    freeze_tokens_available?: never;
    options?: never;
} | {
    missed: boolean;
    needs_recovery: boolean;
    current_streak: number;
    message?: never;
    days_missed?: never;
    freeze_tokens_available?: never;
    options?: never;
} | {
    missed: boolean;
    needs_recovery: boolean;
    current_streak: number;
    days_missed: number;
    freeze_tokens_available: number;
    options: ({
        id: string;
        title: string;
        description: string;
        consequences: {
            streak_reset: boolean;
            xp_penalty: boolean;
            uses_freeze?: never;
            journey_restart?: never;
            xp_kept?: never;
        };
        available?: never;
    } | {
        id: string;
        title: string;
        description: string;
        available: boolean;
        consequences: {
            streak_reset: boolean;
            uses_freeze: boolean;
            xp_penalty?: never;
            journey_restart?: never;
            xp_kept?: never;
        };
    } | {
        id: string;
        title: string;
        description: string;
        consequences: {
            streak_reset: boolean;
            journey_restart: boolean;
            xp_kept: boolean;
            xp_penalty?: never;
            uses_freeze?: never;
        };
        available?: never;
    })[];
    message?: never;
}>;
/**
 * Continue with penalty - reset streak and reduce XP
 */
export declare function continueWithPenalty(userId: string): Promise<{
    success: boolean;
    action: string;
    streak_reset: boolean;
    xp_deducted: number;
    penalty_percent: number;
    remaining_xp: number;
    message: string;
}>;
/**
 * Use streak protection (freeze token)
 */
export declare function useProtection(userId: string): Promise<{
    success: boolean;
    error: string;
    action?: never;
    streak_saved?: never;
    current_streak?: never;
    remaining_freezes?: never;
    message?: never;
} | {
    success: boolean;
    action: string;
    streak_saved: boolean;
    current_streak: number;
    remaining_freezes: number;
    message: string;
    error?: never;
}>;
/**
 * Restart 21-Day Plan (keep XP, reset journey)
 */
export declare function restartPlan(userId: string): Promise<{
    success: boolean;
    error: string;
    action?: never;
    journey_id?: never;
    streak_reset?: never;
    xp_kept?: never;
    message?: never;
} | {
    success: boolean;
    action: string;
    journey_id: string;
    streak_reset: boolean;
    xp_kept: number;
    message: string;
    error?: never;
}>;
//# sourceMappingURL=recovery.service.d.ts.map