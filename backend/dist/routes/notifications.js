import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as NotificationsService from "../services/notifications.service.js";
import * as NotificationsFeedService from "../services/notifications-feed.service.js";
import { isValidUUID } from "../utils/validation.js";
import { removeUndefined } from "../utils/object.js";
const r = Router();
/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
r.get("/preferences", requireAuth, async (req, res, next) => {
    try {
        const prefs = await NotificationsService.getPreferences(req.user.id);
        res.json({ success: true, data: prefs });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PUT /api/notifications/preferences
 * Update preferences
 */
r.put("/preferences", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            enabled: z.boolean().optional(),
            max_per_day: z.number().int().min(0).max(20).optional(),
            escalate_to_buddy: z.boolean().optional(),
        });
        const parsed = schema.parse(req.body);
        const prefs = await NotificationsService.updatePreferences(req.user.id, removeUndefined({
            enabled: parsed.enabled,
            max_per_day: parsed.max_per_day,
            escalate_to_buddy: parsed.escalate_to_buddy,
        }));
        res.json({ success: true, data: prefs });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/scheduled
 * Get scheduled nudges
 */
r.get("/scheduled", requireAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const nudges = await NotificationsService.getScheduledNudges(req.user.id, limit);
        res.json({ success: true, data: nudges });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/notifications/prime-time
 * Set prime time windows
 */
r.post("/prime-time", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            windows: z.array(z.object({
                dow: z.number().int().min(0).max(6), // 0 = Sunday
                start_minute: z.number().int().min(0).max(1439), // 0-1439 minutes
                end_minute: z.number().int().min(0).max(1439),
            })),
        });
        const { windows } = schema.parse(req.body);
        const result = await NotificationsService.setPrimeTimeWindows(req.user.id, windows);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/prime-time
 * Get prime time windows
 */
r.get("/prime-time", requireAuth, async (req, res, next) => {
    try {
        const windows = await NotificationsService.getPrimeTimeWindows(req.user.id);
        res.json({ success: true, data: windows });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/notifications/quiet-hours
 * Set quiet hours
 */
r.post("/quiet-hours", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            start_minute: z.number().int().min(0).max(1439),
            end_minute: z.number().int().min(0).max(1439),
        });
        const data = schema.parse(req.body);
        const result = await NotificationsService.setQuietHours(req.user.id, data);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/quiet-hours
 * Get quiet hours
 */
r.get("/quiet-hours", requireAuth, async (req, res, next) => {
    try {
        const hours = await NotificationsService.getQuietHours(req.user.id);
        res.json({ success: true, data: hours });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/history
 * Get notification delivery history
 */
r.get("/history", requireAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const history = await NotificationsService.getDeliveryHistory(req.user.id, limit, offset);
        res.json({ success: true, data: history });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/notifications/reminders
 * Add a task reminder
 */
r.post("/reminders", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            journey_task_id: z.string().uuid(),
            remind_at: z.string().datetime(),
        });
        const data = schema.parse(req.body);
        const reminder = await NotificationsService.addTaskReminder(req.user.id, {
            journey_task_id: data.journey_task_id,
            remind_at: new Date(data.remind_at),
        });
        if (!reminder) {
            return res.status(404).json({ success: false, error: "Task not found" });
        }
        res.status(201).json({ success: true, data: reminder });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/reminders
 * Get user's reminders
 */
r.get("/reminders", requireAuth, async (req, res, next) => {
    try {
        const reminders = await NotificationsService.getTaskReminders(req.user.id);
        res.json({ success: true, data: reminders });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/notifications/reminders/:id
 * Delete a task reminder
 */
r.delete("/reminders/:id", requireAuth, async (req, res, next) => {
    try {
        const reminderId = req.params.id;
        if (!reminderId) {
            return res.status(400).json({ success: false, error: "Reminder ID is required" });
        }
        const deleted = await NotificationsService.deleteTaskReminder(req.user.id, reminderId);
        if (!deleted) {
            return res.status(404).json({ success: false, error: "Reminder not found" });
        }
        res.json({ success: true, message: "Reminder deleted" });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications
 * Get notification feed
 */
r.get("/", requireAuth, async (req, res, next) => {
    try {
        const status = req.query.status;
        const type = req.query.type;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;
        const notifications = await NotificationsFeedService.getNotifications(req.user.id, removeUndefined({
            status,
            type,
            limit,
            offset,
        }));
        res.json({ success: true, data: notifications });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read
 * NOTE: This must come before /:id/read to avoid route conflicts
 */
r.post("/mark-all-read", requireAuth, async (req, res, next) => {
    try {
        const result = await NotificationsFeedService.markAllNotificationsAsRead(req.user.id);
        res.json({ success: true, message: `Marked ${result.marked} notifications as read` });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/notifications/:id/read
 * Mark notification as read
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
        const result = await NotificationsFeedService.markNotificationAsRead(req.user.id, notificationId);
        if (!result) {
            return res.status(404).json({ success: false, error: "Notification not found" });
        }
        res.json({ success: true, message: "Notification marked as read" });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/notifications/:id
 * Delete a notification
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
        const deleted = await NotificationsFeedService.deleteNotification(req.user.id, notificationId);
        if (!deleted) {
            return res.status(404).json({ success: false, error: "Notification not found" });
        }
        res.json({ success: true, message: "Notification deleted" });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=notifications.js.map