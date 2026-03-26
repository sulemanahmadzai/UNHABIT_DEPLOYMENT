/**
 * Start a focus session
 */
export declare function startSession(userId: string, data: {
    duration_mins: number;
    journey_day_id?: string | undefined;
}): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    started_at: Date;
    completed: boolean;
    journey_day_id: string | null;
    duration_mins: number;
    ended_at: Date | null;
    xp_awarded: number;
}>;
/**
 * Stop/complete a focus session
 */
export declare function stopSession(userId: string, sessionId: string): Promise<{
    session: {
        user_id: string;
        created_at: Date;
        id: string;
        started_at: Date;
        completed: boolean;
        journey_day_id: string | null;
        duration_mins: number;
        ended_at: Date | null;
        xp_awarded: number;
    };
    already_completed: boolean;
    actual_duration_mins?: never;
    xp_earned?: never;
} | {
    session: {
        user_id: string;
        created_at: Date;
        id: string;
        started_at: Date;
        completed: boolean;
        journey_day_id: string | null;
        duration_mins: number;
        ended_at: Date | null;
        xp_awarded: number;
    };
    actual_duration_mins: number;
    xp_earned: number;
    already_completed: boolean;
} | null>;
/**
 * Cancel an active focus session (no XP awarded, session row is deleted)
 */
export declare function cancelSession(userId: string, sessionId: string): Promise<{
    session: {
        user_id: string;
        created_at: Date;
        id: string;
        started_at: Date;
        completed: boolean;
        journey_day_id: string | null;
        duration_mins: number;
        ended_at: Date | null;
        xp_awarded: number;
    };
    already_completed: boolean;
    cancelled?: never;
    session_id?: never;
} | {
    cancelled: boolean;
    session_id: string;
    session?: never;
    already_completed?: never;
} | null>;
/**
 * Log a completed focus session (for offline/manual logging)
 */
export declare function logSession(userId: string, data: {
    duration_mins: number;
    journey_day_id?: string | undefined;
    started_at?: Date | undefined;
}): Promise<{
    session: {
        user_id: string;
        created_at: Date;
        id: string;
        started_at: Date;
        completed: boolean;
        journey_day_id: string | null;
        duration_mins: number;
        ended_at: Date | null;
        xp_awarded: number;
    };
    xp_earned: number;
}>;
/**
 * Get focus session history
 */
export declare function getHistory(userId: string, limit?: number, offset?: number): Promise<({
    journey_days: {
        day_number: number;
        journey_id: string;
        theme: string | null;
    } | null;
} & {
    user_id: string;
    created_at: Date;
    id: string;
    started_at: Date;
    completed: boolean;
    journey_day_id: string | null;
    duration_mins: number;
    ended_at: Date | null;
    xp_awarded: number;
})[]>;
/**
 * Get focus stats summary
 */
export declare function getStats(userId: string): Promise<{
    today: {
        sessions: number;
        minutes: number;
        xp: number;
    };
    this_week: {
        sessions: number;
        minutes: number;
        xp: number;
    };
    this_month: {
        sessions: number;
        minutes: number;
        xp: number;
    };
    all_time: {
        sessions: number;
        minutes: number;
        xp: number;
    };
}>;
/**
 * Get active focus session (if any)
 */
export declare function getActiveSession(userId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    started_at: Date;
    completed: boolean;
    journey_day_id: string | null;
    duration_mins: number;
    ended_at: Date | null;
    xp_awarded: number;
} | null>;
//# sourceMappingURL=focus.service.d.ts.map