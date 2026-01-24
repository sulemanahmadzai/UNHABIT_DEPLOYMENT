/**
 * Get privacy settings
 */
export declare function getPrivacySettings(userId: string): Promise<{
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
    data_export_requested_at: null;
    data_delete_requested_at: null;
}>;
/**
 * Update privacy settings
 */
export declare function updatePrivacySettings(userId: string, data: {
    share_with_buddy?: boolean | undefined;
    allow_research?: boolean | undefined;
}): Promise<{
    user_id: string;
    created_at: Date;
    updated_at: Date;
    share_with_buddy: boolean;
    allow_research: boolean;
    data_export_requested_at: Date | null;
    data_delete_requested_at: Date | null;
}>;
/**
 * Get share preferences
 */
export declare function getSharePreferences(userId: string): Promise<{
    user_id: string;
    share_metrics: boolean;
    share_streaks: boolean;
}>;
/**
 * Update share preferences
 */
export declare function updateSharePreferences(userId: string, data: {
    share_metrics?: boolean | undefined;
    share_streaks?: boolean | undefined;
}): Promise<{
    user_id: string;
    share_metrics: boolean;
    share_streaks: boolean;
}>;
/**
 * Get registered devices
 */
export declare function getDevices(userId: string): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    platform: string | null;
    push_token: string | null;
    app_version: string | null;
}[]>;
/**
 * Register a device
 */
export declare function registerDevice(userId: string, data: {
    platform: string;
    push_token?: string | null;
    app_version?: string | null;
}): Promise<{
    user_id: string;
    created_at: Date;
    id: string;
    platform: string | null;
    push_token: string | null;
    app_version: string | null;
}>;
/**
 * Unregister a device
 */
export declare function unregisterDevice(userId: string, deviceId: string): Promise<boolean>;
/**
 * Request data export
 */
export declare function requestDataExport(userId: string): Promise<{
    user_id: string;
    created_at: Date;
    updated_at: Date;
    share_with_buddy: boolean;
    allow_research: boolean;
    data_export_requested_at: Date | null;
    data_delete_requested_at: Date | null;
}>;
/**
 * Request account deletion
 */
export declare function requestAccountDeletion(userId: string): Promise<{
    user_id: string;
    created_at: Date;
    updated_at: Date;
    share_with_buddy: boolean;
    allow_research: boolean;
    data_export_requested_at: Date | null;
    data_delete_requested_at: Date | null;
}>;
//# sourceMappingURL=settings.service.d.ts.map