/**
 * Notifications Feed Service
 * Handles user notification feed (using nudge_deliveries as notification source)
 */

import { db } from "../lib/services.js";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: Date;
  is_read: boolean;
  icon_name?: string;
  action_data?: Record<string, unknown>;
  related_entity_id?: string;
}

/**
 * Get all notifications for a user
 */
export async function getNotifications(
  userId: string,
  options: {
    status?: "read" | "unread";
    type?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { status, type, limit = 50, offset = 0 } = options;

  // Get nudge deliveries for the user
  const deliveries = await db.nudge_deliveries.findMany({
    where: {
      scheduled_nudges: {
        user_id: userId,
      },
      ...(status === "read" && { opened_at: { not: null } }),
      ...(status === "unread" && { opened_at: null }),
    },
    include: {
      scheduled_nudges: {
        include: {
          journey_tasks: {
            include: {
              journey_days: {
                include: {
                  journeys: {
                    include: {
                      user_habits: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { sent_at: "desc" },
    take: limit,
    skip: offset,
  });

  // Transform to notification format
  const notifications: NotificationItem[] = deliveries.map((delivery) => {
    const nudge = delivery.scheduled_nudges;
    const reason = nudge.reason || "reminder";

    // Determine notification type and content based on reason
    let notificationType = "reminder";
    let title = "Daily Reminder";
    let message = "Time for today's habit";
    let iconName = "clock";

    if (reason.includes("streak") || reason.includes("at_risk")) {
      notificationType = "daily_motivation";
      title = "Daily Motivation";
      message = "Only a few hours left to save your streak!";
      iconName = "warning";
    } else if (reason.includes("completion") || reason.includes("completed")) {
      notificationType = "daily_completion";
      title = "Daily Completion";
      message = "You completed today's tasks!";
      iconName = "confetti";
    } else if (reason.includes("badge")) {
      notificationType = "badge_progress";
      title = "Badge Progress";
      message = "You're making progress towards a badge!";
      iconName = "shield";
    } else if (reason.includes("buddy")) {
      notificationType = "buddy_nudge";
      title = "Buddy Nudge";
      message = "You received a nudge from a buddy";
      iconName = "speech_bubble";
    }

    return {
      id: delivery.id,
      type: notificationType,
      title,
      message,
      created_at: delivery.sent_at || delivery.scheduled_nudges.scheduled_for || new Date(),
      is_read: delivery.opened_at !== null,
      icon_name: iconName,
      action_data: {
        button_text: notificationType === "daily_motivation" ? "Go to Today's Tasks" : undefined,
        route: notificationType === "daily_motivation" ? "/tasks/today" : undefined,
      },
      related_entity_id: nudge.journey_task_id || undefined,
    };
  });

  // Also include buddy-related notifications (received nudges)
  const buddyLinks = await db.buddy_links.findMany({
    where: {
      OR: [{ user_a: userId }, { user_b: userId }],
      status: "active",
    },
  });

  const buddyLinkIds = buddyLinks.map(l => l.id);

  if (buddyLinkIds.length > 0) {
    const buddyNudges = await db.buddy_nudges.findMany({
      where: {
        buddy_link_id: { in: buddyLinkIds },
        sender_id: { not: userId }, // Only received nudges
      },
      include: {
        buddy_links: true,
      },
      orderBy: { created_at: "desc" },
      take: Math.min(limit || 50, 20), // Limit buddy nudges separately
    });

    // Get profiles for senders
    const senderIds = buddyNudges.map(n => n.sender_id);
    const senderProfiles = await db.profiles.findMany({
      where: { user_id: { in: senderIds } },
    });
    const profileMap = new Map(senderProfiles.map(p => [p.user_id, p]));

    const buddyNotifications: NotificationItem[] = buddyNudges.map((nudge) => {
      const buddyProfile = profileMap.get(nudge.sender_id);
      
      return {
        id: nudge.id,
        type: "buddy_nudge",
        title: "Buddy Nudge",
        message: `You received a nudge from ${buddyProfile?.full_name || "a buddy"}`,
        created_at: nudge.created_at || new Date(),
        is_read: false, // Buddy nudges don't have read status yet
        icon_name: "speech_bubble",
        related_entity_id: nudge.buddy_link_id,
      };
    });

    // Combine and sort by date
    const allNotifications = [...notifications, ...buddyNotifications].sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime()
    );

    return allNotifications.slice(0, limit);
  }

  return notifications;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(userId: string, notificationId: string) {
  // For nudge deliveries
  const delivery = await db.nudge_deliveries.findFirst({
    where: {
      id: notificationId,
      scheduled_nudges: {
        user_id: userId,
      },
    },
  });

  if (delivery) {
    return db.nudge_deliveries.update({
      where: { id: notificationId },
      data: { opened_at: new Date() },
    });
  }

  // Buddy nudges don't have read status yet, so just return success
  // Check if this is a buddy nudge for this user
  const buddyLinks = await db.buddy_links.findMany({
    where: {
      OR: [{ user_a: userId }, { user_b: userId }],
      status: "active",
    },
  });

  const buddyLinkIds = buddyLinks.map(l => l.id);

  if (buddyLinkIds.length > 0) {
    const buddyNudge = await db.buddy_nudges.findFirst({
      where: {
        id: notificationId,
        buddy_link_id: { in: buddyLinkIds },
      },
    });

    if (buddyNudge) {
      // Buddy nudges don't have read status in DB, so just return success
      return { id: notificationId, read: true };
    }
  }

  return null;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId: string) {
  const deliveries = await db.nudge_deliveries.findMany({
    where: {
      scheduled_nudges: {
        user_id: userId,
      },
      opened_at: null,
    },
  });

  if (deliveries.length > 0) {
    await db.nudge_deliveries.updateMany({
      where: {
        id: { in: deliveries.map(d => d.id) },
      },
      data: { opened_at: new Date() },
    });
  }

  return { marked: deliveries.length };
}

/**
 * Delete a notification
 */
export async function deleteNotification(userId: string, notificationId: string) {
  // Check if it's a nudge delivery
  const delivery = await db.nudge_deliveries.findFirst({
    where: {
      id: notificationId,
      scheduled_nudges: {
        user_id: userId,
      },
    },
  });

  if (delivery) {
    // Don't actually delete, just mark as read/hidden
    await db.nudge_deliveries.update({
      where: { id: notificationId },
      data: { opened_at: new Date() },
    });
    return true;
  }

  // Buddy nudges - can't delete, just return success
  const buddyLinks = await db.buddy_links.findMany({
    where: {
      OR: [{ user_a: userId }, { user_b: userId }],
      status: "active",
    },
  });

  const buddyLinkIds = buddyLinks.map(l => l.id);

  if (buddyLinkIds.length > 0) {
    const buddyNudge = await db.buddy_nudges.findFirst({
      where: {
        id: notificationId,
        buddy_link_id: { in: buddyLinkIds },
      },
    });

    return buddyNudge !== null;
  }

  return false;
}
