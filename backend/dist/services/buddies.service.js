import { db } from "../lib/services.js";
import { v4 as uuidv4 } from "uuid";
import { addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
/**
 * Get all buddies for a user
 */
export async function getBuddies(userId) {
    const links = await db.buddy_links.findMany({
        where: {
            OR: [{ user_a: userId }, { user_b: userId }],
            status: "active",
        },
        include: {
            users_buddy_links_user_aTousers: {
                select: {
                    id: true,
                    email: true,
                },
            },
            users_buddy_links_user_bTousers: {
                select: {
                    id: true,
                    email: true,
                },
            },
        },
    });
    // Get profiles for buddy users
    const buddyIds = links.map((l) => l.user_a === userId ? l.user_b : l.user_a);
    const profiles = await db.profiles.findMany({
        where: { user_id: { in: buddyIds } },
    });
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    return links.map((link) => {
        const buddyUserId = link.user_a === userId ? link.user_b : link.user_a;
        const buddyUser = link.user_a === userId
            ? link.users_buddy_links_user_bTousers
            : link.users_buddy_links_user_aTousers;
        const buddyProfile = profileMap.get(buddyUserId);
        return {
            buddy_link_id: link.id,
            buddy_user_id: buddyUserId,
            buddy_email: buddyUser.email,
            buddy_name: buddyProfile?.full_name || null,
            buddy_avatar: buddyProfile?.avatar_url || null,
            status: link.status,
            started_at: link.started_at,
        };
    });
}
/**
 * Create an invite link
 */
export async function createInvite(userId, data) {
    const inviteCode = uuidv4().replace(/-/g, "").substring(0, 12);
    const expiresAt = addDays(new Date(), data.expires_in_days);
    return db.buddy_invites.create({
        data: {
            inviter_id: userId,
            invite_code: inviteCode,
            target_contact: data.target_contact ?? null,
            expires_at: expiresAt,
            status: "pending",
        },
    });
}
/**
 * Get sent invites
 */
export async function getSentInvites(userId) {
    return db.buddy_invites.findMany({
        where: { inviter_id: userId },
        orderBy: { created_at: "desc" },
    });
}
/**
 * Accept an invite
 */
export async function acceptInvite(userId, inviteCode) {
    const invite = await db.buddy_invites.findFirst({
        where: {
            invite_code: inviteCode,
            status: "pending",
            expires_at: { gt: new Date() },
        },
    });
    if (!invite) {
        return null;
    }
    // Can't be buddies with yourself
    if (invite.inviter_id === userId) {
        throw new Error("Cannot accept your own invite");
    }
    // Check if already buddies
    const existingLink = await db.buddy_links.findFirst({
        where: {
            OR: [
                { user_a: invite.inviter_id, user_b: userId },
                { user_a: userId, user_b: invite.inviter_id },
            ],
        },
    });
    if (existingLink) {
        throw new Error("Already buddies with this user");
    }
    // Create buddy link and update invite in transaction
    const [buddyLink] = await db.$transaction([
        db.buddy_links.create({
            data: {
                user_a: invite.inviter_id,
                user_b: userId,
                status: "active",
            },
        }),
        db.buddy_invites.update({
            where: { id: invite.id },
            data: { status: "accepted" },
        }),
    ]);
    return buddyLink;
}
/**
 * Submit a check-in
 */
export async function submitCheckin(userId, data) {
    // Verify user is part of this buddy link
    const link = await db.buddy_links.findFirst({
        where: {
            id: data.buddy_link_id,
            OR: [{ user_a: userId }, { user_b: userId }],
            status: "active",
        },
    });
    if (!link) {
        return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return db.buddy_checkins.upsert({
        where: {
            buddy_link_id_by_user_checkin_date: {
                buddy_link_id: data.buddy_link_id,
                by_user: userId,
                checkin_date: today,
            },
        },
        create: {
            buddy_link_id: data.buddy_link_id,
            by_user: userId,
            checkin_date: today,
            note: data.note ?? null,
        },
        update: {
            note: data.note ?? null,
        },
    });
}
/**
 * Get check-ins
 */
export async function getCheckins(userId, buddyLinkId, limit = 30) {
    // Get user's buddy links
    const links = await db.buddy_links.findMany({
        where: {
            OR: [{ user_a: userId }, { user_b: userId }],
            status: "active",
            ...(buddyLinkId && { id: buddyLinkId }),
        },
        select: { id: true },
    });
    const linkIds = links.map((l) => l.id);
    return db.buddy_checkins.findMany({
        where: {
            buddy_link_id: { in: linkIds },
        },
        include: {
            buddy_reactions: true,
        },
        orderBy: { checkin_date: "desc" },
        take: limit,
    });
}
/**
 * Send a message to buddy
 */
export async function sendMessage(userId, data) {
    // Verify user is part of this buddy link
    const link = await db.buddy_links.findFirst({
        where: {
            id: data.buddy_link_id,
            OR: [{ user_a: userId }, { user_b: userId }],
            status: "active",
        },
    });
    if (!link) {
        return null;
    }
    return db.buddy_messages.create({
        data: {
            buddy_link_id: data.buddy_link_id,
            sender_id: userId,
            content: data.content,
        },
    });
}
/**
 * Get messages
 */
export async function getMessages(userId, buddyLinkId, limit, offset) {
    // Verify user is part of this buddy link
    const link = await db.buddy_links.findFirst({
        where: {
            id: buddyLinkId,
            OR: [{ user_a: userId }, { user_b: userId }],
        },
    });
    if (!link) {
        return [];
    }
    return db.buddy_messages.findMany({
        where: { buddy_link_id: buddyLinkId },
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
    });
}
/**
 * Add reaction to check-in
 */
export async function addReaction(userId, data) {
    // Verify check-in exists and user is part of the buddy link
    const checkin = await db.buddy_checkins.findFirst({
        where: { id: data.buddy_checkin_id },
        include: {
            buddy_links: true,
        },
    });
    if (!checkin) {
        return null;
    }
    const link = checkin.buddy_links;
    if (link.user_a !== userId && link.user_b !== userId) {
        return null;
    }
    return db.buddy_reactions.create({
        data: {
            buddy_checkin_id: data.buddy_checkin_id,
            by_user: userId,
            emoji: data.emoji,
        },
    });
}
/**
 * Get weekly summary
 */
export async function getWeeklySummary(userId) {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    // Get all buddy links
    const links = await db.buddy_links.findMany({
        where: {
            OR: [{ user_a: userId }, { user_b: userId }],
            status: "active",
        },
        select: { id: true },
    });
    const linkIds = links.map((l) => l.id);
    // Get check-ins this week
    const checkins = await db.buddy_checkins.findMany({
        where: {
            buddy_link_id: { in: linkIds },
            checkin_date: {
                gte: weekStart,
                lte: weekEnd,
            },
        },
        include: {
            buddy_reactions: true,
        },
    });
    // Get messages this week
    const messageCount = await db.buddy_messages.count({
        where: {
            buddy_link_id: { in: linkIds },
            created_at: {
                gte: weekStart,
                lte: weekEnd,
            },
        },
    });
    const myCheckins = checkins.filter((c) => c.by_user === userId).length;
    const buddyCheckins = checkins.filter((c) => c.by_user !== userId).length;
    const totalReactions = checkins.reduce((sum, c) => sum + c.buddy_reactions.length, 0);
    return {
        week_start: weekStart,
        week_end: weekEnd,
        total_buddies: links.length,
        my_checkins: myCheckins,
        buddy_checkins: buddyCheckins,
        total_messages: messageCount,
        total_reactions: totalReactions,
    };
}
/**
 * Remove buddy link
 */
export async function removeBuddyLink(userId, linkId) {
    const link = await db.buddy_links.findFirst({
        where: {
            id: linkId,
            OR: [{ user_a: userId }, { user_b: userId }],
        },
    });
    if (!link) {
        return false;
    }
    await db.buddy_links.update({
        where: { id: linkId },
        data: { status: "removed" },
    });
    return true;
}
//# sourceMappingURL=buddies.service.js.map