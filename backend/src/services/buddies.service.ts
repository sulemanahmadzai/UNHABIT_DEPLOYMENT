import { db } from "../lib/services.js";
import { v4 as uuidv4 } from "uuid";
import { addDays, subDays, startOfWeek, endOfWeek } from "date-fns";

/**
 * Get all buddies for a user
 */
export async function getBuddies(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
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
  const buddyIds = links.map((l) =>
    l.user_a === userId ? l.user_b : l.user_a
  );

  if (buddyIds.length === 0) return [];

  const [profiles, streaks, todayCompletions] = await Promise.all([
    db.profiles.findMany({
      where: { user_id: { in: buddyIds } },
    }),
    db.streaks.findMany({
      where: { 
        user_id: { in: buddyIds },
        kind: "task_completion"
      },
    }),
    // Get buddies who completed tasks today
    db.user_task_progress.findMany({
      where: {
        user_id: { in: buddyIds },
        status: "completed",
        completed_at: { gte: today },
      },
      select: { user_id: true },
      distinct: ["user_id"],
    }),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  const streakMap = new Map(streaks.map((s) => [s.user_id, s]));
  const completedTodaySet = new Set(todayCompletions.map(c => c.user_id));

  // Get active journeys to check for pending/missed status
  const activeJourneys = await db.journeys.findMany({
    where: {
      user_id: { in: buddyIds },
      status: "active",
    },
    include: {
      journey_days: {
        include: {
          journey_tasks: {
            include: {
              user_task_progress: {
                where: {
                  user_id: { in: buddyIds },
                  status: "completed",
                },
              },
            },
          },
        },
      },
    },
  });

  const journeyMap = new Map(activeJourneys.map(j => [j.user_id, j]));

  return links.map((link) => {
    const buddyUserId = link.user_a === userId ? link.user_b : link.user_a;
    const buddyUser =
      link.user_a === userId
        ? link.users_buddy_links_user_bTousers
        : link.users_buddy_links_user_aTousers;
    const buddyProfile = profileMap.get(buddyUserId);
    const buddyStreak = streakMap.get(buddyUserId);
    const completedToday = completedTodaySet.has(buddyUserId);
    const activeJourney = journeyMap.get(buddyUserId);

    // Determine daily status: COMPLETED, PENDING, or MISSED
    let dailyStatus: "COMPLETED" | "PENDING" | "MISSED" = "PENDING";
    
    if (completedToday) {
      dailyStatus = "COMPLETED";
    } else if (activeJourney && activeJourney.start_date) {
      // Check if there are tasks for today
      const startDate = new Date(activeJourney.start_date);
      startDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const todayDay = activeJourney.journey_days.find(d => d.day_number === diffDays + 1);
      
      if (todayDay && todayDay.journey_tasks.length > 0) {
        // Has tasks but not completed - could be PENDING or MISSED
        // For simplicity, mark as PENDING if it's still today, MISSED if past
        const now = new Date();
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59);
        dailyStatus = now <= endOfDay ? "PENDING" : "MISSED";
      }
    }

    return {
      buddy_link_id: link.id,
      buddy_user_id: buddyUserId,
      buddy_email: buddyUser.email,
      buddy_name: buddyProfile?.full_name || null,
      buddy_avatar: buddyProfile?.avatar_url || null,
      status: link.status,
      started_at: link.started_at,
      streak_days: buddyStreak?.current_length ?? 0,
      daily_status: dailyStatus, // NEW: PENDING, COMPLETED, or MISSED
    };
  });
}

/**
 * Create an invite link
 */
export async function createInvite(
  userId: string,
  data: {
    target_contact?: string | undefined;
    expires_in_days: number;
  }
) {
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
export async function getSentInvites(userId: string) {
  return db.buddy_invites.findMany({
    where: { inviter_id: userId },
    orderBy: { created_at: "desc" },
  });
}

/**
 * Accept an invite
 */
export async function acceptInvite(userId: string, inviteCode: string) {
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
export async function submitCheckin(
  userId: string,
  data: {
    buddy_link_id: string;
    note?: string | undefined;
  }
) {
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
export async function getCheckins(
  userId: string,
  buddyLinkId?: string,
  limit: number = 30
) {
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
export async function sendMessage(
  userId: string,
  data: {
    buddy_link_id: string;
    content: string;
  }
) {
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
export async function getMessages(
  userId: string,
  buddyLinkId: string,
  limit: number,
  offset: number
) {
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
export async function addReaction(
  userId: string,
  data: {
    buddy_checkin_id: string;
    emoji: string;
  }
) {
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
export async function getWeeklySummary(userId: string) {
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
  const totalReactions = checkins.reduce(
    (sum, c) => sum + c.buddy_reactions.length,
    0
  );

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
export async function removeBuddyLink(userId: string, linkId: string) {
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

/**
 * Get buddy quick view for home screen
 */
export async function getQuickView(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all buddy links
  const links = await db.buddy_links.findMany({
    where: {
      OR: [{ user_a: userId }, { user_b: userId }],
      status: "active",
    },
  });

  const buddyIds = links.map(link =>
    link.user_a === userId ? link.user_b : link.user_a
  );

  // Get buddies who completed tasks today
  const completedToday = await db.user_task_progress.groupBy({
    by: ["user_id"],
    where: {
      user_id: { in: buddyIds },
      status: "completed",
      completed_at: { gte: today },
    },
  });

  // Get buddy profiles
  const profiles = await db.profiles.findMany({
    where: { user_id: { in: buddyIds } },
    take: 3, // Show max 3 avatars
  });

  return {
    total_buddies: buddyIds.length,
    completed_today: completedToday.length,
    buddy_avatars: profiles.map(p => ({
      user_id: p.user_id,
      name: p.full_name,
      avatar_url: p.avatar_url,
    })),
  };
}

/**
 * Get buddy profile with their shared habit progress
 */
export async function getBuddyProfile(userId: string, buddyLinkId: string) {
  // Verify user is part of this buddy link
  const link = await db.buddy_links.findFirst({
    where: {
      id: buddyLinkId,
      OR: [{ user_a: userId }, { user_b: userId }],
      status: "active",
    },
  });

  if (!link) {
    return null;
  }

  const buddyUserId = link.user_a === userId ? link.user_b : link.user_a;

  // Get buddy profile
  const profile = await db.profiles.findUnique({
    where: { user_id: buddyUserId },
  });

  // Get buddy's active journey
  const activeJourney = await db.journeys.findFirst({
    where: {
      user_id: buddyUserId,
      status: "active",
    },
    include: {
      user_habits: true,
      journey_days: {
        include: {
          journey_tasks: {
            include: {
              user_task_progress: {
                where: { user_id: buddyUserId },
              },
            },
          },
        },
      },
    },
  });

  // Get buddy's streak
  const streak = await db.streaks.findFirst({
    where: { user_id: buddyUserId, kind: "task_completion" },
  });

  // Calculate current day if journey exists
  let currentDay = 0;
  let totalDays = 0;
  let completedToday = false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (activeJourney && activeJourney.start_date) {
    const startDate = new Date(activeJourney.start_date);
    startDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - startDate.getTime();
    currentDay = Math.min(Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1, activeJourney.planned_days);
    totalDays = activeJourney.planned_days;

    // Check if completed today
    const todaysTasks = activeJourney.journey_days.find(d => d.day_number === currentDay);
    if (todaysTasks) {
      const allCompleted = todaysTasks.journey_tasks.every(
        t => t.user_task_progress.some(p => p.status === "completed")
      );
      completedToday = allCompleted && todaysTasks.journey_tasks.length > 0;
    }
  }

  // Get recent check-ins
  const recentCheckins = await db.buddy_checkins.findMany({
    where: {
      buddy_link_id: buddyLinkId,
      by_user: buddyUserId,
    },
    orderBy: { checkin_date: "desc" },
    take: 7,
  });

  // Get buddy's level and XP
  const pointBalance = await db.point_balances.findUnique({
    where: { user_id: buddyUserId },
  });
  const totalXP = Number(pointBalance?.total_points ?? 0);
  
  // Calculate level (Level formula: Each level requires level * 100 XP)
  let level = 1;
  let xpForCurrentLevel = 0;
  let xpForNextLevel = 100;
  for (let l = 1; l <= 100; l++) {
    const xpNeeded = l * 100;
    if (totalXP >= xpNeeded) {
      level = l + 1;
      xpForCurrentLevel = xpNeeded;
      xpForNextLevel = (l + 1) * 100;
    } else {
      break;
    }
  }
  const levelProgress = xpForNextLevel > xpForCurrentLevel 
    ? Math.round(((totalXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100)
    : 0;

  // Calculate habit health
  let habitHealth = 0;
  if (activeJourney) {
    let totalTasks = 0;
    let completedTasks = 0;
    for (const day of activeJourney.journey_days) {
      for (const task of day.journey_tasks) {
        totalTasks++;
        if (task.user_task_progress.some(p => p.status === "completed")) {
          completedTasks++;
        }
      }
    }
    habitHealth = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  }

  // Get weekly completion status (Mon-Sun)
  const weeklyCompletion: Record<string, boolean> = {};
  if (activeJourney && activeJourney.start_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(activeJourney.start_date);
    startDate.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(weekStart);
      checkDate.setDate(weekStart.getDate() + i);
      const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
      
      const diffDays = Math.floor((checkDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayData = activeJourney.journey_days.find(d => d.day_number === diffDays + 1);
      
      if (dayData && dayData.journey_tasks.length > 0) {
        const allCompleted = dayData.journey_tasks.every(
          t => t.user_task_progress.some(p => p.status === "completed")
        );
        weeklyCompletion[dayName] = allCompleted;
      } else {
        weeklyCompletion[dayName] = false;
      }
    }
  }

  return {
    buddy_link_id: buddyLinkId,
    user_id: buddyUserId,
    name: profile?.full_name ?? "Anonymous",
    avatar_url: profile?.avatar_url,
    member_since: profile?.created_at ? new Date(profile.created_at).toISOString().split('T')[0] : null,
    habit: activeJourney?.user_habits?.goal_text ?? null,
    journey: activeJourney ? {
      current_day: currentDay,
      total_days: totalDays,
      progress: Math.round((currentDay / totalDays) * 100),
      completed_today: completedToday,
    } : null,
    streak: {
      current: streak?.current_length ?? 0,
      longest: streak?.best_length ?? 0,
      weekly_completion: weeklyCompletion, // NEW: Weekly completion status
    },
    level: {
      current: level,
      name: getLevelName(level), // e.g., "Builder", "Warrior"
      progress: levelProgress,
      total_xp: totalXP,
    },
    habit_health: habitHealth, // NEW: Habit health percentage
    recent_activity: recentCheckins.map(c => ({
      date: c.checkin_date,
      note: c.note,
    })),
    started_at: link.started_at,
  };
}

/**
 * Get level name from level number
 */
function getLevelName(level: number): string {
  const names = [
    "Beginner", "Builder", "Warrior", "Champion", "Master", "Legend", "Elite"
  ];
  if (level <= 3) return names[level - 1] || "Beginner";
  if (level <= 10) return names[3] || "Champion";
  if (level <= 20) return names[4] || "Master";
  if (level <= 50) return names[5] || "Legend";
  return names[6] || "Elite";
}

/**
 * Send a quick nudge to buddy
 */
export async function sendNudge(
  userId: string,
  buddyLinkId: string,
  message: string
) {
  // Verify user is part of this buddy link
  const link = await db.buddy_links.findFirst({
    where: {
      id: buddyLinkId,
      OR: [{ user_a: userId }, { user_b: userId }],
      status: "active",
    },
  });

  if (!link) {
    return null;
  }

  // Create nudge
  return db.buddy_nudges.create({
    data: {
      buddy_link_id: buddyLinkId,
      sender_id: userId,
      message,
    },
  });
}

/**
 * Get nudges received
 */
export async function getNudges(userId: string, limit = 20) {
  // Get all buddy links where user is the recipient
  const links = await db.buddy_links.findMany({
    where: {
      OR: [{ user_a: userId }, { user_b: userId }],
      status: "active",
    },
    select: { id: true, user_a: true, user_b: true },
  });

  const linkIds = links.map(l => l.id);

  // Get nudges not sent by the current user
  const nudges = await db.buddy_nudges.findMany({
    where: {
      buddy_link_id: { in: linkIds },
      sender_id: { not: userId },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  // Get sender profiles
  const senderIds = [...new Set(nudges.map(n => n.sender_id))];
  const profiles = await db.profiles.findMany({
    where: { user_id: { in: senderIds } },
  });
  const profileMap = new Map(profiles.map(p => [p.user_id, p]));

  return nudges.map(nudge => ({
    id: nudge.id,
    sender: {
      user_id: nudge.sender_id,
      name: profileMap.get(nudge.sender_id)?.full_name ?? "Anonymous",
      avatar_url: profileMap.get(nudge.sender_id)?.avatar_url,
    },
    message: nudge.message,
    created_at: nudge.created_at,
  }));
}

/**
 * Resend an invite
 */
export async function resendInvite(userId: string, inviteId: string) {
  const invite = await db.buddy_invites.findFirst({
    where: {
      id: inviteId,
      inviter_id: userId,
      status: "pending",
    },
  });

  if (!invite) {
    return null;
  }

  // Update expires_at to 7 days from now
  return db.buddy_invites.update({
    where: { id: inviteId },
    data: {
      expires_at: addDays(new Date(), 7),
    },
  });
}

/**
 * Cancel an invite
 */
export async function cancelInvite(userId: string, inviteId: string) {
  const invite = await db.buddy_invites.findFirst({
    where: {
      id: inviteId,
      inviter_id: userId,
      status: "pending",
    },
  });

  if (!invite) {
    return false;
  }

  await db.buddy_invites.update({
    where: { id: inviteId },
    data: { status: "cancelled" },
  });

  return true;
}

/**
 * Get invite by code
 */
export async function getInviteByCode(inviteCode: string) {
  return db.buddy_invites.findFirst({
    where: {
      invite_code: inviteCode,
    },
  });
}

/**
 * Get invite URL
 */
export function getInviteUrl(inviteCode: string, baseUrl?: string) {
  const base = baseUrl || process.env.APP_BASE_URL || "https://unhabit.app";
  return `${base}/invite/${inviteCode}`;
}

/**
 * Get buddies who completed today
 */
export async function getBuddiesCompletedToday(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all buddy IDs
  const links = await db.buddy_links.findMany({
    where: {
      OR: [{ user_a: userId }, { user_b: userId }],
      status: "active",
    },
  });

  const buddyIds = links.map(link =>
    link.user_a === userId ? link.user_b : link.user_a
  );

  if (buddyIds.length === 0) return [];

  // Get buddies who completed tasks today
  const completions = await db.user_task_progress.findMany({
    where: {
      user_id: { in: buddyIds },
      status: "completed",
      completed_at: { gte: today },
    },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const completedUserIds = completions.map(c => c.user_id);

  // Get profiles
  const profiles = await db.profiles.findMany({
    where: { user_id: { in: completedUserIds } },
  });

  return profiles.map(p => ({
    user_id: p.user_id,
    name: p.full_name ?? "Anonymous",
    avatar_url: p.avatar_url,
  }));
}

