/**
 * Get all buddies for a user
 */
export declare function getBuddies(userId: string): Promise<{
    buddy_link_id: string;
    buddy_user_id: string;
    buddy_email: string | null;
    buddy_name: string | null;
    buddy_avatar: string | null;
    status: string;
    started_at: Date;
    streak_days: number;
    daily_status: "COMPLETED" | "PENDING" | "MISSED";
}[]>;
/**
 * Create an invite link
 */
export declare function createInvite(userId: string, data: {
    target_contact?: string | undefined;
    expires_in_days: number;
}): Promise<{
    created_at: Date;
    id: string;
    status: string;
    invite_code: string;
    target_contact: string | null;
    expires_at: Date | null;
    inviter_id: string;
}>;
/**
 * Get sent invites
 */
export declare function getSentInvites(userId: string): Promise<{
    created_at: Date;
    id: string;
    status: string;
    invite_code: string;
    target_contact: string | null;
    expires_at: Date | null;
    inviter_id: string;
}[]>;
/**
 * Accept an invite
 */
export declare function acceptInvite(userId: string, inviteCode: string): Promise<{
    id: string;
    started_at: Date;
    status: string;
    user_b: string;
    user_a: string;
} | null>;
/**
 * Submit a check-in
 */
export declare function submitCheckin(userId: string, data: {
    buddy_link_id: string;
    note?: string | undefined;
}): Promise<{
    id: string;
    by_user: string;
    buddy_link_id: string;
    checkin_date: Date;
    note: string | null;
} | null>;
/**
 * Get check-ins
 */
export declare function getCheckins(userId: string, buddyLinkId?: string, limit?: number): Promise<({
    buddy_reactions: {
        created_at: Date;
        id: string;
        by_user: string;
        emoji: string;
        buddy_checkin_id: string;
    }[];
} & {
    id: string;
    by_user: string;
    buddy_link_id: string;
    checkin_date: Date;
    note: string | null;
})[]>;
/**
 * Send a message to buddy
 */
export declare function sendMessage(userId: string, data: {
    buddy_link_id: string;
    content: string;
}): Promise<{
    created_at: Date;
    id: string;
    content: string;
    buddy_link_id: string;
    sender_id: string;
} | null>;
/**
 * Get messages
 */
export declare function getMessages(userId: string, buddyLinkId: string, limit: number, offset: number): Promise<{
    created_at: Date;
    id: string;
    content: string;
    buddy_link_id: string;
    sender_id: string;
}[]>;
/**
 * Add reaction to check-in
 */
export declare function addReaction(userId: string, data: {
    buddy_checkin_id: string;
    emoji: string;
}): Promise<{
    created_at: Date;
    id: string;
    by_user: string;
    emoji: string;
    buddy_checkin_id: string;
} | null>;
/**
 * Get weekly summary
 */
export declare function getWeeklySummary(userId: string): Promise<{
    week_start: Date;
    week_end: Date;
    total_buddies: number;
    my_checkins: number;
    buddy_checkins: number;
    total_messages: number;
    total_reactions: number;
}>;
/**
 * Remove buddy link
 */
export declare function removeBuddyLink(userId: string, linkId: string): Promise<boolean>;
/**
 * Get buddy quick view for home screen
 */
export declare function getQuickView(userId: string): Promise<{
    total_buddies: number;
    completed_today: number;
    buddy_avatars: {
        user_id: string;
        name: string | null;
        avatar_url: string | null;
    }[];
}>;
/**
 * Get buddy profile with their shared habit progress
 */
export declare function getBuddyProfile(userId: string, buddyLinkId: string): Promise<{
    buddy_link_id: string;
    user_id: string;
    name: string;
    avatar_url: string | null | undefined;
    member_since: string | null | undefined;
    habit: string | null;
    journey: {
        current_day: number;
        total_days: number;
        progress: number;
        completed_today: boolean;
    } | null;
    streak: {
        current: number;
        longest: number;
        weekly_completion: Record<string, boolean>;
    };
    level: {
        current: number;
        name: string;
        progress: number;
        total_xp: number;
    };
    habit_health: number;
    recent_activity: {
        date: Date;
        note: string | null;
    }[];
    started_at: Date;
} | null>;
/**
 * Send a quick nudge to buddy
 */
export declare function sendNudge(userId: string, buddyLinkId: string, message: string): Promise<{
    created_at: Date;
    id: string;
    message: string;
    buddy_link_id: string;
    sender_id: string;
} | null>;
/**
 * Get nudges received
 */
export declare function getNudges(userId: string, limit?: number): Promise<{
    id: string;
    sender: {
        user_id: string;
        name: string;
        avatar_url: string | null | undefined;
    };
    message: string;
    created_at: Date;
}[]>;
/**
 * Resend an invite
 */
export declare function resendInvite(userId: string, inviteId: string): Promise<{
    created_at: Date;
    id: string;
    status: string;
    invite_code: string;
    target_contact: string | null;
    expires_at: Date | null;
    inviter_id: string;
} | null>;
/**
 * Cancel an invite
 */
export declare function cancelInvite(userId: string, inviteId: string): Promise<boolean>;
/**
 * Get invite by code
 */
export declare function getInviteByCode(inviteCode: string): Promise<{
    created_at: Date;
    id: string;
    status: string;
    invite_code: string;
    target_contact: string | null;
    expires_at: Date | null;
    inviter_id: string;
} | null>;
/**
 * Get invite URL
 */
export declare function getInviteUrl(inviteCode: string, baseUrl?: string): string;
/**
 * Get buddies who completed today
 */
export declare function getBuddiesCompletedToday(userId: string): Promise<{
    user_id: string;
    name: string;
    avatar_url: string | null;
}[]>;
//# sourceMappingURL=buddies.service.d.ts.map