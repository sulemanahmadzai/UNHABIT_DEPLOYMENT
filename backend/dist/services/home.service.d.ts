/**
 * Get aggregated home dashboard data for a user
 */
export declare function getDashboard(userId: string): Promise<any>;
/**
 * Get streak at risk status
 */
export declare function getStreakAtRiskStatus(userId: string): Promise<{
    at_risk: boolean;
    hours_left: number;
    message: string;
    current_streak?: never;
} | {
    at_risk: boolean;
    current_streak: number;
    hours_left: number;
    message: string;
}>;
//# sourceMappingURL=home.service.d.ts.map