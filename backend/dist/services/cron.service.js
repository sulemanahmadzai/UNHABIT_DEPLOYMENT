/**
 * Push Notification Cron Jobs
 *
 * Schedules:
 *  - 09:00 UTC daily  → Daily Challenge Reminder
 *  - 20:00 UTC daily  → Streak Saver Warning
 *
 * To enable: import and call `startCronJobs()` from server.ts
 *
 * NOTE: Requires node-cron:
 *   npm install node-cron
 *   npm install --save-dev @types/node-cron
 */
import { db } from "../lib/services.js";
import { sendPushToUser } from "./push-notifications.service.js";
// Lazy-load node-cron so missing package doesn't crash the server
async function getCron() {
    try {
        const mod = await import("node-cron");
        return mod.default ?? mod;
    }
    catch {
        console.warn("⚠️  node-cron is not installed. Cron jobs are disabled.\n" +
            "   Run: npm install node-cron && npm install --save-dev @types/node-cron");
        return null;
    }
}
/**
 * Cron A: Daily Challenge Reminder — 09:00 UTC
 * Sends a push to users who haven't completed today's challenge.
 */
async function runDailyChallengeReminder() {
    console.log("🕘 [Cron] Running Daily Challenge Reminder...");
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Find users who have an active journey but haven't completed any task today
        const activeJourneys = await db.journeys.findMany({
            where: { status: "active" },
            select: { user_id: true },
            distinct: ["user_id"],
        });
        let sent = 0;
        let skipped = 0;
        for (const { user_id } of activeJourneys) {
            // Check if they have a completion today
            const completedToday = await db.user_task_progress.count({
                where: {
                    user_id,
                    status: "completed",
                    completed_at: { gte: today },
                },
            });
            if (completedToday === 0) {
                await sendPushToUser(user_id, "📅 Today's Challenge", "Today's Challenge is waiting! Complete it to keep your habit alive. 🎯", { type: "daily_challenge_reminder" });
                sent++;
            }
            else {
                skipped++;
            }
        }
        console.log(`✅ [Cron] Daily Challenge Reminder: sent=${sent}, skipped=${skipped}`);
    }
    catch (err) {
        console.error("❌ [Cron] Daily Challenge Reminder failed:", err);
    }
}
/**
 * Cron B: Streak Saver Warning — 20:00 UTC
 * Sends a push to users who haven't logged their habit today and have a streak > 0.
 */
async function runStreakSaverWarning() {
    console.log("🕗 [Cron] Running Streak Saver Warning...");
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Find users with an active streak
        const streaks = await db.streaks.findMany({
            where: {
                kind: "task_completion",
                current_length: { gt: 0 },
                is_frozen: false,
            },
            select: { user_id: true, current_length: true },
        });
        let sent = 0;
        let skipped = 0;
        for (const { user_id, current_length } of streaks) {
            // Check if they already completed a task today
            const completedToday = await db.user_task_progress.count({
                where: {
                    user_id,
                    status: "completed",
                    completed_at: { gte: today },
                },
            });
            if (completedToday === 0) {
                await sendPushToUser(user_id, "🔥 Streak in Danger!", `Keep your ${current_length}-day streak alive! Log your habit now before midnight. 🔥`, { type: "streak_saver_warning", current_streak: current_length });
                sent++;
            }
            else {
                skipped++;
            }
        }
        console.log(`✅ [Cron] Streak Saver Warning: sent=${sent}, skipped=${skipped}`);
    }
    catch (err) {
        console.error("❌ [Cron] Streak Saver Warning failed:", err);
    }
}
/**
 * Start all cron jobs.
 * Call this once from server.ts after the server starts.
 */
export async function startCronJobs() {
    const cron = await getCron();
    if (!cron)
        return;
    // Daily Challenge Reminder at 09:00 UTC
    cron.schedule("0 9 * * *", runDailyChallengeReminder, {
        timezone: "UTC",
    });
    // Streak Saver Warning at 20:00 UTC
    cron.schedule("0 20 * * *", runStreakSaverWarning, {
        timezone: "UTC",
    });
    console.log("⏰ Cron jobs scheduled:");
    console.log("   - Daily Challenge Reminder: 09:00 UTC");
    console.log("   - Streak Saver Warning:     20:00 UTC");
}
//# sourceMappingURL=cron.service.js.map