import { Prisma } from "@prisma/client";
/**
 * Get coach sessions for a user
 */
export declare function getSessions(userId: string, limit: number): Promise<({
    _count: {
        coach_messages: number;
    };
} & {
    user_id: string;
    id: string;
    started_at: Date;
    ended_at: Date | null;
})[]>;
/**
 * Create a new coach session
 */
export declare function createSession(userId: string): Promise<{
    user_id: string;
    id: string;
    started_at: Date;
    ended_at: Date | null;
}>;
/**
 * Get session with messages
 */
export declare function getSessionWithMessages(userId: string, sessionId: string): Promise<({
    coach_actions: {
        created_at: Date;
        id: string;
        action: string;
        session_id: string;
        payload: Prisma.JsonValue | null;
    }[];
    coach_messages: {
        role: import("@prisma/client").$Enums.coach_role;
        created_at: Date;
        id: string;
        meta: Prisma.JsonValue | null;
        content: string;
        session_id: string;
    }[];
} & {
    user_id: string;
    id: string;
    started_at: Date;
    ended_at: Date | null;
}) | null>;
/**
 * Add a message to a session
 */
export declare function addMessage(sessionId: string, role: string, content: string, meta?: Record<string, unknown> | null): Promise<{
    role: import("@prisma/client").$Enums.coach_role;
    created_at: Date;
    id: string;
    meta: Prisma.JsonValue | null;
    content: string;
    session_id: string;
}>;
/**
 * Save an action from the coach
 */
export declare function saveAction(sessionId: string, action: string, payload?: Record<string, unknown> | null): Promise<{
    created_at: Date;
    id: string;
    action: string;
    session_id: string;
    payload: Prisma.JsonValue | null;
}>;
/**
 * End a coach session
 */
export declare function endSession(userId: string, sessionId: string): Promise<{
    user_id: string;
    id: string;
    started_at: Date;
    ended_at: Date | null;
} | null>;
/**
 * Get recent sessions for context
 */
export declare function getRecentSessionContext(userId: string): Promise<({
    coach_messages: {
        role: import("@prisma/client").$Enums.coach_role;
        created_at: Date;
        id: string;
        meta: Prisma.JsonValue | null;
        content: string;
        session_id: string;
    }[];
} & {
    user_id: string;
    id: string;
    started_at: Date;
    ended_at: Date | null;
}) | null>;
//# sourceMappingURL=coach.service.d.ts.map