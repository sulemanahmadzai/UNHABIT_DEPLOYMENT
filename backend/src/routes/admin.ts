import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import * as AdminService from "../services/admin.service.js";
import { removeUndefined } from "../utils/object.js";

const r = Router();

// All admin routes require authentication and admin role
r.use(requireAuth, requireAdmin);

// ==================== HABIT CATEGORIES ====================

/**
 * GET /api/admin/categories
 * List all habit categories
 */
r.get("/categories", async (_req, res, next) => {
  try {
    const categories = await AdminService.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/categories
 * Create a new habit category
 */
r.post("/categories", async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    });
    const data = schema.parse(req.body);
    const category = await AdminService.createCategory(removeUndefined(data));
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/categories/:id
 * Update a habit category
 */
r.put("/categories/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Category ID is required" });
    }
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
    });
    const data = schema.parse(req.body);
    const category = await AdminService.updateCategory(id, removeUndefined(data));
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/categories/:id
 * Delete a habit category
 */
r.delete("/categories/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Category ID is required" });
    }
    await AdminService.deleteCategory(id);
    res.json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ success: false, error: "Category not found" });
    }
    next(error);
  }
});

// ==================== HABIT TEMPLATES ====================

/**
 * GET /api/admin/templates
 * List all habit templates
 */
r.get("/templates", async (req, res, next) => {
  try {
    const categoryId = req.query.category_id as string | undefined;
    const templates = await AdminService.getTemplates(categoryId);
    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/templates/:id
 * Get a specific template
 */
r.get("/templates/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Template ID is required" });
    }
    const template = await AdminService.getTemplateById(id);
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/templates
 * Create a new habit template
 */
r.post("/templates", async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      slug: z.string().max(100).optional(),
      category_id: z.string().uuid().optional(),
    });
    const data = schema.parse(req.body);
    const template = await AdminService.createTemplate(removeUndefined(data));
    res.status(201).json({ success: true, data: template });
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
 * PUT /api/admin/templates/:id
 * Update a habit template
 */
r.put("/templates/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Template ID is required" });
    }
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      slug: z.string().max(100).optional(),
      category_id: z.string().uuid().optional(),
    });
    const data = schema.parse(req.body);
    const template = await AdminService.updateTemplate(id, removeUndefined(data));
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/templates/:id
 * Delete a habit template
 */
r.delete("/templates/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Template ID is required" });
    }
    await AdminService.deleteTemplate(id);
    res.json({ success: true, message: "Template deleted" });
  } catch (error) {
    next(error);
  }
});

// ==================== BADGE DEFINITIONS ====================

/**
 * GET /api/admin/badges
 * List all badge definitions with their rules
 */
r.get("/badges", async (_req, res, next) => {
  try {
    const badges = await AdminService.getBadgeDefinitions();
    res.json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/badges
 * Create a new badge definition
 */
r.post("/badges", async (req, res, next) => {
  try {
    const schema = z.object({
      slug: z.string().min(1).max(100),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      icon_url: z.string().url().optional(),
      category: z.string().max(50).optional(),
      tier: z.string().max(50).optional(),
    });
    const data = schema.parse(req.body);
    const badge = await AdminService.createBadgeDefinition(removeUndefined(data));
    res.status(201).json({ success: true, data: badge });
  } catch (error: any) {
    if (error.name === 'ZodError' || error.issues) {
      return res.status(400).json({
        success: false,
        error: `Validation error: ${error.issues?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') || error.message}`,
      });
    }
    // Handle duplicate/constraint errors
    if (error.message?.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * PUT /api/admin/badges/:id
 * Update a badge definition
 */
r.put("/badges/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Badge ID is required" });
    }
    const schema = z.object({
      slug: z.string().min(1).max(100).optional(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      icon_url: z.string().url().optional(),
      category: z.string().max(50).optional(),
      tier: z.string().max(50).optional(),
    });
    const data = schema.parse(req.body);
    const badge = await AdminService.updateBadgeDefinition(id, removeUndefined(data));
    res.json({ success: true, data: badge });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/badges/:id
 * Delete a badge definition
 */
r.delete("/badges/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Badge ID is required" });
    }
    await AdminService.deleteBadgeDefinition(id);
    res.json({ success: true, message: "Badge deleted" });
  } catch (error) {
    next(error);
  }
});

// ==================== BADGE RULES ====================

/**
 * GET /api/admin/badge-rules
 * List all badge rules
 */
r.get("/badge-rules", async (req, res, next) => {
  try {
    const badgeId = req.query.badge_id as string | undefined;
    const rules = await AdminService.getBadgeRules(badgeId);
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/badge-rules
 * Create a new badge rule
 */
r.post("/badge-rules", async (req, res, next) => {
  try {
    const schema = z.object({
      badge_id: z.string().uuid(),
      rule_type: z.string().min(1).max(50),
      threshold: z.number().int().min(1),
      description: z.string().max(500).optional(),
      is_active: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const rule = await AdminService.createBadgeRule(removeUndefined(data));
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/badge-rules/:id
 * Update a badge rule
 */
r.put("/badge-rules/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Rule ID is required" });
    }
    const schema = z.object({
      rule_type: z.string().min(1).max(50).optional(),
      threshold: z.number().int().min(1).optional(),
      description: z.string().max(500).optional(),
      is_active: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const rule = await AdminService.updateBadgeRule(id, removeUndefined(data));
    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/badge-rules/:id
 * Delete a badge rule
 */
r.delete("/badge-rules/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Rule ID is required" });
    }
    await AdminService.deleteBadgeRule(id);
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    next(error);
  }
});

// ==================== POINT RULES ====================

/**
 * GET /api/admin/point-rules
 * List all point rules
 */
r.get("/point-rules", async (_req, res, next) => {
  try {
    const rules = await AdminService.getPointRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/point-rules
 * Create a new point rule
 */
r.post("/point-rules", async (req, res, next) => {
  try {
    const schema = z.object({
      code: z.string().min(1).max(50),
      event_type: z.string().min(1).max(50),
      amount: z.number().int().min(0), // Validate amount is non-negative
      caps: z.record(z.string(), z.unknown()).optional(),
      conditions: z.record(z.string(), z.unknown()).optional(),
    });
    const data = schema.parse(req.body);
    const rule = await AdminService.createPointRule(removeUndefined(data));
    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    if (error.name === 'ZodError' || error.issues) {
      return res.status(400).json({
        success: false,
        error: `Validation error: ${error.issues?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') || error.message}`,
      });
    }
    // Handle duplicate/constraint errors
    if (error.message?.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * PUT /api/admin/point-rules/:id
 * Update a point rule
 */
r.put("/point-rules/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Rule ID is required" });
    }
    const schema = z.object({
      code: z.string().min(1).max(50).optional(),
      event_type: z.string().min(1).max(50).optional(),
      amount: z.number().int().optional(),
      caps: z.record(z.string(), z.unknown()).optional(),
      conditions: z.record(z.string(), z.unknown()).optional(),
    });
    const data = schema.parse(req.body);
    const rule = await AdminService.updatePointRule(id, removeUndefined(data));
    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/point-rules/:id
 * Delete a point rule
 */
r.delete("/point-rules/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Rule ID is required" });
    }
    await AdminService.deletePointRule(id);
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    next(error);
  }
});

// ==================== APP SETTINGS ====================

/**
 * GET /api/admin/settings
 * List all app settings
 */
r.get("/settings", async (_req, res, next) => {
  try {
    const settings = await AdminService.getAppSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/settings/:key
 * Get a specific setting
 */
r.get("/settings/:key", async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ success: false, error: "Setting key is required" });
    }
    const setting = await AdminService.getAppSetting(key);
    if (!setting) {
      return res.status(404).json({ success: false, error: "Setting not found" });
    }
    res.json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/settings/:key
 * Create or update a setting
 */
r.put("/settings/:key", async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ success: false, error: "Setting key is required" });
    }
    const schema = z.object({
      value: z.string(),
      value_type: z.enum(["string", "number", "boolean", "json"]).optional(),
      description: z.string().max(500).optional(),
    });
    const data = schema.parse(req.body);
    const setting = await AdminService.upsertAppSetting(key, removeUndefined(data), req.user!.id);
    res.json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/settings/:key
 * Delete a setting
 */
r.delete("/settings/:key", async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ success: false, error: "Setting key is required" });
    }
    await AdminService.deleteAppSetting(key);
    res.json({ success: true, message: "Setting deleted" });
  } catch (error) {
    next(error);
  }
});

// ==================== SEED DATA ====================

/**
 * POST /api/admin/seed/settings
 * Seed default app settings
 */
r.post("/seed/settings", async (_req, res, next) => {
  try {
    const settings = await AdminService.seedDefaultSettings();
    res.json({ success: true, data: settings, message: "Default settings seeded" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/seed/point-rules
 * Seed default point rules
 */
r.post("/seed/point-rules", async (_req, res, next) => {
  try {
    const rules = await AdminService.seedDefaultPointRules();
    res.json({ success: true, data: rules, message: "Default point rules seeded" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/seed/badges
 * Seed default badges and rules
 */
r.post("/seed/badges", async (_req, res, next) => {
  try {
    const badges = await AdminService.seedDefaultBadges();
    res.json({ success: true, data: badges, message: "Default badges seeded" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/seed/all
 * Seed all default data
 */
r.post("/seed/all", async (_req, res, next) => {
  try {
    const settings = await AdminService.seedDefaultSettings();
    const rules = await AdminService.seedDefaultPointRules();
    const badges = await AdminService.seedDefaultBadges();
    res.json({
      success: true,
      data: { settings, rules, badges },
      message: "All default data seeded",
    });
  } catch (error) {
    next(error);
  }
});

export default r;
