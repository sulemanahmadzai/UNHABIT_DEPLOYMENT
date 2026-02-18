import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as SettingsService from "../services/settings.service.js";
import * as ComprehensiveSettingsService from "../services/settings-comprehensive.service.js";
import { removeUndefined } from "../utils/object.js";

const r = Router();

/**
 * GET /api/settings/privacy
 * Get privacy settings
 */
r.get("/privacy", requireAuth, async (req, res, next) => {
  try {
    const settings = await SettingsService.getPrivacySettings(req.user!.id);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/privacy
 * Update privacy settings
 */
r.put("/privacy", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      share_with_buddy: z.boolean().optional(),
      allow_research: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const settings = await SettingsService.updatePrivacySettings(req.user!.id, removeUndefined({
      share_with_buddy: parsed.share_with_buddy,
      allow_research: parsed.allow_research,
    }));
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/share
 * Get share preferences
 */
r.get("/share", requireAuth, async (req, res, next) => {
  try {
    const prefs = await SettingsService.getSharePreferences(req.user!.id);
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/share
 * Update share preferences
 */
r.put("/share", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      share_metrics: z.boolean().optional(),
      share_streaks: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const prefs = await SettingsService.updateSharePreferences(req.user!.id, removeUndefined({
      share_metrics: parsed.share_metrics,
      share_streaks: parsed.share_streaks,
    }));
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/devices
 * Get registered devices
 */
r.get("/devices", requireAuth, async (req, res, next) => {
  try {
    const devices = await SettingsService.getDevices(req.user!.id);
    res.json({ success: true, data: devices });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/devices
 * Register device (for push notifications)
 */
r.post("/devices", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      platform: z.enum(["ios", "android"]), // Database constraint only allows ios/android
      push_token: z.string().optional(),
      app_version: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    const device = await SettingsService.registerDevice(req.user!.id, {
      platform: parsed.platform,
      push_token: parsed.push_token ?? null,
      app_version: parsed.app_version ?? null,
    });
    res.status(201).json({ success: true, data: device });
  } catch (error: any) {
    if (error.name === 'ZodError' || error.issues) {
      return res.status(400).json({
        success: false,
        error: `Validation error: ${error.issues?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') || error.message}`,
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/settings/devices/:id
 * Unregister device
 */
r.delete("/devices/:id", requireAuth, async (req, res, next) => {
  try {
    const deviceId = req.params.id;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: "Device ID is required" });
    }
    const deleted = await SettingsService.unregisterDevice(req.user!.id, deviceId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    res.json({ success: true, message: "Device unregistered successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/export-request
 * Request data export
 */
r.post("/export-request", requireAuth, async (req, res, next) => {
  try {
    const result = await SettingsService.requestDataExport(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/delete-request
 * Request account deletion
 */
r.post("/delete-request", requireAuth, async (req, res, next) => {
  try {
    const result = await SettingsService.requestAccountDeletion(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings
 * Get all user settings (comprehensive)
 */
r.get("/", requireAuth, async (req, res, next) => {
  try {
    const settings = await ComprehensiveSettingsService.getAllSettings(req.user!.id);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/ai-coach-preferences
 * Get AI Coach preferences
 */
r.get("/ai-coach-preferences", requireAuth, async (req, res, next) => {
  try {
    const prefs = await ComprehensiveSettingsService.getAICoachPreferences(req.user!.id);
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/ai-coach-preferences
 * Update AI Coach preferences
 */
r.put("/ai-coach-preferences", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      enabled: z.boolean().optional(),
      tone: z.enum(["supportive", "motivational", "direct"]).optional(),
      frequency: z.enum(["daily", "weekly", "on_demand"]).optional(),
      topics: z.array(z.string()).optional(),
    });
    const data = schema.parse(req.body);

    const prefs = await ComprehensiveSettingsService.updateAICoachPreferences(req.user!.id, removeUndefined(data));
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
});

export default r;
