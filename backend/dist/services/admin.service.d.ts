import { Prisma } from "@prisma/client";
export declare function getCategories(): Promise<{
    name: string;
    id: string;
    description: string | null;
}[]>;
export declare function createCategory(data: {
    name: string;
    description?: string | undefined;
}): Promise<{
    name: string;
    id: string;
    description: string | null;
}>;
export declare function updateCategory(id: string, data: {
    name?: string | undefined;
    description?: string | undefined;
}): Promise<{
    name: string;
    id: string;
    description: string | null;
}>;
export declare function deleteCategory(id: string): Promise<{
    name: string;
    id: string;
    description: string | null;
}>;
export declare function getTemplates(categoryId?: string): Promise<({
    habit_categories: {
        name: string;
        id: string;
        description: string | null;
    } | null;
} & {
    id: string;
    category_id: string | null;
    slug: string | null;
    title: string;
    description: string | null;
})[]>;
export declare function getTemplateById(id: string): Promise<({
    habit_categories: {
        name: string;
        id: string;
        description: string | null;
    } | null;
} & {
    id: string;
    category_id: string | null;
    slug: string | null;
    title: string;
    description: string | null;
}) | null>;
export declare function createTemplate(data: {
    title: string;
    description?: string | undefined;
    slug?: string | undefined;
    category_id?: string | undefined;
}): Promise<{
    id: string;
    category_id: string | null;
    slug: string | null;
    title: string;
    description: string | null;
}>;
export declare function updateTemplate(id: string, data: {
    title?: string | undefined;
    description?: string | undefined;
    slug?: string | undefined;
    category_id?: string | undefined;
}): Promise<{
    id: string;
    category_id: string | null;
    slug: string | null;
    title: string;
    description: string | null;
}>;
export declare function deleteTemplate(id: string): Promise<{
    id: string;
    category_id: string | null;
    slug: string | null;
    title: string;
    description: string | null;
}>;
export declare function getBadgeDefinitions(): Promise<({
    badge_rules: {
        created_at: Date;
        id: string;
        description: string | null;
        badge_id: string;
        rule_type: string;
        threshold: number;
        is_active: boolean;
    }[];
} & {
    name: string;
    id: string;
    slug: string;
    description: string | null;
    icon_url: string | null;
    category: string | null;
    tier: string | null;
})[]>;
export declare function createBadgeDefinition(data: {
    slug: string;
    name: string;
    description?: string | undefined;
    icon_url?: string | undefined;
    category?: string | undefined;
    tier?: string | undefined;
}): Promise<{
    name: string;
    id: string;
    slug: string;
    description: string | null;
    icon_url: string | null;
    category: string | null;
    tier: string | null;
}>;
export declare function updateBadgeDefinition(id: string, data: {
    slug?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    icon_url?: string | undefined;
    category?: string | undefined;
    tier?: string | undefined;
}): Promise<{
    name: string;
    id: string;
    slug: string;
    description: string | null;
    icon_url: string | null;
    category: string | null;
    tier: string | null;
}>;
export declare function deleteBadgeDefinition(id: string): Promise<{
    name: string;
    id: string;
    slug: string;
    description: string | null;
    icon_url: string | null;
    category: string | null;
    tier: string | null;
}>;
export declare function getBadgeRules(badgeId?: string): Promise<({
    badge_definitions: {
        name: string;
        id: string;
        slug: string;
        description: string | null;
        icon_url: string | null;
        category: string | null;
        tier: string | null;
    };
} & {
    created_at: Date;
    id: string;
    description: string | null;
    badge_id: string;
    rule_type: string;
    threshold: number;
    is_active: boolean;
})[]>;
export declare function createBadgeRule(data: {
    badge_id: string;
    rule_type: string;
    threshold: number;
    description?: string | undefined;
    is_active?: boolean | undefined;
}): Promise<{
    created_at: Date;
    id: string;
    description: string | null;
    badge_id: string;
    rule_type: string;
    threshold: number;
    is_active: boolean;
}>;
export declare function updateBadgeRule(id: string, data: {
    rule_type?: string | undefined;
    threshold?: number | undefined;
    description?: string | undefined;
    is_active?: boolean | undefined;
}): Promise<{
    created_at: Date;
    id: string;
    description: string | null;
    badge_id: string;
    rule_type: string;
    threshold: number;
    is_active: boolean;
}>;
export declare function deleteBadgeRule(id: string): Promise<{
    created_at: Date;
    id: string;
    description: string | null;
    badge_id: string;
    rule_type: string;
    threshold: number;
    is_active: boolean;
}>;
export declare function getPointRules(): Promise<{
    id: string;
    amount: number;
    code: string;
    event_type: string;
    caps: Prisma.JsonValue | null;
    conditions: Prisma.JsonValue | null;
}[]>;
export declare function createPointRule(data: {
    code: string;
    event_type: string;
    amount: number;
    caps?: Record<string, unknown> | undefined;
    conditions?: Record<string, unknown> | undefined;
}): Promise<{
    id: string;
    amount: number;
    code: string;
    event_type: string;
    caps: Prisma.JsonValue | null;
    conditions: Prisma.JsonValue | null;
}>;
export declare function updatePointRule(id: string, data: {
    code?: string | undefined;
    event_type?: string | undefined;
    amount?: number | undefined;
    caps?: Record<string, unknown> | undefined;
    conditions?: Record<string, unknown> | undefined;
}): Promise<{
    id: string;
    amount: number;
    code: string;
    event_type: string;
    caps: Prisma.JsonValue | null;
    conditions: Prisma.JsonValue | null;
}>;
export declare function deletePointRule(id: string): Promise<{
    id: string;
    amount: number;
    code: string;
    event_type: string;
    caps: Prisma.JsonValue | null;
    conditions: Prisma.JsonValue | null;
}>;
export declare function getAppSettings(): Promise<{
    updated_at: Date;
    description: string | null;
    value: string;
    key: string;
    value_type: string;
    updated_by: string | null;
}[]>;
export declare function getAppSetting(key: string): Promise<{
    updated_at: Date;
    description: string | null;
    value: string;
    key: string;
    value_type: string;
    updated_by: string | null;
} | null>;
export declare function upsertAppSetting(key: string, data: {
    value: string;
    value_type?: string | undefined;
    description?: string | undefined;
}, updatedBy?: string): Promise<{
    updated_at: Date;
    description: string | null;
    value: string;
    key: string;
    value_type: string;
    updated_by: string | null;
}>;
export declare function deleteAppSetting(key: string): Promise<{
    updated_at: Date;
    description: string | null;
    value: string;
    key: string;
    value_type: string;
    updated_by: string | null;
}>;
export declare function getSettingValue<T>(key: string, defaultValue: T): Promise<T>;
export declare function seedDefaultSettings(): Promise<{
    key: string;
    value: string;
    value_type: string;
    description: string;
}[]>;
export declare function seedDefaultPointRules(): Promise<({
    code: string;
    event_type: string;
    amount: number;
    caps: null;
    conditions: null;
} | {
    code: string;
    event_type: string;
    amount: number;
    caps: null;
    conditions: {
        streak_length: number;
    };
} | {
    code: string;
    event_type: string;
    amount: number;
    caps: {
        daily: number;
    };
    conditions: null;
})[]>;
export declare function seedDefaultBadges(): Promise<{
    name: string;
    id: string;
    slug: string;
    description: string | null;
    icon_url: string | null;
    category: string | null;
    tier: string | null;
}[]>;
//# sourceMappingURL=admin.service.d.ts.map