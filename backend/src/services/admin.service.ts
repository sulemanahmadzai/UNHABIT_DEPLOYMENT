import { prisma } from "../lib/services.js";

// ==================== HABIT CATEGORIES ====================

export async function getCategories() {
  return prisma.habit_categories.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createCategory(data: { name: string; description?: string }) {
  return prisma.habit_categories.create({
    data: {
      name: data.name,
      description: data.description ?? null,
    },
  });
}

export async function updateCategory(id: string, data: { name?: string; description?: string }) {
  return prisma.habit_categories.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
    },
  });
}

export async function deleteCategory(id: string) {
  // Check if category exists first
  const category = await prisma.habit_categories.findUnique({ where: { id } });
  if (!category) {
    throw new Error('Category not found');
  }
  return prisma.habit_categories.delete({
    where: { id },
  });
}

// ==================== HABIT TEMPLATES ====================

export async function getTemplates(categoryId?: string) {
  return prisma.habit_templates.findMany({
    where: categoryId ? { category_id: categoryId } : undefined,
    include: {
      habit_categories: true,
    },
    orderBy: { title: "asc" },
  });
}

export async function getTemplateById(id: string) {
  return prisma.habit_templates.findUnique({
    where: { id },
    include: { habit_categories: true },
  });
}

export async function createTemplate(data: {
  title: string;
  description?: string;
  slug?: string;
  category_id?: string;
}) {
  try {
    return await prisma.habit_templates.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        slug: data.slug ?? null,
        category_id: data.category_id ?? null,
      },
    });
  } catch (error: any) {
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      throw new Error(`Template with this ${field} already exists`);
    }
    throw error;
  }
}

export async function updateTemplate(
  id: string,
  data: {
    title?: string;
    description?: string;
    slug?: string;
    category_id?: string;
  }
) {
  return prisma.habit_templates.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      slug: data.slug,
      category_id: data.category_id,
    },
  });
}

export async function deleteTemplate(id: string) {
  return prisma.habit_templates.delete({
    where: { id },
  });
}

// ==================== BADGE DEFINITIONS ====================

export async function getBadgeDefinitions() {
  return prisma.badge_definitions.findMany({
    include: {
      badge_rules: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createBadgeDefinition(data: {
  slug: string;
  name: string;
  description?: string;
  icon_url?: string;
  category?: string;
  tier?: string;
}) {
  return prisma.badge_definitions.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      icon_url: data.icon_url ?? null,
      category: data.category ?? null,
      tier: data.tier ?? null,
    },
  });
}

export async function updateBadgeDefinition(
  id: string,
  data: {
    slug?: string;
    name?: string;
    description?: string;
    icon_url?: string;
    category?: string;
    tier?: string;
  }
) {
  return prisma.badge_definitions.update({
    where: { id },
    data,
  });
}

export async function deleteBadgeDefinition(id: string) {
  return prisma.badge_definitions.delete({
    where: { id },
  });
}

// ==================== BADGE RULES ====================

export async function getBadgeRules(badgeId?: string) {
  return prisma.badge_rules.findMany({
    where: badgeId ? { badge_id: badgeId } : undefined,
    include: {
      badge_definitions: true,
    },
    orderBy: { created_at: "desc" },
  });
}

export async function createBadgeRule(data: {
  badge_id: string;
  rule_type: string;
  threshold: number;
  description?: string;
  is_active?: boolean;
}) {
  return prisma.badge_rules.create({
    data: {
      badge_id: data.badge_id,
      rule_type: data.rule_type,
      threshold: data.threshold,
      description: data.description ?? null,
      is_active: data.is_active ?? true,
    },
  });
}

export async function updateBadgeRule(
  id: string,
  data: {
    rule_type?: string;
    threshold?: number;
    description?: string;
    is_active?: boolean;
  }
) {
  return prisma.badge_rules.update({
    where: { id },
    data,
  });
}

export async function deleteBadgeRule(id: string) {
  return prisma.badge_rules.delete({
    where: { id },
  });
}

// ==================== POINT RULES ====================

export async function getPointRules() {
  return prisma.point_rules.findMany({
    orderBy: { code: "asc" },
  });
}

export async function createPointRule(data: {
  code: string;
  event_type: string;
  amount: number;
  caps?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
}) {
  try {
    return await prisma.point_rules.create({
      data: {
        code: data.code,
        event_type: data.event_type,
        amount: data.amount,
        caps: data.caps ?? null,
        conditions: data.conditions ?? null,
      },
    });
  } catch (error: any) {
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      throw new Error(`Point rule with this ${field} already exists`);
    }
    throw error;
  }
}

export async function updatePointRule(
  id: string,
  data: {
    code?: string;
    event_type?: string;
    amount?: number;
    caps?: Record<string, unknown>;
    conditions?: Record<string, unknown>;
  }
) {
  return prisma.point_rules.update({
    where: { id },
    data,
  });
}

export async function deletePointRule(id: string) {
  return prisma.point_rules.delete({
    where: { id },
  });
}

// ==================== APP SETTINGS ====================

export async function getAppSettings() {
  return prisma.app_settings.findMany({
    orderBy: { key: "asc" },
  });
}

export async function getAppSetting(key: string) {
  return prisma.app_settings.findUnique({
    where: { key },
  });
}

export async function upsertAppSetting(
  key: string,
  data: {
    value: string;
    value_type?: string;
    description?: string;
  },
  updatedBy?: string
) {
  return prisma.app_settings.upsert({
    where: { key },
    update: {
      value: data.value,
      value_type: data.value_type,
      description: data.description,
      updated_at: new Date(),
      updated_by: updatedBy ?? null,
    },
    create: {
      key,
      value: data.value,
      value_type: data.value_type ?? "string",
      description: data.description ?? null,
      updated_by: updatedBy ?? null,
    },
  });
}

export async function deleteAppSetting(key: string) {
  return prisma.app_settings.delete({
    where: { key },
  });
}

// ==================== HELPER: Get setting value with type conversion ====================

export async function getSettingValue<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await prisma.app_settings.findUnique({
    where: { key },
  });

  if (!setting) {
    return defaultValue;
  }

  switch (setting.value_type) {
    case "number":
      return Number(setting.value) as T;
    case "boolean":
      return (setting.value === "true") as T;
    case "json":
      try {
        return JSON.parse(setting.value) as T;
      } catch {
        return defaultValue;
      }
    default:
      return setting.value as T;
  }
}

// ==================== SEED DEFAULT SETTINGS ====================

export async function seedDefaultSettings() {
  const defaults = [
    { key: "penalty_xp_percentage", value: "5", value_type: "number", description: "XP reduction percentage when continuing with penalty after missed day" },
    { key: "streak_freeze_cost_xp", value: "100", value_type: "number", description: "XP cost to purchase one streak freeze" },
    { key: "xp_per_task_completion", value: "10", value_type: "number", description: "XP awarded per task completion" },
    { key: "xp_per_day_completion", value: "20", value_type: "number", description: "Bonus XP for completing all tasks in a day" },
    { key: "xp_per_focus_minute", value: "1", value_type: "number", description: "XP awarded per minute of focus session" },
    { key: "streak_milestone_bonus_xp", value: "50", value_type: "number", description: "Bonus XP for streak milestones (7, 14, 21 days)" },
    { key: "max_freezes_purchasable_per_week", value: "3", value_type: "number", description: "Maximum streak freezes purchasable per week" },
    { key: "base_freezes_per_week", value: "1", value_type: "number", description: "Base streak freezes granted per week" },
  ];

  for (const setting of defaults) {
    await prisma.app_settings.upsert({
      where: { key: setting.key },
      update: {}, // Don't update if exists
      create: setting,
    });
  }

  return defaults;
}

// ==================== SEED DEFAULT POINT RULES ====================

export async function seedDefaultPointRules() {
  const defaults = [
    { code: "task_complete", event_type: "task_completed", amount: 10, caps: null, conditions: null },
    { code: "day_complete", event_type: "day_completed", amount: 20, caps: null, conditions: null },
    { code: "streak_7_days", event_type: "streak_milestone", amount: 50, caps: null, conditions: { streak_length: 7 } },
    { code: "streak_14_days", event_type: "streak_milestone", amount: 100, caps: null, conditions: { streak_length: 14 } },
    { code: "streak_21_days", event_type: "streak_milestone", amount: 200, caps: null, conditions: { streak_length: 21 } },
    { code: "focus_session", event_type: "focus_completed", amount: 5, caps: { daily: 50 }, conditions: null },
    { code: "reflection_submit", event_type: "reflection_submitted", amount: 5, caps: { daily: 5 }, conditions: null },
    { code: "buddy_checkin", event_type: "buddy_checkin", amount: 5, caps: { daily: 10 }, conditions: null },
  ];

  for (const rule of defaults) {
    await prisma.point_rules.upsert({
      where: { code: rule.code },
      update: {}, // Don't update if exists
      create: rule,
    });
  }

  return defaults;
}

// ==================== SEED DEFAULT BADGE DEFINITIONS ====================

export async function seedDefaultBadges() {
  const badges = [
    { slug: "3-day-beginner", name: "3-Day Beginner", description: "Complete your first 3 days", category: "streak", tier: "bronze" },
    { slug: "7-day-warrior", name: "7-Day UnHabit Warrior", description: "Maintain a 7-day streak", category: "streak", tier: "silver" },
    { slug: "14-day-champion", name: "14-Day Champion", description: "Maintain a 14-day streak", category: "streak", tier: "gold" },
    { slug: "21-day-transformation", name: "21-Day Transformation", description: "Complete the full 21-day journey", category: "streak", tier: "platinum" },
    { slug: "perfect-week", name: "Perfect Week", description: "Complete all tasks for 7 consecutive days", category: "consistency", tier: "gold" },
    { slug: "first-win", name: "First Win", description: "Complete your first task", category: "milestone", tier: "bronze" },
    { slug: "focus-master", name: "Focus Master", description: "Complete 10 focus sessions", category: "focus", tier: "silver" },
    { slug: "buddy-builder", name: "Buddy Builder", description: "Invite and connect with a buddy", category: "social", tier: "bronze" },
  ];

  const createdBadges = [];
  for (const badge of badges) {
    const created = await prisma.badge_definitions.upsert({
      where: { slug: badge.slug },
      update: {},
      create: badge,
    });
    createdBadges.push(created);
  }

  // Now create badge rules
  const badgeRules = [
    { slug: "3-day-beginner", rule_type: "streak_days", threshold: 3 },
    { slug: "7-day-warrior", rule_type: "streak_days", threshold: 7 },
    { slug: "14-day-champion", rule_type: "streak_days", threshold: 14 },
    { slug: "21-day-transformation", rule_type: "streak_days", threshold: 21 },
    { slug: "perfect-week", rule_type: "perfect_days", threshold: 7 },
    { slug: "first-win", rule_type: "tasks_completed", threshold: 1 },
    { slug: "focus-master", rule_type: "focus_sessions", threshold: 10 },
    { slug: "buddy-builder", rule_type: "buddies_connected", threshold: 1 },
  ];

  for (const rule of badgeRules) {
    const badge = createdBadges.find(b => b.slug === rule.slug);
    if (badge) {
      await prisma.badge_rules.upsert({
        where: {
          badge_id_rule_type: {
            badge_id: badge.id,
            rule_type: rule.rule_type,
          },
        },
        update: {},
        create: {
          badge_id: badge.id,
          rule_type: rule.rule_type,
          threshold: rule.threshold,
          is_active: true,
        },
      });
    }
  }

  return createdBadges;
}
