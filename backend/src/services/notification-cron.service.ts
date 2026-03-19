import { db } from "../lib/services.js";
import { sendPushNotifications, checkPushReceipts } from "./push-notifications.service.js";
import type { ExpoPushReceipt } from "expo-server-sdk";

type Logger = Pick<Console, "log" | "error" | "warn">;

function getLocalParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  const hour = Number(map.get("hour") ?? "0");
  const minute = Number(map.get("minute") ?? "0");
  const weekday = map.get("weekday") ?? "Sun";

  const dow =
    weekday === "Sun"
      ? 0
      : weekday === "Mon"
        ? 1
        : weekday === "Tue"
          ? 2
          : weekday === "Wed"
            ? 3
            : weekday === "Thu"
              ? 4
              : weekday === "Fri"
                ? 5
                : 6;

  return { minuteOfDay: hour * 60 + minute, dow };
}

function isInQuietHours(minuteOfDay: number, start: number, end: number) {
  if (start === end) return false;
  // Non-wrapping window
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  // Wrapping over midnight
  return minuteOfDay >= start || minuteOfDay < end;
}

function isInPrimeTime(minuteOfDay: number, windows: Array<{ start_minute: number; end_minute: number }>) {
  if (windows.length === 0) return true; // no prime time configured => allow
  return windows.some((w) => {
    if (w.start_minute === w.end_minute) return false;
    if (w.start_minute < w.end_minute) return minuteOfDay >= w.start_minute && minuteOfDay < w.end_minute;
    return minuteOfDay >= w.start_minute || minuteOfDay < w.end_minute;
  });
}

async function getUserDeliveryGate(userId: string, now: Date) {
  const profile = await db.profiles.findUnique({ where: { user_id: userId } });
  const timeZone = profile?.timezone || "UTC";
  const { minuteOfDay, dow } = getLocalParts(now, timeZone);

  const [prefs, quiet, prime] = await Promise.all([
    db.user_nudge_prefs.findUnique({ where: { user_id: userId } }),
    db.quiet_hours.findMany({ where: { user_id: userId } }),
    db.prime_time_windows.findMany({ where: { user_id: userId, dow }, orderBy: { start_minute: "asc" } }),
  ]);

  const enabled = prefs?.enabled ?? true;
  if (!enabled) return { allowed: false, reason: "disabled" as const };

  const quietHours = quiet[0];
  if (quietHours && isInQuietHours(minuteOfDay, quietHours.start_minute, quietHours.end_minute)) {
    return { allowed: false, reason: "quiet_hours" as const };
  }

  if (!isInPrimeTime(minuteOfDay, prime)) {
    return { allowed: false, reason: "outside_prime_time" as const };
  }

  return { allowed: true as const, timeZone };
}

async function getUserPushTokens(userId: string) {
  const devices = await db.devices.findMany({
    where: { user_id: userId, push_token: { not: null } },
    orderBy: { created_at: "desc" },
  });
  const tokens = devices.map((d) => d.push_token).filter((t): t is string => !!t);
  // dedupe (defensive)
  return Array.from(new Set(tokens));
}

export async function processDueTaskReminders(now: Date, logger: Logger = console) {
  const reminders = await db.task_reminders.findMany({
    where: { sent: false, remind_at: { lte: now } },
    include: {
      journey_tasks: { select: { id: true, title: true } },
    },
    orderBy: { remind_at: "asc" },
    take: 200,
  });

  for (const r of reminders) {
    const gate = await getUserDeliveryGate(r.user_id, now);
    if (!gate.allowed) continue;

    const tokens = await getUserPushTokens(r.user_id);
    if (tokens.length === 0) {
      // Mark as sent so it doesn't loop forever (no device registered)
      await db.task_reminders.update({ where: { id: r.id }, data: { sent: true } });
      continue;
    }

    const res = await sendPushNotifications(
      tokens,
      "Task Reminder",
      `Don't forget: ${r.journey_tasks.title}`,
      {
        screen: "JourneyDayView",
        // params as string for NotificationManager JSON.parse
        params: JSON.stringify({ journeyTaskId: r.journey_task_id }),
        kind: "task_reminder",
        journey_task_id: r.journey_task_id,
      }
    );

    logger.log(`[push] reminders sent`, { reminderId: r.id, userId: r.user_id, count: res.tickets.length });

    await db.task_reminders.update({ where: { id: r.id }, data: { sent: true } });
    // We don't have a delivery table for reminders; receipts handled via device cleanup on next runs.
  }
}

export async function processDueScheduledNudges(now: Date, logger: Logger = console) {
  const nudges = await db.scheduled_nudges.findMany({
    where: {
      channel: "push",
      scheduled_for: { lte: now },
      nudge_deliveries: {
        none: { sent_at: { not: null } },
      },
    },
    orderBy: { scheduled_for: "asc" },
    take: 200,
  });

  for (const n of nudges) {
    const gate = await getUserDeliveryGate(n.user_id, now);
    if (!gate.allowed) continue;

    const tokens = await getUserPushTokens(n.user_id);
    if (tokens.length === 0) {
      await db.nudge_deliveries.create({
        data: {
          scheduled_nudge_id: n.id,
          sent_at: now,
          status: "skipped_no_device",
          meta: { reason: "no_push_tokens" },
        },
      });
      continue;
    }

    const title = "Unhabit Reminder";
    const body = n.reason?.includes("streak") ? "Only a few hours left to save your streak!" : "Time for today's habit.";

    const res = await sendPushNotifications(tokens, title, body, {
      screen: "Notifications",
      params: JSON.stringify({}),
      kind: "scheduled_nudge",
      scheduled_nudge_id: n.id,
      journey_task_id: n.journey_task_id ?? undefined,
    });

    const receiptPairs = res.tokenTicketPairs
      .filter((p) => p.receiptId)
      .map((p) => ({ token: p.token, receiptId: p.receiptId }));

    await db.nudge_deliveries.create({
      data: {
        scheduled_nudge_id: n.id,
        sent_at: now,
        status: "sent",
        meta: {
          receipt_pairs: receiptPairs,
          receipts_checked: false,
        },
      },
    });

    logger.log(`[push] scheduled_nudge sent`, { nudgeId: n.id, userId: n.user_id, count: res.tickets.length });
  }
}

export async function processPushReceipts(now: Date, logger: Logger = console) {
  const deliveries = await db.nudge_deliveries.findMany({
    where: {
      status: "sent",
      sent_at: { lte: new Date(now.getTime() - 60_000) }, // give Expo some time
    },
    orderBy: { sent_at: "asc" },
    take: 200,
  });

  const toCheck: Array<{ deliveryId: string; pairs: Array<{ token: string; receiptId: string }> }> = [];

  for (const d of deliveries) {
    const meta = (d.meta ?? {}) as any;
    if (meta.receipts_checked) continue;
    const pairs = Array.isArray(meta.receipt_pairs) ? meta.receipt_pairs : [];
    const filtered = pairs.filter((p: any) => p?.token && p?.receiptId);
    if (filtered.length) toCheck.push({ deliveryId: d.id, pairs: filtered });
  }

  const receiptIds = Array.from(new Set(toCheck.flatMap((x) => x.pairs.map((p) => p.receiptId))));
  if (receiptIds.length === 0) return;

  const receipts = await checkPushReceipts(receiptIds);

  for (const item of toCheck) {
    const badTokens: string[] = [];
    for (const p of item.pairs) {
      const r = (receipts as any)[p.receiptId] as ExpoPushReceipt | undefined;
      if (!r) continue;
      if (r.status === "error") {
        const details: any = (r as any).details;
        const code = details?.error;
        if (code === "DeviceNotRegistered") badTokens.push(p.token);
      }
    }

    if (badTokens.length) {
      await db.devices.deleteMany({ where: { push_token: { in: badTokens } } });
      logger.warn(`[push] removed invalid tokens`, { deliveryId: item.deliveryId, count: badTokens.length });
    }

    await db.nudge_deliveries.update({
      where: { id: item.deliveryId },
      data: {
        meta: {
          ...(deliveries.find((d) => d.id === item.deliveryId)?.meta as any),
          receipts_checked: true,
          receipts_checked_at: now.toISOString(),
        },
      },
    });
  }
}

export function startNotificationCron(options: { intervalMs?: number; logger?: Logger } = {}) {
  const intervalMs = options.intervalMs ?? 60_000;
  const logger = options.logger ?? console;

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    const now = new Date();
    try {
      await processDueTaskReminders(now, logger);
      await processDueScheduledNudges(now, logger);
      await processPushReceipts(now, logger);
    } catch (e) {
      logger.error("[push] cron tick failed", e);
    } finally {
      running = false;
    }
  };

  // Fire quickly, then interval
  void tick();
  const handle = setInterval(() => void tick(), intervalMs);

  logger.log(`[push] notification cron started`, { intervalMs });

  return () => {
    clearInterval(handle);
    logger.log(`[push] notification cron stopped`);
  };
}

