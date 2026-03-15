import { prisma } from "../lib/services.js";
import { getSettingValue } from "./admin.service.js";
import * as RewardsService from "./rewards.service.js";
import * as BadgeAwardingService from "./badge-awarding.service.js";
/**
 * Start a focus session
 */
export async function startSession(userId, data) {
    // Verify journey day ownership if provided
    if (data.journey_day_id) {
        const journeyDay = await prisma.journey_days.findFirst({
            where: { id: data.journey_day_id },
            include: { journeys: true },
        });
        if (!journeyDay || journeyDay.journeys.user_id !== userId) {
            throw new Error("Journey day not found");
        }
    }
    // Create session
    return prisma.focus_sessions.create({
        data: {
            user_id: userId,
            journey_day_id: data.journey_day_id ?? null,
            duration_mins: data.duration_mins,
            started_at: new Date(),
            completed: false,
            xp_awarded: 0,
        },
    });
}
/**
 * Stop/complete a focus session
 */
export async function stopSession(userId, sessionId) {
    const session = await prisma.focus_sessions.findFirst({
        where: {
            id: sessionId,
            user_id: userId,
        },
    });
    if (!session) {
        return null;
    }
    if (session.completed) {
        return { session, already_completed: true };
    }
    const endedAt = new Date();
    const actualDurationMs = endedAt.getTime() - new Date(session.started_at).getTime();
    const actualDurationMins = Math.floor(actualDurationMs / (1000 * 60));
    // Calculate XP based on actual duration
    const xpPerMinute = await getSettingValue("xp_per_focus_minute", 1);
    const xpEarned = actualDurationMins * xpPerMinute;
    // Update session
    const updatedSession = await prisma.focus_sessions.update({
        where: { id: sessionId },
        data: {
            ended_at: endedAt,
            completed: true,
            xp_awarded: xpEarned,
        },
    });
    // Award XP if earned
    if (xpEarned > 0) {
        await RewardsService.awardPoints(userId, xpEarned);
    }
    // Check for focus-related badges
    await BadgeAwardingService.checkAndAwardBadgeType(userId, 'focus_sessions');
    return {
        session: updatedSession,
        actual_duration_mins: actualDurationMins,
        xp_earned: xpEarned,
        already_completed: false,
    };
}
/**
 * Cancel an active focus session (no XP awarded, session row is deleted)
 */
export async function cancelSession(userId, sessionId) {
    const session = await prisma.focus_sessions.findFirst({
        where: {
            id: sessionId,
            user_id: userId,
        },
    });
    if (!session) {
        return null;
    }
    if (session.completed) {
        return { session, already_completed: true };
    }
    // Delete the session row — no XP, no completion log
    await prisma.focus_sessions.delete({
        where: { id: sessionId },
    });
    return { cancelled: true, session_id: sessionId };
}
/**
 * Log a completed focus session (for offline/manual logging)
 */
export async function logSession(userId, data) {
    // Verify journey day ownership if provided
    if (data.journey_day_id) {
        const journeyDay = await prisma.journey_days.findFirst({
            where: { id: data.journey_day_id },
            include: { journeys: true },
        });
        if (!journeyDay || journeyDay.journeys.user_id !== userId) {
            throw new Error("Journey day not found");
        }
    }
    // Calculate XP
    const xpPerMinute = await getSettingValue("xp_per_focus_minute", 1);
    const xpEarned = data.duration_mins * xpPerMinute;
    const startedAt = data.started_at ?? new Date(Date.now() - data.duration_mins * 60 * 1000);
    const endedAt = new Date(startedAt.getTime() + data.duration_mins * 60 * 1000);
    // Create completed session
    const session = await prisma.focus_sessions.create({
        data: {
            user_id: userId,
            journey_day_id: data.journey_day_id ?? null,
            duration_mins: data.duration_mins,
            started_at: startedAt,
            ended_at: endedAt,
            completed: true,
            xp_awarded: xpEarned,
        },
    });
    // Award XP
    if (xpEarned > 0) {
        await RewardsService.awardPoints(userId, xpEarned);
    }
    // Check for focus-related badges
    await BadgeAwardingService.checkAndAwardBadgeType(userId, 'focus_sessions');
    return {
        session,
        xp_earned: xpEarned,
    };
}
/**
 * Get focus session history
 */
export async function getHistory(userId, limit = 30, offset = 0) {
    const sessions = await prisma.focus_sessions.findMany({
        where: { user_id: userId, completed: true },
        orderBy: { started_at: "desc" },
        take: limit,
        skip: offset,
        include: {
            journey_days: {
                select: {
                    day_number: true,
                    theme: true,
                    journey_id: true,
                },
            },
        },
    });
    return sessions;
}
/**
 * Get focus stats summary
 */
export async function getStats(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todayStats, weekStats, monthStats, allTimeStats] = await Promise.all([
        prisma.focus_sessions.aggregate({
            where: {
                user_id: userId,
                completed: true,
                started_at: { gte: today },
            },
            _sum: { duration_mins: true, xp_awarded: true },
            _count: true,
        }),
        prisma.focus_sessions.aggregate({
            where: {
                user_id: userId,
                completed: true,
                started_at: { gte: startOfWeek },
            },
            _sum: { duration_mins: true, xp_awarded: true },
            _count: true,
        }),
        prisma.focus_sessions.aggregate({
            where: {
                user_id: userId,
                completed: true,
                started_at: { gte: startOfMonth },
            },
            _sum: { duration_mins: true, xp_awarded: true },
            _count: true,
        }),
        prisma.focus_sessions.aggregate({
            where: {
                user_id: userId,
                completed: true,
            },
            _sum: { duration_mins: true, xp_awarded: true },
            _count: true,
        }),
    ]);
    return {
        today: {
            sessions: todayStats._count,
            minutes: todayStats._sum.duration_mins ?? 0,
            xp: todayStats._sum.xp_awarded ?? 0,
        },
        this_week: {
            sessions: weekStats._count,
            minutes: weekStats._sum.duration_mins ?? 0,
            xp: weekStats._sum.xp_awarded ?? 0,
        },
        this_month: {
            sessions: monthStats._count,
            minutes: monthStats._sum.duration_mins ?? 0,
            xp: monthStats._sum.xp_awarded ?? 0,
        },
        all_time: {
            sessions: allTimeStats._count,
            minutes: allTimeStats._sum.duration_mins ?? 0,
            xp: allTimeStats._sum.xp_awarded ?? 0,
        },
    };
}
/**
 * Get active focus session (if any)
 */
export async function getActiveSession(userId) {
    return prisma.focus_sessions.findFirst({
        where: {
            user_id: userId,
            completed: false,
        },
        orderBy: { started_at: "desc" },
    });
}
//# sourceMappingURL=focus.service.js.map