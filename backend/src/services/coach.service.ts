import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";
import type { coach_role } from "@prisma/client";

/**
 * Get coach sessions for a user
 */
export async function getSessions(userId: string, limit: number) {
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
export async function createSession(userId: string) {
  return db.coach_sessions.create({
    data: {
      user_id: userId,
    },
  });
}

/**
 * Get session with messages
 */
export async function getSessionWithMessages(userId: string, sessionId: string) {
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
export async function addMessage(
  sessionId: string,
  role: string,
  content: string,
  meta?: Record<string, unknown> | null
) {
  return db.coach_messages.create({
    data: {
      session_id: sessionId,
      role: role as coach_role,
      content,
      meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

/**
 * Save an action from the coach
 */
export async function saveAction(
  sessionId: string,
  action: string,
  payload?: Record<string, unknown> | null
) {
  return db.coach_actions.create({
    data: {
      session_id: sessionId,
      action,
      payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

/**
 * End a coach session
 */
export async function endSession(userId: string, sessionId: string) {
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
export async function getRecentSessionContext(userId: string) {
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

