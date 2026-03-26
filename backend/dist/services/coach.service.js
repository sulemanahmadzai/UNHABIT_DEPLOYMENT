import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";
/**
 * Get coach sessions for a user
 */
export async function getSessions(userId, limit) {
    return db.coach_sessions.findMany({
        where: { user_id: userId },
        include: {
            _count: {
                select: {
                    coach_messages: true,
                },
            },
        },
        orderBy: { started_at: "desc" },
        take: limit,
    });
}
/**
 * Create a new coach session
 */
export async function createSession(userId) {
    return db.coach_sessions.create({
        data: {
            user_id: userId,
        },
    });
}
/**
 * Get session with messages
 */
export async function getSessionWithMessages(userId, sessionId) {
    return db.coach_sessions.findFirst({
        where: {
            id: sessionId,
            user_id: userId,
        },
        include: {
            coach_messages: {
                orderBy: { created_at: "asc" },
            },
            coach_actions: {
                orderBy: { created_at: "asc" },
            },
        },
    });
}
/**
 * Add a message to a session
 */
export async function addMessage(sessionId, role, content, meta) {
    return db.coach_messages.create({
        data: {
            session_id: sessionId,
            role: role,
            content,
            meta: meta ? meta : Prisma.JsonNull,
        },
    });
}
/**
 * Save an action from the coach
 */
export async function saveAction(sessionId, action, payload) {
    return db.coach_actions.create({
        data: {
            session_id: sessionId,
            action,
            payload: payload ? payload : Prisma.JsonNull,
        },
    });
}
/**
 * End a coach session
 */
export async function endSession(userId, sessionId) {
    const session = await db.coach_sessions.findFirst({
        where: {
            id: sessionId,
            user_id: userId,
        },
    });
    if (!session) {
        return null;
    }
    return db.coach_sessions.update({
        where: { id: sessionId },
        data: {
            ended_at: new Date(),
        },
    });
}
/**
 * Get recent sessions for context
 */
export async function getRecentSessionContext(userId) {
    const recentSession = await db.coach_sessions.findFirst({
        where: {
            user_id: userId,
            ended_at: { not: null },
        },
        include: {
            coach_messages: {
                orderBy: { created_at: "desc" },
                take: 5,
            },
        },
        orderBy: { ended_at: "desc" },
    });
    return recentSession;
}
//# sourceMappingURL=coach.service.js.map