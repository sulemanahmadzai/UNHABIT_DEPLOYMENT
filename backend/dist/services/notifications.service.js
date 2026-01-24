import { db } from "../lib/services.js";
/**
 * Get notification preferences
 */
export async function getPreferences(userId) {
    const prefs = await db.user_nudge_prefs.findUnique({
        where: { user_id: userId },
    });
    // Return defaults if no preferences exist
    return (prefs || {
        user_id: userId,
        enabled: true,
        max_per_day: 5,
        escalate_to_buddy: false,
    });
}
/**
 * Update notification preferences
 */
export async function updatePreferences(userId, data) {
    return db.user_nudge_prefs.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            enabled: data.enabled ?? true,
            max_per_day: data.max_per_day ?? 5,
            escalate_to_buddy: data.escalate_to_buddy ?? false,
        },
        update: {
            ...(data.enabled !== undefined && { enabled: data.enabled }),
            ...(data.max_per_day !== undefined && { max_per_day: data.max_per_day }),
            ...(data.escalate_to_buddy !== undefined && {
                escalate_to_buddy: data.escalate_to_buddy,
            }),
        },
    });
}
/**
 * Get scheduled nudges
 */
export async function getScheduledNudges(userId, limit) {
    return db.scheduled_nudges.findMany({
        where: {
            user_id: userId,
            scheduled_for: {
                gte: new Date(),
            },
        },
        include: {
            journey_tasks: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
        orderBy: { scheduled_for: "asc" },
        take: limit,
    });
}
/**
 * Set prime time windows
 */
export async function setPrimeTimeWindows(userId, windows) {
    // Delete existing windows
    await db.prime_time_windows.deleteMany({
        where: { user_id: userId },
    });
    // Create new windows
    if (windows.length > 0) {
        await db.prime_time_windows.createMany({
            data: windows.map((w) => ({
                user_id: userId,
                dow: w.dow,
                start_minute: w.start_minute,
                end_minute: w.end_minute,
            })),
        });
    }
    return getPrimeTimeWindows(userId);
}
/**
 * Get prime time windows
 */
export async function getPrimeTimeWindows(userId) {
    return db.prime_time_windows.findMany({
        where: { user_id: userId },
        orderBy: [{ dow: "asc" }, { start_minute: "asc" }],
    });
}
/**
 * Set quiet hours
 */
export async function setQuietHours(userId, data) {
    // Delete existing quiet hours
    await db.quiet_hours.deleteMany({
        where: { user_id: userId },
    });
    // Create new quiet hours
    return db.quiet_hours.create({
        data: {
            user_id: userId,
            start_minute: data.start_minute,
            end_minute: data.end_minute,
        },
    });
}
/**
 * Get quiet hours
 */
export async function getQuietHours(userId) {
    return db.quiet_hours.findMany({
        where: { user_id: userId },
    });
}
/**
 * Get notification delivery history
 */
export async function getDeliveryHistory(userId, limit, offset) {
    const nudges = await db.scheduled_nudges.findMany({
        where: { user_id: userId },
        include: {
            nudge_deliveries: {
                orderBy: { sent_at: "desc" },
            },
            journey_tasks: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
        orderBy: { scheduled_for: "desc" },
        take: limit,
        skip: offset,
    });
    // Flatten to delivery records
    const deliveries = [];
    for (const nudge of nudges) {
        for (const delivery of nudge.nudge_deliveries) {
            deliveries.push({
                id: delivery.id,
                scheduled_nudge_id: nudge.id,
                scheduled_for: nudge.scheduled_for,
                channel: nudge.channel,
                reason: nudge.reason,
                task: nudge.journey_tasks,
                sent_at: delivery.sent_at,
                status: delivery.status,
                opened_at: delivery.opened_at,
                engaged: delivery.engaged,
            });
        }
    }
    return deliveries;
}
//# sourceMappingURL=notifications.service.js.map