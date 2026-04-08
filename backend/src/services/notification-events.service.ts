/**
 * Notification Events Service
 *
 * Backward-compatible wrappers that delegate to the comprehensive
 * notification-scenarios.service. Existing callers don't need to change.
 */

import * as Scenarios from "./notification-scenarios.service.js";

/**
 * Push notify when a user completes a day (all today's tasks).
 * Called from progress route (complete-day).
 */
export async function notifyDailyCompletion(userId: string) {
  return Scenarios.notifyCompletionReinforcement(userId);
}

/**
 * Push notify when user's streak is at risk.
 * Called by cron near end-of-day in user's timezone.
 */
export async function notifyStreakAtRisk(userId: string) {
  return Scenarios.notifyStreakAtRisk(userId);
}
