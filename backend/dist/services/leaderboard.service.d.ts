interface LeaderboardEntry {
    rank: number;
    user_id: string;
    name: string;
    avatar_url: string | null;
    score: number;
    streak: number;
    is_current_user: boolean;
}
/**
 * Get daily leaderboard (based on today's XP)
 */
export declare function getDailyLeaderboard(userId: string, limit?: number): Promise<{
    entries: LeaderboardEntry[];
    current_user_rank: number | null;
}>;
/**
 * Get weekly leaderboard (based on weekly XP)
 */
export declare function getWeeklyLeaderboard(userId: string, limit?: number): Promise<{
    entries: LeaderboardEntry[];
    current_user_rank: number | null;
}>;
/**
 * Get friends (buddies) leaderboard
 */
export declare function getFriendsLeaderboard(userId: string): Promise<{
    entries: LeaderboardEntry[];
    current_user_rank: number | null;
}>;
/**
 * Get current user's rank summary
 */
export declare function getMyRank(userId: string): Promise<{
    daily_rank: number | null;
    weekly_rank: number | null;
    friends_rank: number | null;
    total_friends: number;
    user_stats: {
        score: number;
        streak: number;
    } | null;
}>;
export {};
//# sourceMappingURL=leaderboard.service.d.ts.map