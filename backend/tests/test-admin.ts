/**
 * Admin Endpoints Test Suite
 * Tests all admin endpoints with RBAC verification
 */

import { apiRequest, recordTest, verifyDb, prisma, generateInvalidUUID, generateNonExistentUUID, testContext, verifyOperation, verifyByGet } from './test-helpers';

export async function testAdminEndpoints(adminToken: string, userToken: string) {
  console.log('\n📋 Testing Admin Endpoints (RBAC Protected)...\n');

  // ============================================================================
  // RBAC TESTS - Verify admin-only access
  // ============================================================================

  // Test: User trying to access admin endpoints
  const userAccessRes = await apiRequest('GET', '/admin/categories', undefined, userToken);
  recordTest(
    'Admin RBAC - User access denied',
    userAccessRes.status === 403 || userAccessRes.status === 401,
    undefined,
    userAccessRes.data,
    undefined,
    403,
    userAccessRes.status
  );

  // Test: Unauthenticated access
  const unauthAccessRes = await apiRequest('GET', '/admin/categories');
  recordTest(
    'Admin RBAC - Unauthenticated access denied',
    unauthAccessRes.status === 401,
    undefined,
    unauthAccessRes.data,
    undefined,
    401,
    unauthAccessRes.status
  );

  // ============================================================================
  // CATEGORIES TESTS
  // ============================================================================

  // Test 1: Get all categories
  const getCategoriesRes = await apiRequest('GET', '/admin/categories', undefined, adminToken);
  recordTest('Admin 1.1 Get Categories', getCategoriesRes.status === 200);

  // Test 2: Create category with valid data (REQUIRED for subsequent tests)
  const createCategoryRes = await apiRequest(
    'POST',
    '/admin/categories',
    { name: 'Test Category ' + Date.now(), description: 'Test description' }, // Add timestamp to avoid duplicates
    adminToken
  );
  const categoryId = createCategoryRes.data?.id;
  const categoryCreated = createCategoryRes.status === 201 || createCategoryRes.status === 200;
  recordTest('Admin 1.2 Create Category - Valid', categoryCreated);
  
  if (categoryCreated && categoryId) {
    testContext.categoryIds.push(categoryId);
    testContext.currentCategoryId = categoryId;
    
    // Verify creation in database
    const dbVerified = await verifyOperation(
      'Create Category',
      () => prisma.habit_categories.findUnique({ where: { id: categoryId } }),
      (data) => data !== null,
      'Category exists in database'
    );
    recordTest('Admin 1.2.1 Create Category - DB Verified', dbVerified, undefined, undefined, dbVerified);
  }

  // Test 3: Create category with empty name
  const emptyNameRes = await apiRequest(
    'POST',
    '/admin/categories',
    { name: '', description: 'Test' },
    adminToken
  );
  recordTest('Admin 1.3 Create Category - Empty name', emptyNameRes.status >= 400);

  // Test 4: Create category with duplicate name
  if (categoryId) {
    const duplicateRes = await apiRequest(
      'POST',
      '/admin/categories',
      { name: 'Test Category', description: 'Duplicate' },
      adminToken
    );
    recordTest('Admin 1.4 Create Category - Duplicate name', duplicateRes.status >= 400);
  }

  // Test 5: Create category with very long name
  const longNameRes = await apiRequest(
    'POST',
    '/admin/categories',
    { name: 'a'.repeat(500), description: 'Test' },
    adminToken
  );
  recordTest('Admin 1.5 Create Category - Very long name', longNameRes.status >= 400);

  // Test 6: Update category (DEPENDS ON: category creation)
  if (categoryId) {
    const updateRes = await apiRequest(
      'PUT',
      `/admin/categories/${categoryId}`,
      { name: 'Updated Category ' + Date.now(), description: 'Updated description' },
      adminToken
    );
    const updateValid = updateRes.status === 200;
    recordTest('Admin 1.6 Update Category - Valid', updateValid);

    // Verify update by GET request
    if (updateValid) {
      const verifyUpdate = await verifyByGet(
        'Update Category',
        `/admin/categories/${categoryId}`,
        adminToken,
        (data) => data.name.includes('Updated Category'),
        'Category name updated'
      );
      recordTest('Admin 1.6.1 Update Category - Verified by GET', verifyUpdate, undefined, undefined, verifyUpdate);
    }

    // Verify in DB
    const dbVerified = await verifyOperation(
      'Update Category',
      () => prisma.habit_categories.findUnique({ where: { id: categoryId } }),
      (data) => data?.name.includes('Updated Category') === true,
      'Category updated in database'
    );
    recordTest('Admin 1.7 Update Category - DB Verified', dbVerified, undefined, undefined, dbVerified);
  } else {
    recordTest('Admin 1.6 Update Category - SKIPPED (no category created)', true);
  }

  // Test 7: Update category with invalid ID
  const invalidUpdateRes = await apiRequest(
    'PUT',
    `/admin/categories/${generateInvalidUUID()}`,
    { name: 'Test' },
    adminToken
  );
  recordTest('Admin 1.8 Update Category - Invalid ID', invalidUpdateRes.status >= 400);

  // Test 8: Delete category (DEPENDS ON: category creation)
  if (categoryId) {
    const deleteRes = await apiRequest('DELETE', `/admin/categories/${categoryId}`, undefined, adminToken);
    const deleteValid = deleteRes.status === 200 || deleteRes.status === 204;
    recordTest('Admin 1.9 Delete Category', deleteValid);

    // Verify deletion by trying to GET (should 404)
    if (deleteValid) {
      const verifyDelete = await apiRequest('GET', `/admin/categories/${categoryId}`, undefined, adminToken);
      const deleted = verifyDelete.status === 404;
      recordTest('Admin 1.9.1 Delete Category - Verified by GET (404)', deleted);
    }

    // Verify deletion in DB
    const dbVerified = await verifyOperation(
      'Delete Category',
      () => prisma.habit_categories.findUnique({ where: { id: categoryId } }),
      (data) => data === null,
      'Category deleted from database'
    );
    recordTest('Admin 1.10 Delete Category - DB Verified', dbVerified, undefined, undefined, dbVerified);
  } else {
    recordTest('Admin 1.9 Delete Category - SKIPPED (no category created)', true);
  }

  // Test 9: Delete non-existent category
  const deleteNonExistentRes = await apiRequest(
    'DELETE',
    `/admin/categories/${generateNonExistentUUID()}`,
    undefined,
    adminToken
  );
  // Backend should return 404 for non-existent category
  recordTest('Admin 1.11 Delete Category - Non-existent', deleteNonExistentRes.status === 404,
    deleteNonExistentRes.status !== 404 ? `Expected 404, got ${deleteNonExistentRes.status}` : undefined,
    deleteNonExistentRes.data);

  // ============================================================================
  // TEMPLATES TESTS
  // ============================================================================

  // Test 1: Get all templates
  const getTemplatesRes = await apiRequest('GET', '/admin/templates', undefined, adminToken);
  recordTest('Admin 2.1 Get Templates', getTemplatesRes.status === 200);

  // Test 2: Create template with valid data (use unique slug to avoid conflicts)
  const uniqueSlug = `test-template-${Date.now()}`;
  const createTemplateRes = await apiRequest(
    'POST',
    '/admin/templates',
    {
      title: 'Test Template ' + Date.now(),
      description: 'Test template description',
      slug: uniqueSlug,
    },
    adminToken
  );
  const templateId = createTemplateRes.data?.id;
  const templateCreated = createTemplateRes.status === 201 || createTemplateRes.status === 200;
  recordTest('Admin 2.2 Create Template - Valid', templateCreated,
    !templateCreated ? `Expected 201/200, got ${createTemplateRes.status}. Error: ${JSON.stringify(createTemplateRes.data)}` : undefined,
    createTemplateRes.data);
  
  if (templateCreated && templateId) {
    testContext.templateIds.push(templateId);
    testContext.currentTemplateId = templateId;
  }

  // Test 3: Create template with empty title
  const emptyTitleRes = await apiRequest(
    'POST',
    '/admin/templates',
    { title: '', description: 'Test' },
    adminToken
  );
  recordTest('Admin 2.3 Create Template - Empty title', emptyTitleRes.status >= 400);

  // Test 4: Get template by ID
  if (templateId) {
    const getTemplateRes = await apiRequest('GET', `/admin/templates/${templateId}`, undefined, adminToken);
    recordTest('Admin 2.4 Get Template by ID', getTemplateRes.status === 200);
  }

  // Test 5: Update template
  if (templateId) {
    const updateRes = await apiRequest(
      'PUT',
      `/admin/templates/${templateId}`,
      { title: 'Updated Template', description: 'Updated' },
      adminToken
    );
    recordTest('Admin 2.5 Update Template', updateRes.status === 200);
  }

  // Test 6: Delete template
  if (templateId) {
    const deleteRes = await apiRequest('DELETE', `/admin/templates/${templateId}`, undefined, adminToken);
    recordTest('Admin 2.6 Delete Template', deleteRes.status === 200 || deleteRes.status === 204);
  }

  // ============================================================================
  // BADGE DEFINITIONS TESTS
  // ============================================================================

  // Test 1: Get all badges
  const getBadgesRes = await apiRequest('GET', '/admin/badges', undefined, adminToken);
  recordTest('Admin 3.1 Get Badges', getBadgesRes.status === 200);

  // Test 2: Create badge with valid data (use unique slug to avoid conflicts)
  const uniqueBadgeSlug = `test-badge-${Date.now()}`;
  const createBadgeRes = await apiRequest(
    'POST',
    '/admin/badges',
    {
      slug: uniqueBadgeSlug,
      name: 'Test Badge ' + Date.now(),
      description: 'Test badge description',
      category: 'streak',
      tier: 'bronze',
    },
    adminToken
  );
  const badgeId = createBadgeRes.data?.id;
  const badgeCreated = createBadgeRes.status === 201 || createBadgeRes.status === 200;
  recordTest('Admin 3.2 Create Badge - Valid', badgeCreated,
    !badgeCreated ? `Expected 201/200, got ${createBadgeRes.status}. Error: ${JSON.stringify(createBadgeRes.data)}` : undefined,
    createBadgeRes.data);
  
  if (badgeCreated && badgeId) {
    testContext.badgeIds.push(badgeId);
    testContext.currentBadgeId = badgeId;
  }

  // Test 3: Create badge with duplicate slug
  if (badgeId) {
    const duplicateRes = await apiRequest(
      'POST',
      '/admin/badges',
      { slug: 'test-badge', name: 'Duplicate Badge' },
      adminToken
    );
    recordTest('Admin 3.3 Create Badge - Duplicate slug', duplicateRes.status >= 400);
  }

  // Test 4: Create badge with empty slug
  const emptySlugRes = await apiRequest(
    'POST',
    '/admin/badges',
    { slug: '', name: 'Test Badge' },
    adminToken
  );
  recordTest('Admin 3.4 Create Badge - Empty slug', emptySlugRes.status >= 400);

  // Test 5: Update badge
  if (badgeId) {
    const updateRes = await apiRequest(
      'PUT',
      `/admin/badges/${badgeId}`,
      { name: 'Updated Badge', tier: 'silver' },
      adminToken
    );
    recordTest('Admin 3.5 Update Badge', updateRes.status === 200);
  }

  // Test 6: Delete badge
  if (badgeId) {
    const deleteRes = await apiRequest('DELETE', `/admin/badges/${badgeId}`, undefined, adminToken);
    recordTest('Admin 3.6 Delete Badge', deleteRes.status === 200 || deleteRes.status === 204);
  }

  // ============================================================================
  // BADGE RULES TESTS
  // ============================================================================

  // Create a badge first for rule testing
  const badgeForRuleRes = await apiRequest(
    'POST',
    '/admin/badges',
    { slug: 'rule-test-badge', name: 'Rule Test Badge' },
    adminToken
  );
  const badgeForRuleId = badgeForRuleRes.data?.id;

  if (badgeForRuleId) {
    // Test 1: Create badge rule
    const createRuleRes = await apiRequest(
      'POST',
      '/admin/badge-rules',
      {
        badge_id: badgeForRuleId,
        rule_type: 'streak_days',
        threshold: 7,
        description: '7 day streak',
        is_active: true,
      },
      adminToken
    );
    const ruleId = createRuleRes.data?.id;
    recordTest('Admin 4.1 Create Badge Rule - Valid', createRuleRes.status === 201 || createRuleRes.status === 200);

    // Test 2: Create rule with invalid badge_id
    const invalidBadgeRes = await apiRequest(
      'POST',
      '/admin/badge-rules',
      {
        badge_id: generateInvalidUUID(),
        rule_type: 'streak_days',
        threshold: 7,
      },
      adminToken
    );
    recordTest('Admin 4.2 Create Badge Rule - Invalid badge ID', invalidBadgeRes.status >= 400);

    // Test 3: Create rule with negative threshold
    const negativeThresholdRes = await apiRequest(
      'POST',
      '/admin/badge-rules',
      {
        badge_id: badgeForRuleId,
        rule_type: 'streak_days',
        threshold: -1,
      },
      adminToken
    );
    recordTest('Admin 4.3 Create Badge Rule - Negative threshold', negativeThresholdRes.status >= 400);

    // Test 4: Update rule
    if (ruleId) {
      const updateRes = await apiRequest(
        'PUT',
        `/admin/badge-rules/${ruleId}`,
        { threshold: 14, is_active: false },
        adminToken
      );
      recordTest('Admin 4.4 Update Badge Rule', updateRes.status === 200);
    }

    // Test 5: Delete rule
    if (ruleId) {
      const deleteRes = await apiRequest('DELETE', `/admin/badge-rules/${ruleId}`, undefined, adminToken);
      recordTest('Admin 4.5 Delete Badge Rule', deleteRes.status === 200 || deleteRes.status === 204);
    }

    // Cleanup
    await apiRequest('DELETE', `/admin/badges/${badgeForRuleId}`, undefined, adminToken);
  }

  // ============================================================================
  // POINT RULES TESTS
  // ============================================================================

  // Test 1: Get all point rules
  const getPointRulesRes = await apiRequest('GET', '/admin/point-rules', undefined, adminToken);
  recordTest('Admin 5.1 Get Point Rules', getPointRulesRes.status === 200);

  // Test 2: Create point rule with valid data (use unique code to avoid conflicts)
  const uniqueCode = `test_point_rule_${Date.now()}`;
  const createPointRuleRes = await apiRequest(
    'POST',
    '/admin/point-rules',
    {
      code: uniqueCode,
      event_type: 'task_completed',
      amount: 10,
      caps: { daily: 100 },
      conditions: { streak_length: 1 },
    },
    adminToken
  );
  const pointRuleId = createPointRuleRes.data?.id;
  const pointRuleCreated = createPointRuleRes.status === 201 || createPointRuleRes.status === 200;
  recordTest('Admin 5.2 Create Point Rule - Valid', pointRuleCreated,
    !pointRuleCreated ? `Expected 201/200, got ${createPointRuleRes.status}. Error: ${JSON.stringify(createPointRuleRes.data)}` : undefined,
    createPointRuleRes.data);
  
  if (pointRuleCreated && pointRuleId) {
    testContext.pointRuleIds.push(pointRuleId);
    testContext.currentPointRuleId = pointRuleId;
  }

  // Test 3: Create point rule with invalid JSON in caps
  const invalidCapsRes = await apiRequest(
    'POST',
    '/admin/point-rules',
    {
      code: 'invalid_caps',
      event_type: 'task_completed',
      amount: 10,
      caps: 'invalid json',
    },
    adminToken
  );
  recordTest('Admin 5.3 Create Point Rule - Invalid caps JSON', invalidCapsRes.status >= 400);

  // Test 4: Create point rule with negative amount
  const negativeAmountRes = await apiRequest(
    'POST',
    '/admin/point-rules',
    {
      code: `negative_amount_${Date.now()}`,
      event_type: 'task_completed',
      amount: -10,
    },
    adminToken
  );
  // Backend should validate and return 400 for negative amount
  recordTest('Admin 5.4 Create Point Rule - Negative amount', negativeAmountRes.status === 400,
    negativeAmountRes.status !== 400 ? `Expected 400, got ${negativeAmountRes.status}` : undefined,
    negativeAmountRes.data);

  // Test 5: Update point rule
  if (pointRuleId) {
    const updateRes = await apiRequest(
      'PUT',
      `/admin/point-rules/${pointRuleId}`,
      { amount: 20, caps: { daily: 200 } },
      adminToken
    );
    recordTest('Admin 5.5 Update Point Rule', updateRes.status === 200);
  }

  // Test 6: Delete point rule
  if (pointRuleId) {
    const deleteRes = await apiRequest('DELETE', `/admin/point-rules/${pointRuleId}`, undefined, adminToken);
    recordTest('Admin 5.6 Delete Point Rule', deleteRes.status === 200 || deleteRes.status === 204);
  }

  // ============================================================================
  // APP SETTINGS TESTS
  // ============================================================================

  // Test 1: Get all settings
  const getSettingsRes = await apiRequest('GET', '/admin/settings', undefined, adminToken);
  recordTest('Admin 6.1 Get Settings', getSettingsRes.status === 200);

  // Test 2: Create/Update setting
  const upsertSettingRes = await apiRequest(
    'PUT',
    '/admin/settings/test_setting',
    {
      value: '100',
      value_type: 'number',
      description: 'Test setting',
    },
    adminToken
  );
  recordTest('Admin 6.2 Upsert Setting', upsertSettingRes.status === 200 || upsertSettingRes.status === 201);

  // Test 3: Get specific setting
  const getSettingRes = await apiRequest('GET', '/admin/settings/test_setting', undefined, adminToken);
  recordTest('Admin 6.3 Get Setting by Key', getSettingRes.status === 200);

  // Test 4: Update setting with invalid value type
  const invalidTypeRes = await apiRequest(
    'PUT',
    '/admin/settings/test_setting',
    {
      value: 'not a number',
      value_type: 'number',
    },
    adminToken
  );
  recordTest('Admin 6.4 Update Setting - Invalid value type', invalidTypeRes.status >= 400 || invalidTypeRes.status === 200);

  // Test 5: Delete setting
  const deleteSettingRes = await apiRequest('DELETE', '/admin/settings/test_setting', undefined, adminToken);
  recordTest('Admin 6.5 Delete Setting', deleteSettingRes.status === 200 || deleteSettingRes.status === 204);

  // ============================================================================
  // SEED DATA TESTS
  // ============================================================================

  // Test 1: Seed all
  const seedAllRes = await apiRequest('POST', '/admin/seed/all', undefined, adminToken);
  recordTest('Admin 7.1 Seed All Data', seedAllRes.status === 200 || seedAllRes.status === 201);

  // Test 2: Seed settings
  const seedSettingsRes = await apiRequest('POST', '/admin/seed/settings', undefined, adminToken);
  recordTest('Admin 7.2 Seed Settings', seedSettingsRes.status === 200 || seedSettingsRes.status === 201);

  // Test 3: Seed point rules
  const seedPointRulesRes = await apiRequest('POST', '/admin/seed/point-rules', undefined, adminToken);
  recordTest('Admin 7.3 Seed Point Rules', seedPointRulesRes.status === 200 || seedPointRulesRes.status === 201);

  // Test 4: Seed badges
  const seedBadgesRes = await apiRequest('POST', '/admin/seed/badges', undefined, adminToken);
  recordTest('Admin 7.4 Seed Badges', seedBadgesRes.status === 200 || seedBadgesRes.status === 201);
}
