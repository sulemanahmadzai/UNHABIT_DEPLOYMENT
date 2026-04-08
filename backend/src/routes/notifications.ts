import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as NotificationsService from "../services/notifications.service.js";
import * as NotificationsFeedService from "../services/notifications-feed.service.js";
import * as CategoriesService from "../services/notification-categories.service.js";
import * as GovernanceService from "../services/notification-governance.service.js";
import { isValidUUID } from "../utils/validation.js";
import { removeUndefined } from "../utils/object.js";
import { sendPushNotifications } from "../services/push-notifications.service.js";
import * as SettingsService from "../services/settings.service.js";

const r = Router();

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION CATEGORIES (Android channels + in-app toggles)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/notifications/categories
 * Get all notification categories with user's toggle states.
 * React Native client uses this to create Android notification channels on startup.
 */
r.get("/categories", requireAuth, async (req, res, next) => {
  try {
    const prefs = await CategoriesService.getUserCategoryPrefs(req.user!.id);
    const androidChannels = CategoriesService.getAndroidChannelConfig();
    res.json({ success: true, data: { categories: prefs, android_channels: androidChannels } });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notifications/categories/:category
 * Toggle a specific notification category on/off.
 */
r.put("/categories/:category", requireAuth, async (req, res, next) => {
  try {
    const category = req.params.category!;
    const schema = z.object({ enabled: z.boolean() });
    const { enabled } = schema.parse(req.body);

    const result = await CategoriesService.updateCategoryPref(req.user!.id, category, enabled);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes("cannot be disabled") || error.message?.includes("Unknown")) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
});

/**
 * PUT /api/notifications/categories
 * Bulk update notification category preferences.
 */
r.put("/categories", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      categories: z.array(z.object({
        category: z.string(),
        enabled: z.boolean(),
      })),
    });
    const { categories } = schema.parse(req.body);

    await CategoriesService.bulkUpdateCategoryPrefs(req.user!.id, categories);
    const updated = await CategoriesService.getUserCategoryPrefs(req.user!.id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.includes("cannot be disabled") || error.message?.includes("Unknown")) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION SETTINGS (intensity, lockscreen, promotional opt-in)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/notifications/settings
 * Get enhanced notification settings (intensity, lockscreen privacy, etc.)
 */
r.get("/settings", requireAuth, async (req, res, next) => {
  try {
    const settings = await GovernanceService.getNotificationSettings(req.user!.id);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notifications/settings
 * Update notification settings.
 */
r.put("/settings", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      intensity: z.enum(["light", "standard", "high_support"]).optional(),
      show_habit_details_lockscreen: z.boolean().optional(),
      promotional_opt_in: z.boolean().optional(),
      weekend_support: z.boolean().optional(),
      high_risk_reminders: z.boolean().optional(),
      morning_checkin_minute: z.number().int().min(0).max(1439).optional(),
      evening_lastcall_minute: z.number().int().min(0).max(1439).optional(),
    });
    const data = schema.parse(req.body);

    const cleaned: Parameters<typeof GovernanceService.updateNotificationSettings>[1] = {};
    if (data.intensity !== undefined) cleaned.intensity = data.intensity;
    if (data.show_habit_details_lockscreen !== undefined) cleaned.show_habit_details_lockscreen = data.show_habit_details_lockscreen;
    if (data.promotional_opt_in !== undefined) cleaned.promotional_opt_in = data.promotional_opt_in;
    if (data.weekend_support !== undefined) cleaned.weekend_support = data.weekend_support;
    if (data.high_risk_reminders !== undefined) cleaned.high_risk_reminders = data.high_risk_reminders;
    if (data.morning_checkin_minute !== undefined) cleaned.morning_checkin_minute = data.morning_checkin_minute;
    if (data.evening_lastcall_minute !== undefined) cleaned.evening_lastcall_minute = data.evening_lastcall_minute;

    const settings = await GovernanceService.updateNotificationSettings(req.user!.id, cleaned);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/governance
 * Get current governance status (sent today count, intensity cap, etc.)
 */
r.get("/governance", requireAuth, async (req, res, next) => {
  try {
    const [settings, sentToday] = await Promise.all([
      GovernanceService.getNotificationSettings(req.user!.id),
      GovernanceService.getSentTodayCount(req.user!.id),
    ]);

    const intensityCaps: Record<string, number> = {
      light: 1,
      standard: 2,
      high_support: 3,
    };

    res.json({
      success: true,
      data: {
        intensity: settings.intensity,
        daily_cap: intensityCaps[settings.intensity] ?? 2,
        sent_today: sentToday,
        remaining_today: Math.max(0, (intensityCaps[settings.intensity] ?? 2) - sentToday),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════
// EXISTING ENDPOINTS (preserved from original)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/notifications/preferences
 */
r.get("/preferences", requireAuth, async (req, res, next) => {
  try {
    const prefs = await NotificationsService.getPreferences(req.user!.id);
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notifications/preferences
 */
r.put("/preferences", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      enabled: z.boolean().optional(),
      max_per_day: z.number().int().min(0).max(20).optional(),
      escalate_to_buddy: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const prefs = await NotificationsService.updatePreferences(req.user!.id, removeUndefined({
      enabled: parsed.enabled,
      max_per_day: parsed.max_per_day,
      escalate_to_buddy: parsed.escalate_to_buddy,
    }));
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/scheduled
 */
r.get("/scheduled", requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const nudges = await NotificationsService.getScheduledNudges(req.user!.id, limit);
    res.json({ success: true, data: nudges });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/prime-time
 */
r.post("/prime-time", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      windows: z.array(
        z.object({
          dow: z.number().int().min(0).max(6),
          start_minute: z.number().int().min(0).max(1439),
          end_minute: z.number().int().min(0).max(1439),
        })
      ),
    });
    const { windows } = schema.parse(req.body);

    const result = await NotificationsService.setPrimeTimeWindows(req.user!.id, windows);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/prime-time
 */
r.get("/prime-time", requireAuth, async (req, res, next) => {
  try {
    const windows = await NotificationsService.getPrimeTimeWindows(req.user!.id);
    res.json({ success: true, data: windows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/quiet-hours
 */
r.post("/quiet-hours", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      start_minute: z.number().int().min(0).max(1439),
      end_minute: z.number().int().min(0).max(1439),
    });
    const data = schema.parse(req.body);

    const result = await NotificationsService.setQuietHours(req.user!.id, data);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/quiet-hours
 */
r.get("/quiet-hours", requireAuth, async (req, res, next) => {
  try {
    const hours = await NotificationsService.getQuietHours(req.user!.id);
    res.json({ success: true, data: hours });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/history
 */
r.get("/history", requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await NotificationsService.getDeliveryHistory(
      req.user!.id,
      limit,
      offset
    );
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/reminders
 */
r.post("/reminders", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      journey_task_id: z.string().uuid(),
      remind_at: z.string().datetime(),
    });
    const data = schema.parse(req.body);

    const reminder = await NotificationsService.addTaskReminder(req.user!.id, {
      journey_task_id: data.journey_task_id,
      remind_at: new Date(data.remind_at),
    });

    if (!reminder) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/reminders
 */
r.get("/reminders", requireAuth, async (req, res, next) => {
  try {
    const reminders = await NotificationsService.getTaskReminders(req.user!.id);
    res.json({ success: true, data: reminders });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/reminders/:id
 */
r.delete("/reminders/:id", requireAuth, async (req, res, next) => {
  try {
    const reminderId = req.params.id;
    if (!reminderId) {
      return res.status(400).json({ success: false, error: "Reminder ID is required" });
    }
    const deleted = await NotificationsService.deleteTaskReminder(req.user!.id, reminderId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Reminder not found" });
    }
    res.json({ success: true, message: "Reminder deleted" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications
 * Get notification feed
 */
r.get("/", requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status as "read" | "unread" | undefined;
    const type = req.query.type as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const notifications = await NotificationsFeedService.getNotifications(req.user!.id, removeUndefined({
      status,
      type,
      limit,
      offset,
    }));

    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/mark-all-read
 */
r.post("/mark-all-read", requireAuth, async (req, res, next) => {
  try {
    const result = await NotificationsFeedService.markAllNotificationsAsRead(req.user!.id);
    res.json({ success: true, message: `Marked ${result.marked} notifications as read` });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/:id/read
 */
r.post("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    if (!notificationId) {
      return res.status(400).json({ success: false, error: "Notification ID is required" });
    }
    if (!isValidUUID(notificationId)) {
      return res.status(400).json({ success: false, error: "Invalid notification ID format" });
    }

    const result = await NotificationsFeedService.markNotificationAsRead(req.user!.id, notificationId);

    if (!result) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/:id
 */
r.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    if (!notificationId) {
      return res.status(400).json({ success: false, error: "Notification ID is required" });
    }
    if (!isValidUUID(notificationId)) {
      return res.status(400).json({ success: false, error: "Invalid notification ID format" });
    }

    const deleted = await NotificationsFeedService.deleteNotification(req.user!.id, notificationId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/test-push
 */
r.post("/test-push", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(100).optional(),
      body: z.string().min(1).max(200).optional(),
    });
    const { title = "Test Notification", body = "This is a test push notification!" } =
      schema.parse(req.body);

    const devices = await SettingsService.getDevices(req.user!.id);
    const tokens = devices.map((d) => d.push_token).filter((t): t is string => !!t);

    const result = await sendPushNotifications(tokens, title, body, {
      type: "test",
    });

    const sent = result.tickets.filter((t) => t.status === "ok").length;
    const failed = result.tickets.filter((t) => t.status === "error").length;

    res.json({
      success: true,
      message: "Push notification sent",
      data: {
        devices_found: devices.length,
        tokens_found: tokens.length,
        sent,
        failed,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default r;
