import { db } from "../lib/services.js";
import { subDays, format } from "date-fns";
/**
 * Get all streaks for a user
 */
export async function getStreaks(userId) {
    const streaks = await db.streaks.findMany({
        where: { user_id: userId },
    });
    // Convert to a more friendly format
    return {
        daily_login: streaks.find((s) => s.kind === "daily_login") || {
            current_length: 0,
            best_length: 0,
            is_frozen: false,
        },
        task_completion: streaks.find((s) => s.kind === "task_completion") || {
            current_length: 0,
            best_length: 0,
            is_frozen: false,
        },
        no_slip: streaks.find((s) => s.kind === "no_slip") || {
            current_length: 0,
            best_length: 0,
            is_frozen: false,
        },
    };
}
/**
 * Get identity score history
 */
export async function getIdentityScoreHistory(userId, days) {
    const startDate = subDays(new Date(), days);
    return db.identity_scores.findMany({
        where: {
            user_id: userId,
            recorded_at: {
                gte: startDate,
            },
        },
        orderBy: { recorded_at: "asc" },
    });
}
/**
 * Get consistency index
 */
export async function getConsistencyIndex(userId, timeWindow) {
    const indices = await db.consistency_indices.findMany({
        where: {
            user_id: userId,
            time_window: timeWindow,
        },
        orderBy: { recorded_at: "desc" },
        take: 10,
    });
    const latest = indices[0];
    const average = indices.length > 0
        ? indices.reduce((sum, i) => sum + Number(i.value), 0) / indices.length
        : 0;
    return {
        time_window: timeWindow,
        current: latest ? Number(latest.value) : 0,
        average: Math.round(average * 1000) / 1000,
        history: indices,
    };
}
/**
 * Get adherence scores for a journey
 */
export async function getAdherenceScores(userId, journeyId) {
    // Verify journey ownership
    const journey = await db.journeys.findFirst({
        where: {
            id: journeyId,
            user_id: userId,
        },
    });
    if (!journey) {
        return null;
    }
    return db.adherence_scores.findMany({
        where: { journey_id: journeyId },
        orderBy: { day_number: "asc" },
    });
}
/**
 * Get personalized insights
 */
export async function getInsights(userId, limit) {
    return db.insights.findMany({
        where: {
            user_id: userId,
            OR: [
                { valid_to: null },
                { valid_to: { gte: new Date() } },
            ],
        },
        orderBy: { valid_from: "desc" },
        take: limit,
    });
}
/**
 * Get trigger heatmap data
 */
export async function getTriggerHeatmap(userId, days) {
    const startDate = subDays(new Date(), days);
    // Get slip events with context
    const slips = await db.slip_events.findMany({
        where: {
            user_id: userId,
            happened_at: {
                gte: startDate,
            },
        },
        orderBy: { happened_at: "asc" },
    });
    // Aggregate by day of week and hour
    const heatmap = {};
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const day of daysOfWeek) {
        heatmap[day] = {};
        for (let hour = 0; hour < 24; hour++) {
            heatmap[day][hour.toString()] = 0;
        }
    }
    for (const slip of slips) {
        const date = new Date(slip.happened_at);
        const dayIndex = date.getDay();
        const dayOfWeek = daysOfWeek[dayIndex];
        const hour = date.getHours().toString();
        const dayData = heatmap[dayOfWeek];
        if (dayData && typeof dayData[hour] === "number") {
            dayData[hour] = dayData[hour] + 1;
        }
    }
    return {
        period_days: days,
        total_slips: slips.length,
        heatmap,
    };
}
/**
 * Get daily metrics
 */
export async function getDailyMetrics(userId, days) {
    const startDate = subDays(new Date(), days);
    return db.daily_metrics.findMany({
        where: {
            user_id: userId,
            day: {
                gte: startDate,
            },
        },
        orderBy: { day: "asc" },
    });
}
/**
 * Export user data
 */
export async function exportUserData(userId, format) {
    // Gather all user data
    const [habits, journeys, slips, streaks, reflections, taskProgress, identityScores,] = await Promise.all([
        db.user_habits.findMany({ where: { user_id: userId } }),
        db.journeys.findMany({
            where: { user_id: userId },
            include: {
                journey_days: {
                    include: {
                        journey_tasks: true,
                    },
                },
            },
        }),
        db.slip_events.findMany({ where: { user_id: userId } }),
        db.streaks.findMany({ where: { user_id: userId } }),
        db.reflections.findMany({ where: { user_id: userId } }),
        db.user_task_progress.findMany({ where: { user_id: userId } }),
        db.identity_scores.findMany({ where: { user_id: userId } }),
    ]);
    const exportData = {
        exported_at: new Date().toISOString(),
        user_id: userId,
        habits,
        journeys,
        slips,
        streaks,
        reflections,
        task_progress: taskProgress,
        identity_scores: identityScores,
    };
    if (format === "csv") {
        // Convert to CSV format (simplified - just habits and slips for now)
        const lines = [];
        lines.push("# Habits");
        lines.push("id,goal_text,status,created_at");
        for (const h of habits) {
            lines.push(`${h.id},"${h.goal_text}",${h.status},${h.created_at}`);
        }
        lines.push("");
        lines.push("# Slip Events");
        lines.push("id,happened_at,user_habit_id");
        for (const s of slips) {
            lines.push(`${s.id},${s.happened_at},${s.user_habit_id ?? ""}`);
        }
        lines.push("");
        lines.push("# Streaks");
        lines.push("kind,current_length,best_length,is_frozen");
        for (const s of streaks) {
            lines.push(`${s.kind},${s.current_length},${s.best_length},${s.is_frozen}`);
        }
        return lines.join("\n");
    }
    return exportData;
}
/**
 * Get missed days summary
 */
export async function getMissedDaysSummary(userId) {
    const activeJourney = await db.journeys.findFirst({
        where: { user_id: userId, status: "active" },
        include: {
            journey_days: {
                include: {
                    journey_tasks: {
                        include: {
                            user_task_progress: {
                                where: { user_id: userId, status: "completed" },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!activeJourney || !activeJourney.start_date) {
        return {
            total_missed: 0,
            last_missed_days_ago: null,
        };
    }
    const startDate = new Date(activeJourney.start_date);
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let totalMissed = 0;
    let lastMissedDate = null;
    // Check each day from start to today
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const dayNumber = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const dayData = activeJourney.journey_days.find(jd => jd.day_number === dayNumber);
        if (dayData && dayData.journey_tasks.length > 0) {
            // Check if all tasks for this day were completed
            const allCompleted = dayData.journey_tasks.every(task => task.user_task_progress.some(p => p.status === "completed"));
            if (!allCompleted) {
                totalMissed++;
                lastMissedDate = new Date(d);
            }
        }
    }
    // Calculate days since last missed
    let lastMissedDaysAgo = null;
    if (lastMissedDate) {
        const diffTime = today.getTime() - lastMissedDate.getTime();
        lastMissedDaysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    return {
        total_missed: totalMissed,
        last_missed_days_ago: lastMissedDaysAgo,
    };
}
/**
 * Get habit health trend (historical data)
 */
export async function getHabitHealthTrend(userId, days = 7) {
    const activeJourney = await db.journeys.findFirst({
        where: { user_id: userId, status: "active" },
        include: {
            journey_days: {
                include: {
                    journey_tasks: {
                        include: {
                            user_task_progress: {
                                where: { user_id: userId },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!activeJourney || !activeJourney.start_date) {
        return {
            trend: [],
            current_health: 0,
            change_percent: 0,
        };
    }
    const startDate = new Date(activeJourney.start_date);
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysAgo = new Date(today);
    daysAgo.setDate(daysAgo.getDate() - days);
    const trend = [];
    // Calculate health for each day in the range
    for (let d = new Date(Math.max(startDate.getTime(), daysAgo.getTime())); d <= today; d.setDate(d.getDate() + 1)) {
        const dayNumber = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const dayData = activeJourney.journey_days.find(jd => jd.day_number === dayNumber);
        if (dayData) {
            let totalTasks = 0;
            let completedTasks = 0;
            for (const task of dayData.journey_tasks) {
                totalTasks++;
                if (task.user_task_progress.some(p => p.status === "completed")) {
                    completedTasks++;
                }
            }
            const health = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const dateStr = d.toISOString().split('T')[0];
            if (dateStr) {
                trend.push({
                    date: dateStr,
                    health,
                });
            }
        }
    }
    const currentHealth = trend.length > 0 && trend[trend.length - 1] ? trend[trend.length - 1].health : 0;
    const previousHealth = trend.length > 1 && trend[0] ? trend[0].health : currentHealth;
    const changePercent = previousHealth > 0
        ? Math.round(((currentHealth - previousHealth) / previousHealth) * 100)
        : 0;
    return {
        trend,
        current_health: currentHealth,
        change_percent: changePercent,
    };
}
//# sourceMappingURL=analytics.service.js.map