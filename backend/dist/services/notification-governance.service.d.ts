/**
 * Notification Governance Service
 *
 * Enforces:
 * - Frequency caps per intensity level (Light: 0-1/day, Standard: 1-2/day, High: up to 3/day)
 * - Quiet hours (never send outside, except billing/security)
 * - Suppression rules (app opened recently, day already completed)
 * - Per-category enabled checks
 * - Promotional opt-in enforcement (iOS compliance)
 */
type Intensity = "light" | "standard" | "high_support";
interface DeliveryGateResult {
    allowed: boolean;
    reason?: "disabled" | "quiet_hours" | "outside_prime_time" | "category_disabled" | "frequency_cap" | "promotional_not_opted_in" | "day_completed" | "recently_active";
    timeZone?: string;
}
/**
 * Full delivery gate: checks all governance rules before sending a notification.
 *
 * @param category - Notification category id
 * @param kind - Specific scenario kind (e.g., "daily_checkin_ready")
 * @param isBillingOrSecurity - If true, bypasses quiet hours and frequency caps
 */
export declare function checkDeliveryGate(userId: string, category: string, kind: string, isBillingOrSecurity?: boolean): Promise<DeliveryGateResult>;
/**
 * Record that a notification was sent (for frequency cap tracking).
 */
export declare function recordNotificationSent(userId: string, category: string, kind: string): Promise<void>;
/**
 * Check if user completed today's tasks (suppression: no more daily reminders).
 */
export declare function hasCompletedToday(userId: string): Promise<boolean>;
/**
 * Get user's notification intensity level.
 */
export declare function getUserIntensity(userId: string): Promise<Intensity>;
/**
 * Get user's notification settings or defaults.
 */
export declare function getNotificationSettings(userId: string): Promise<{
    user_id: string;
    updated_at: Date;
    intensity: string;
    show_habit_details_lockscreen: boolean;
    promotional_opt_in: boolean;
    weekend_support: boolean;
    high_risk_reminders: boolean;
    morning_checkin_minute: number;
    evening_lastcall_minute: number;
}>;
/**
 * Update notification settings.
 */
export declare function updateNotificationSettings(userId: string, data: {
    intensity?: string;
    show_habit_details_lockscreen?: boolean;
    promotional_opt_in?: boolean;
    weekend_support?: boolean;
    high_risk_reminders?: boolean;
    morning_checkin_minute?: number;
    evening_lastcall_minute?: number;
}): Promise<{
    user_id: string;
    updated_at: Date;
    intensity: string;
    show_habit_details_lockscreen: boolean;
    promotional_opt_in: boolean;
    weekend_support: boolean;
    high_risk_reminders: boolean;
    morning_checkin_minute: number;
    evening_lastcall_minute: number;
}>;
/**
 * Get the count of notifications sent today for a user.
 */
export declare function getSentTodayCount(userId: string): Promise<number>;
export {};
//# sourceMappingURL=notification-governance.service.d.ts.map