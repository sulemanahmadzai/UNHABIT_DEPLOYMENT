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
    user_a: string;
    user_b: string;
} | null>;
/**
 * Submit a check-in
 */
export declare function submitCheckin(userId: string, data: {
    buddy_link_id: string;
    note?: string | undefined;
}): Promise<{
    id: string;
    buddy_link_id: string;
    by_user: string;
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
    buddy_link_id: string;
    by_user: string;
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
//# sourceMappingURL=buddies.service.d.ts.map