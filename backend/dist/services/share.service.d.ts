/**
 * Generate shareable progress data
 */
export declare function generateProgressShare(userId: string): Promise<{
    share_url: string;
    share_code: string;
    user: {
        name: string;
        avatar_url: string | null | undefined;
    };
    stats: {
        streak: number;
        best_streak: number;
        level: number;
        total_xp: number;
        badges_earned: number;
    };
    journey: {
        habit: string;
        day: number;
        total_days: number;
        progress: number;
    } | null;
    og_metadata: {
        title: string;
        description: string;
        image: string;
    };
}>;
/**
 * Generate shareable achievement data
 */
export declare function generateAchievementShare(userId: string, achievementType: "badge" | "streak" | "level" | "journey_complete", achievementId?: string): Promise<{
    share_url: string;
    share_code: string;
    achievement: Record<string, unknown>;
    user: {
        name: string;
        avatar_url: string | null | undefined;
    };
    og_metadata: {
        title: string;
        description: string;
        image: string;
    };
}>;
//# sourceMappingURL=share.service.d.ts.map