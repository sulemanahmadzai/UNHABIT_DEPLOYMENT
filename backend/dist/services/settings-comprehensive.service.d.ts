/**
 * Comprehensive Settings Service
 * Aggregates all user settings
 */
/**
 * Get all user settings
 */
export declare function getAllSettings(userId: string): Promise<{
    privacy: {
        user_id: string;
        created_at: Date;
        updated_at: Date;
        share_with_buddy: boolean;
        allow_research: boolean;
        data_export_requested_at: Date | null;
        data_delete_requested_at: Date | null;
    } | {
        user_id: string;
        share_with_buddy: false;
        allow_research: false;
    };
    share: {
        user_id: string;
        share_metrics: boolean;
        share_streaks: boolean;
    };
    notifications: {
        user_id: string;
        enabled: boolean;
        max_per_day: number;
        escalate_to_buddy: boolean;
    };
    devices: {
        user_id: string;
        created_at: Date;
        id: string;
        platform: string | null;
        push_token: string | null;
        app_version: string | null;
    }[];
}>;
/**
 * Get AI Coach preferences
 */
export declare function getAICoachPreferences(userId: string): Promise<{
    enabled: boolean;
    tone: string;
    frequency: string;
    topics: string[];
}>;
/**
 * Update AI Coach preferences
 */
export declare function updateAICoachPreferences(userId: string, data: {
    enabled?: boolean | undefined;
    tone?: "supportive" | "motivational" | "direct" | undefined;
    frequency?: "daily" | "weekly" | "on_demand" | undefined;
    topics?: string[] | undefined;
}): Promise<{
    enabled: boolean | undefined;
    tone: string | undefined;
    frequency: string | undefined;
    topics: string[] | undefined;
}>;
//# sourceMappingURL=settings-comprehensive.service.d.ts.map