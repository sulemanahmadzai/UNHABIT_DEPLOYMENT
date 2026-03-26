import { db } from "../lib/services.js";

interface PrimeTimeWindow {
  dow: number;
  start_minute: number;
  end_minute: number;
}

interface QuietHoursData {
  start_minute: number;
  end_minute: number;
}

/**
 * Get notification preferences
 */
export async function getPreferences(userId: string) {
  const prefs = await db.user_nudge_prefs.findUnique({
    where: { user_id: userId },
  });

  // Return defaults if no preferences exist
  return (
    prefs || {
      user_id: userId,
      enabled: true,
      max_per_day: 5,
      escalate_to_buddy: false,
    }
  );
}

/**
 * Update notification preferences
 */
export async function updatePreferences(
  userId: string,
  data: {
    enabled?: boolean | undefined;
    max_per_day?: number | undefined;
    escalate_to_buddy?: boolean | undefined;
  }
) {
  return db.user_nudge_prefs.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      enabled: data.enabled ?? true,
      max_per_day: data.max_per_day ?? 5,
      escalate_to_buddy: data.escalate_to_buddy ?? false,
    },
    update: {
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.max_per_day !== undefined && { max_per_day: data.max_per_day }),
      ...(data.escalate_to_buddy !== undefined && {
        escalate_to_buddy: data.escalate_to_buddy,
      }),
    },
  });
}

/**
 * Get scheduled nudges
 */
export async function getScheduledNudges(userId: string, limit: number) {
  return db.scheduled_nudges.findMany({
    where: {
      user_id: userId,
      scheduled_for: {
        gte: new Date(),
      },
    },
    include: {
      journey_tasks: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { scheduled_for: "asc" },
    take: limit,
  });
}

/**
 * Set prime time windows
 */
export async function setPrimeTimeWindows(
  userId: string,
  windows: PrimeTimeWindow[]
) {
  // Delete existing windows
  await db.prime_time_windows.deleteMany({
    where: { user_id: userId },
  });

  // Create new windows
  if (windows.length > 0) {
    await db.prime_time_windows.createMany({
      data: windows.map((w) => ({
        user_id: userId,
        dow: w.dow,
        start_minute: w.start_minute,
        end_minute: w.end_minute,
      })),
    });
  }

  return getPrimeTimeWindows(userId);
}

/**
 * Get prime time windows
 */
export async function getPrimeTimeWindows(userId: string) {
  return db.prime_time_windows.findMany({
    where: { user_id: userId },
    orderBy: [{ dow: "asc" }, { start_minute: "asc" }],
  });
}

/**
 * Set quiet hours
 */
export async function setQuietHours(userId: string, data: QuietHoursData) {
  // Delete existing quiet hours
  await db.quiet_hours.deleteMany({
    where: { user_id: userId },
  });

  // Create new quiet hours
  return db.quiet_hours.create({
    data: {
      user_id: userId,
      start_minute: data.start_minute,
      end_minute: data.end_minute,
    },
  });
}

/**
 * Get quiet hours
 */
export async function getQuietHours(userId: string) {
  return db.quiet_hours.findMany({
    where: { user_id: userId },
  });
}

/**
 * Get notification delivery history
 */
export async function getDeliveryHistory(
  userId: string,
  limit: number,
  offset: number
) {
  const nudges = await db.scheduled_nudges.findMany({
    where: { user_id: userId },
    include: {
      nudge_deliveries: {
        orderBy: { sent_at: "desc" },
      },
      journey_tasks: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { scheduled_for: "desc" },
    take: limit,
    skip: offset,
  });

  // Flatten to delivery records
  const deliveries = [];
  for (const nudge of nudges) {
    for (const delivery of nudge.nudge_deliveries) {
      deliveries.push({
        id: delivery.id,
        scheduled_nudge_id: nudge.id,
        scheduled_for: nudge.scheduled_for,
        channel: nudge.channel,
        reason: nudge.reason,
        task: nudge.journey_tasks,
        sent_at: delivery.sent_at,
        status: delivery.status,
        opened_at: delivery.opened_at,
        engaged: delivery.engaged,
      });
    }
  }

  return deliveries;
}

/**
 * Add a task reminder
 */
export async function addTaskReminder(
  userId: string,
  data: {
    journey_task_id: string;
    remind_at: Date;
  }
) {
  // Verify task ownership
  const task = await db.journey_tasks.findFirst({
    where: { id: data.journey_task_id },
    include: {
      journey_days: {
        include: { journeys: true },
      },
    },
  });

  if (!task || task.journey_days.journeys.user_id !== userId) {
    return null;
  }

  return db.task_reminders.create({
    data: {
      user_id: userId,
      journey_task_id: data.journey_task_id,
      remind_at: data.remind_at,
    },
  });
}

/**
 * Get task reminders
 */
export async function getTaskReminders(userId: string) {
  return db.task_reminders.findMany({
    where: {
      user_id: userId,
      remind_at: { gte: new Date() },
    },
    include: {
      journey_tasks: {
        select: {
          id: true,
          title: true,
          kind: true,
        },
      },
    },
    orderBy: { remind_at: "asc" },
  });
}

/**
 * Delete a task reminder
 */
export async function deleteTaskReminder(userId: string, reminderId: string) {
  const reminder = await db.task_reminders.findFirst({
    where: {
      id: reminderId,
      user_id: userId,
    },
  });

  if (!reminder) {
    return false;
  }

  await db.task_reminders.delete({
    where: { id: reminderId },
  });

  return true;
}

