/**
 * Daily Challenges Service
 * Handles daily challenge generation and acceptance
 */
export interface DailyChallenge {
    id: string;
    title: string;
    description: string;
    reward_xp: number;
    challenge_type: "speed" | "consistency" | "streak" | "completion";
    target_value?: number | undefined;
    expires_at: Date;
}
/**
 * Get today's challenge for a user
 */
export declare function getDailyChallenge(userId: string): Promise<DailyChallenge | null>;
/**
 * Accept a daily challenge
 */
export declare function acceptChallenge(userId: string, challengeId: string): Promise<{
    id: string;
    accepted_at: Date;
    status: string;
    challenge: DailyChallenge;
} | null>;
/**
 * Complete a challenge and award XP
 */
export declare function completeChallenge(userId: string, challengeId: string): Promise<{
    id: string;
    completed_at: Date;
    xp_earned: number;
} | null>;
//# sourceMappingURL=challenges.service.d.ts.map