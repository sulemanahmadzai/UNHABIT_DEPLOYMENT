/**
 * New Endpoints Test Suite
 * Tests for endpoints added based on Figma designs
 */

import { apiRequest, recordTest, testContext, generateInvalidUUID, generateNonExistentUUID, verifyOperation, prisma } from './test-helpers';

export async function testNewEndpoints(userToken: string, userId: string) {
  console.log('\n📋 Testing New Endpoints (from Figma designs)...\n');

  // ============================================================================
  // NOTIFICATIONS FEED TESTS
  // ============================================================================
  
  // Test 1: Get notifications feed
  const getNotificationsRes = await apiRequest('GET', '/notifications', undefined, userToken);
  const notificationsValid = getNotificationsRes.status === 200 && 
    getNotificationsRes.data?.success === true &&
    Array.isArray(getNotificationsRes.data?.data);
  recordTest('New 1.1 Get Notifications Feed', notificationsValid,
    !notificationsValid ? `Expected 200 with array, got ${getNotificationsRes.status}` : undefined,
    getNotificationsRes.data);

  // Test 2: Get unread notifications
  const getUnreadRes = await apiRequest('GET', '/notifications?status=unread', undefined, userToken);
  recordTest('New 1.2 Get Unread Notifications', getUnreadRes.status === 200,
    getUnreadRes.status !== 200 ? `Expected 200, got ${getUnreadRes.status}` : undefined);

  // Test 3: Get read notifications
  const getReadRes = await apiRequest('GET', '/notifications?status=read', undefined, userToken);
  recordTest('New 1.3 Get Read Notifications', getReadRes.status === 200,
    getReadRes.status !== 200 ? `Expected 200, got ${getReadRes.status}` : undefined);

  // Test 4: Get notifications with limit
  const getWithLimitRes = await apiRequest('GET', '/notifications?limit=10', undefined, userToken);
  const limitValid = getWithLimitRes.status === 200 &&
    Array.isArray(getWithLimitRes.data?.data) &&
    getWithLimitRes.data.data.length <= 10;
  recordTest('New 1.4 Get Notifications - With limit', limitValid,
    !limitValid ? `Expected 200 with max 10 items, got ${getWithLimitRes.status}` : undefined);

  // Test 5: Get notifications with offset
  const getWithOffsetRes = await apiRequest('GET', '/notifications?limit=5&offset=0', undefined, userToken);
  recordTest('New 1.5 Get Notifications - With offset', getWithOffsetRes.status === 200);

  // Test 6: Get notifications with invalid status
  const invalidStatusRes = await apiRequest('GET', '/notifications?status=invalid', undefined, userToken);
  recordTest('New 1.6 Get Notifications - Invalid status', invalidStatusRes.status === 200 || invalidStatusRes.status === 400);

  // Test 7: Get notifications with negative limit
  const negativeLimitRes = await apiRequest('GET', '/notifications?limit=-1', undefined, userToken);
  recordTest('New 1.7 Get Notifications - Negative limit', negativeLimitRes.status === 200 || negativeLimitRes.status === 400);

  // Test 8: Get notifications - Unauthenticated
  const unauthenticatedRes = await apiRequest('GET', '/notifications');
  recordTest('New 1.8 Get Notifications - Unauthenticated', unauthenticatedRes.status === 401);

  // Test 9: Mark notification as read (if we have notifications)
  if (getNotificationsRes.data?.data && Array.isArray(getNotificationsRes.data.data) && getNotificationsRes.data.data.length > 0) {
    const firstNotification = getNotificationsRes.data.data[0];
    const firstNotificationId = firstNotification.id;
    const wasUnread = !firstNotification.is_read;
    
    const markReadRes = await apiRequest('POST', `/notifications/${firstNotificationId}/read`, undefined, userToken);
    const markReadValid = markReadRes.status === 200 && markReadRes.data?.success === true;
    recordTest('New 1.9 Mark Notification as Read', markReadValid,
      !markReadValid ? `Expected 200, got ${markReadRes.status}` : undefined,
      markReadRes.data);

    // Verify notification is now read
    if (markReadValid && wasUnread) {
      const verifyRes = await apiRequest('GET', `/notifications?status=read`, undefined, userToken);
      const foundInRead = verifyRes.data?.data?.some((n: any) => n.id === firstNotificationId);
      recordTest('New 1.9.1 Mark Notification as Read - Verified', foundInRead || !wasUnread);
    }
  } else {
    recordTest('New 1.9 Mark Notification as Read - SKIPPED (no notifications)', true);
  }

  // Test 10: Mark notification as read - Invalid ID format
  const invalidReadRes = await apiRequest('POST', '/notifications/invalid-id/read', undefined, userToken);
  recordTest('New 1.10 Mark Notification as Read - Invalid ID format', invalidReadRes.status === 400 || invalidReadRes.status === 404);

  // Test 11: Mark notification as read - Non-existent UUID
  const nonExistentReadRes = await apiRequest('POST', `/notifications/${generateNonExistentUUID()}/read`, undefined, userToken);
  recordTest('New 1.11 Mark Notification as Read - Non-existent', nonExistentReadRes.status === 404);

  // Test 12: Mark all notifications as read
  const markAllReadRes = await apiRequest('POST', '/notifications/mark-all-read', undefined, userToken);
  recordTest('New 1.12 Mark All Notifications as Read', markAllReadRes.status === 200,
    markAllReadRes.status !== 200 ? `Expected 200, got ${markAllReadRes.status}` : undefined);

  // Test 13: Mark all notifications as read - Unauthenticated
  const markAllUnauthRes = await apiRequest('POST', '/notifications/mark-all-read');
  recordTest('New 1.13 Mark All Notifications as Read - Unauthenticated', markAllUnauthRes.status === 401);

  // Test 14: Delete notification (if we have notifications)
  const getNotificationsAgainRes = await apiRequest('GET', '/notifications?limit=1', undefined, userToken);
  if (getNotificationsAgainRes.data?.data && Array.isArray(getNotificationsAgainRes.data.data) && getNotificationsAgainRes.data.data.length > 0) {
    const notificationToDelete = getNotificationsAgainRes.data.data[0];
    const deleteRes = await apiRequest('DELETE', `/notifications/${notificationToDelete.id}`, undefined, userToken);
    recordTest('New 1.14 Delete Notification', deleteRes.status === 200,
      deleteRes.status !== 200 ? `Expected 200, got ${deleteRes.status}` : undefined);

    // Verify notification is deleted (should not appear in list)
    const verifyDeleteRes = await apiRequest('GET', '/notifications', undefined, userToken);
    const stillExists = verifyDeleteRes.data?.data?.some((n: any) => n.id === notificationToDelete.id);
    recordTest('New 1.14.1 Delete Notification - Verified', !stillExists);
  } else {
    recordTest('New 1.14 Delete Notification - SKIPPED (no notifications)', true);
  }

  // Test 15: Delete notification - Invalid ID format
  const invalidDeleteRes = await apiRequest('DELETE', '/notifications/invalid-id', undefined, userToken);
  recordTest('New 1.15 Delete Notification - Invalid ID format', invalidDeleteRes.status === 400 || invalidDeleteRes.status === 404);

  // Test 16: Delete notification - Non-existent
  const nonExistentDeleteRes = await apiRequest('DELETE', `/notifications/${generateNonExistentUUID()}`, undefined, userToken);
  recordTest('New 1.16 Delete Notification - Non-existent', nonExistentDeleteRes.status === 404);

  // Test 17: Delete notification - Unauthenticated
  const deleteUnauthRes = await apiRequest('DELETE', `/notifications/${generateNonExistentUUID()}`);
  recordTest('New 1.17 Delete Notification - Unauthenticated', deleteUnauthRes.status === 401);

  // ============================================================================
  // DAILY CHALLENGES TESTS
  // ============================================================================
  
  // Test 1: Get daily challenge
  const getChallengeRes = await apiRequest('GET', '/challenges/daily', undefined, userToken);
  const challengeId = getChallengeRes.data?.data?.id;
  const challengeExists = getChallengeRes.status === 200 || getChallengeRes.status === 404;
  recordTest('New 2.1 Get Daily Challenge', challengeExists,
    !challengeExists ? `Expected 200 or 404, got ${getChallengeRes.status}` : undefined,
    getChallengeRes.data);

  // Test 2: Get daily challenge - Verify structure (if challenge exists)
  if (challengeId && getChallengeRes.status === 200) {
    const challenge = getChallengeRes.data.data;
    const hasRequiredFields = challenge.id && challenge.title && challenge.description && 
      challenge.reward_xp !== undefined && challenge.challenge_type && challenge.expires_at;
    recordTest('New 2.2 Get Daily Challenge - Verify structure', hasRequiredFields,
      !hasRequiredFields ? 'Missing required fields in challenge response' : undefined);
  } else {
    recordTest('New 2.2 Get Daily Challenge - Verify structure - SKIPPED (no challenge)', true);
  }

  // Test 3: Get daily challenge - Unauthenticated
  const getChallengeUnauthRes = await apiRequest('GET', '/challenges/daily');
  recordTest('New 2.3 Get Daily Challenge - Unauthenticated', getChallengeUnauthRes.status === 401);

  // Test 4: Accept challenge (if challenge exists)
  if (challengeId) {
    const acceptRes = await apiRequest('POST', `/challenges/${challengeId}/accept`, undefined, userToken);
    const acceptValid = acceptRes.status === 200 || acceptRes.status === 201;
    recordTest('New 2.4 Accept Challenge', acceptValid,
      !acceptValid ? `Expected 200/201, got ${acceptRes.status}` : undefined,
      acceptRes.data);

    // Test 5: Accept same challenge again (should still work or return conflict)
    if (acceptValid) {
      const acceptAgainRes = await apiRequest('POST', `/challenges/${challengeId}/accept`, undefined, userToken);
      recordTest('New 2.5 Accept Challenge - Already accepted', 
        acceptAgainRes.status === 200 || acceptAgainRes.status === 201 || acceptAgainRes.status === 409);
    }
  } else {
    recordTest('New 2.4 Accept Challenge - SKIPPED (no challenge)', true);
    recordTest('New 2.5 Accept Challenge - Already accepted - SKIPPED (no challenge)', true);
  }

  // Test 6: Accept challenge - Invalid ID format
  const invalidAcceptRes = await apiRequest('POST', '/challenges/invalid-id/accept', undefined, userToken);
  recordTest('New 2.6 Accept Challenge - Invalid ID format', invalidAcceptRes.status === 400 || invalidAcceptRes.status === 404);

  // Test 7: Accept challenge - Non-existent UUID
  const nonExistentAcceptRes = await apiRequest('POST', `/challenges/${generateNonExistentUUID()}/accept`, undefined, userToken);
  recordTest('New 2.7 Accept Challenge - Non-existent', nonExistentAcceptRes.status === 404);

  // Test 8: Accept challenge - Unauthenticated
  const acceptUnauthRes = await apiRequest('POST', `/challenges/${challengeId || 'test-id'}/accept`);
  recordTest('New 2.8 Accept Challenge - Unauthenticated', acceptUnauthRes.status === 401);

  // Test 9: Complete challenge (if challenge exists)
  if (challengeId) {
    const completeRes = await apiRequest('POST', `/challenges/${challengeId}/complete`, undefined, userToken);
    const completeValid = completeRes.status === 200 || completeRes.status === 201;
    recordTest('New 2.9 Complete Challenge', completeValid,
      !completeValid ? `Expected 200/201, got ${completeRes.status}` : undefined,
      completeRes.data);

    // Verify XP was awarded
    if (completeValid) {
      const xpEarned = completeRes.data?.data?.xp_earned;
      const pointsRes = await apiRequest('GET', '/user/points-balance', undefined, userToken);
      recordTest('New 2.9.1 Complete Challenge - XP Awarded', 
        xpEarned !== undefined && xpEarned > 0,
        xpEarned === undefined ? 'XP not returned in response' : undefined);
    }

    // Test 10: Complete challenge again (should fail or return conflict)
    const completeAgainRes = await apiRequest('POST', `/challenges/${challengeId}/complete`, undefined, userToken);
    recordTest('New 2.10 Complete Challenge - Already completed', 
      completeAgainRes.status === 404 || completeAgainRes.status === 409 || completeAgainRes.status === 200);
  } else {
    recordTest('New 2.9 Complete Challenge - SKIPPED (no challenge)', true);
    recordTest('New 2.9.1 Complete Challenge - XP Awarded - SKIPPED (no challenge)', true);
    recordTest('New 2.10 Complete Challenge - Already completed - SKIPPED (no challenge)', true);
  }

  // Test 11: Complete challenge - Invalid ID format
  const invalidCompleteRes = await apiRequest('POST', '/challenges/invalid-id/complete', undefined, userToken);
  recordTest('New 2.11 Complete Challenge - Invalid ID format', invalidCompleteRes.status === 400 || invalidCompleteRes.status === 404);

  // Test 12: Complete challenge - Non-existent
  const nonExistentCompleteRes = await apiRequest('POST', `/challenges/${generateNonExistentUUID()}/complete`, undefined, userToken);
  recordTest('New 2.12 Complete Challenge - Non-existent', nonExistentCompleteRes.status === 404);

  // Test 13: Complete challenge - Unauthenticated
  const completeUnauthRes = await apiRequest('POST', `/challenges/${challengeId || 'test-id'}/complete`);
  recordTest('New 2.13 Complete Challenge - Unauthenticated', completeUnauthRes.status === 401);

  // ============================================================================
  // COMPREHENSIVE SETTINGS TESTS
  // ============================================================================
  
  // Test 1: Get all settings
  const getAllSettingsRes = await apiRequest('GET', '/settings', undefined, userToken);
  const settingsValid = getAllSettingsRes.status === 200 &&
    getAllSettingsRes.data?.success === true &&
    getAllSettingsRes.data?.data?.privacy !== undefined &&
    getAllSettingsRes.data?.data?.share !== undefined &&
    getAllSettingsRes.data?.data?.notifications !== undefined &&
    getAllSettingsRes.data?.data?.devices !== undefined;
  recordTest('New 3.1 Get All Settings', settingsValid,
    !settingsValid ? `Expected 200 with all settings, got ${getAllSettingsRes.status}` : undefined,
    getAllSettingsRes.data);

  // Test 2: Get all settings - Unauthenticated
  const getAllSettingsUnauthRes = await apiRequest('GET', '/settings');
  recordTest('New 3.2 Get All Settings - Unauthenticated', getAllSettingsUnauthRes.status === 401);

  // Test 3: Get AI Coach preferences
  const getAIPrefsRes = await apiRequest('GET', '/settings/ai-coach-preferences', undefined, userToken);
  const prefsValid = getAIPrefsRes.status === 200 &&
    getAIPrefsRes.data?.success === true &&
    getAIPrefsRes.data?.data?.enabled !== undefined &&
    getAIPrefsRes.data?.data?.tone !== undefined &&
    getAIPrefsRes.data?.data?.frequency !== undefined;
  recordTest('New 3.3 Get AI Coach Preferences', prefsValid,
    !prefsValid ? `Expected 200 with preferences, got ${getAIPrefsRes.status}` : undefined,
    getAIPrefsRes.data);

  // Test 4: Get AI Coach preferences - Unauthenticated
  const getAIPrefsUnauthRes = await apiRequest('GET', '/settings/ai-coach-preferences');
  recordTest('New 3.4 Get AI Coach Preferences - Unauthenticated', getAIPrefsUnauthRes.status === 401);

  // Test 5: Update AI Coach preferences - All fields
  const updateAIPrefsRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    {
      enabled: true,
      tone: 'motivational',
      frequency: 'daily',
      topics: ['motivation', 'tips', 'challenges']
    },
    userToken
  );
  recordTest('New 3.5 Update AI Coach Preferences - All fields', updateAIPrefsRes.status === 200,
    updateAIPrefsRes.status !== 200 ? `Expected 200, got ${updateAIPrefsRes.status}` : undefined,
    updateAIPrefsRes.data);

  // Test 6: Update AI Coach preferences - Partial update (only tone)
  const updateToneRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    { tone: 'supportive' },
    userToken
  );
  recordTest('New 3.6 Update AI Coach Preferences - Partial (tone)', updateToneRes.status === 200);

  // Test 7: Update AI Coach preferences - Partial update (only frequency)
  const updateFreqRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    { frequency: 'weekly' },
    userToken
  );
  recordTest('New 3.7 Update AI Coach Preferences - Partial (frequency)', updateFreqRes.status === 200);

  // Test 8: Update AI Coach preferences - Partial update (only topics)
  const updateTopicsRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    { topics: ['motivation'] },
    userToken
  );
  recordTest('New 3.8 Update AI Coach Preferences - Partial (topics)', updateTopicsRes.status === 200);

  // Test 9: Update AI Coach preferences - Empty topics array
  const emptyTopicsRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    { topics: [] },
    userToken
  );
  recordTest('New 3.9 Update AI Coach Preferences - Empty topics', emptyTopicsRes.status === 200 || emptyTopicsRes.status === 400);

  // Test 10: Update AI Coach preferences - Invalid tone
  const invalidToneRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    { tone: 'invalid_tone' },
    userToken
  );
  recordTest('New 3.10 Update AI Coach Preferences - Invalid tone', invalidToneRes.status === 400,
    invalidToneRes.status !== 400 ? `Expected 400, got ${invalidToneRes.status}` : undefined);

  // Test 11: Update AI Coach preferences - Invalid frequency
  const invalidFreqRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    { frequency: 'invalid_frequency' },
    userToken
  );
  recordTest('New 3.11 Update AI Coach Preferences - Invalid frequency', invalidFreqRes.status === 400,
    invalidFreqRes.status !== 400 ? `Expected 400, got ${invalidFreqRes.status}` : undefined);

  // Test 12: Update AI Coach preferences - Invalid enabled (not boolean)
  const invalidEnabledRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    { enabled: 'yes' },
    userToken
  );
  recordTest('New 3.12 Update AI Coach Preferences - Invalid enabled', invalidEnabledRes.status === 400);

  // Test 13: Update AI Coach preferences - Empty body
  const emptyBodyRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    {},
    userToken
  );
  recordTest('New 3.13 Update AI Coach Preferences - Empty body', emptyBodyRes.status === 200 || emptyBodyRes.status === 400);

  // Test 14: Update AI Coach preferences - Unauthenticated
  const updateUnauthRes = await apiRequest(
    'PUT',
    '/settings/ai-coach-preferences',
    { tone: 'motivational' }
  );
  recordTest('New 3.14 Update AI Coach Preferences - Unauthenticated', updateUnauthRes.status === 401);

  // ============================================================================
  // LOGOUT TESTS
  // ============================================================================
  
  // Test 1: Logout
  const logoutRes = await apiRequest('POST', '/auth/logout', undefined, userToken);
  recordTest('New 4.1 Logout', logoutRes.status === 200,
    logoutRes.status !== 200 ? `Expected 200, got ${logoutRes.status}` : undefined,
    logoutRes.data);

  // Test 2: Logout - Verify response structure
  if (logoutRes.status === 200) {
    const hasSuccess = logoutRes.data?.success === true;
    recordTest('New 4.2 Logout - Verify response', hasSuccess,
      !hasSuccess ? 'Response missing success field' : undefined);
  } else {
    recordTest('New 4.2 Logout - Verify response - SKIPPED (logout failed)', true);
  }

  // Test 3: Logout - Unauthenticated
  const logoutUnauthRes = await apiRequest('POST', '/auth/logout');
  recordTest('New 4.3 Logout - Unauthenticated', logoutUnauthRes.status === 401,
    logoutUnauthRes.status !== 401 ? `Expected 401, got ${logoutUnauthRes.status}` : undefined);

  // Note: After logout, token might be invalidated, but we continue with tests
  // as the backend might not actually invalidate tokens (Supabase handles this client-side)

  // ============================================================================
  // MISSED DAYS SUMMARY TESTS
  // ============================================================================
  
  // Test 1: Get missed days summary
  const missedDaysRes = await apiRequest('GET', '/analytics/missed-days', undefined, userToken);
  const missedDaysValid = missedDaysRes.status === 200 &&
    missedDaysRes.data?.success === true &&
    missedDaysRes.data?.data?.total_missed !== undefined &&
    missedDaysRes.data?.data?.last_missed_days_ago !== undefined;
  recordTest('New 5.1 Get Missed Days Summary', missedDaysValid,
    !missedDaysValid ? `Expected 200 with total_missed and last_missed_days_ago, got ${missedDaysRes.status}` : undefined,
    missedDaysRes.data);

  // Test 2: Get missed days summary - Verify data types
  if (missedDaysValid) {
    const data = missedDaysRes.data.data;
    const typesValid = typeof data.total_missed === 'number' &&
      (data.last_missed_days_ago === null || typeof data.last_missed_days_ago === 'number');
    recordTest('New 5.2 Get Missed Days Summary - Verify data types', typesValid,
      !typesValid ? 'Invalid data types in response' : undefined);
  } else {
    recordTest('New 5.2 Get Missed Days Summary - Verify data types - SKIPPED', true);
  }

  // Test 3: Get missed days summary - Unauthenticated
  const missedDaysUnauthRes = await apiRequest('GET', '/analytics/missed-days');
  recordTest('New 5.3 Get Missed Days Summary - Unauthenticated', missedDaysUnauthRes.status === 401);

  // ============================================================================
  // HABIT HEALTH TREND TESTS
  // ============================================================================
  
  // Test 1: Get habit health trend
  const healthTrendRes = await apiRequest('GET', '/analytics/habit-health-trend', undefined, userToken);
  const trendValid = healthTrendRes.status === 200 &&
    healthTrendRes.data?.success === true &&
    healthTrendRes.data?.data?.trend !== undefined &&
    Array.isArray(healthTrendRes.data.data.trend) &&
    healthTrendRes.data?.data?.current_health !== undefined &&
    healthTrendRes.data?.data?.change_percent !== undefined;
  recordTest('New 6.1 Get Habit Health Trend', trendValid,
    !trendValid ? `Expected 200 with trend array, current_health, change_percent, got ${healthTrendRes.status}` : undefined,
    healthTrendRes.data);

  // Test 2: Get habit health trend - Verify trend structure
  if (trendValid && healthTrendRes.data.data.trend.length > 0) {
    const firstTrendItem = healthTrendRes.data.data.trend[0];
    const hasRequiredFields = firstTrendItem.date && firstTrendItem.health !== undefined;
    recordTest('New 6.2 Get Habit Health Trend - Verify trend structure', hasRequiredFields,
      !hasRequiredFields ? 'Trend items missing required fields' : undefined);
  } else {
    recordTest('New 6.2 Get Habit Health Trend - Verify trend structure - SKIPPED (no trend data)', true);
  }

  // Test 3: Get habit health trend with days parameter
  const healthTrendDaysRes = await apiRequest('GET', '/analytics/habit-health-trend?days=14', undefined, userToken);
  recordTest('New 6.3 Get Habit Health Trend - With days', healthTrendDaysRes.status === 200,
    healthTrendDaysRes.status !== 200 ? `Expected 200, got ${healthTrendDaysRes.status}` : undefined);

  // Test 4: Get habit health trend with invalid days (negative)
  const invalidDaysRes = await apiRequest('GET', '/analytics/habit-health-trend?days=-1', undefined, userToken);
  recordTest('New 6.4 Get Habit Health Trend - Negative days', invalidDaysRes.status === 200 || invalidDaysRes.status === 400);

  // Test 5: Get habit health trend with invalid days (non-numeric)
  const nonNumericDaysRes = await apiRequest('GET', '/analytics/habit-health-trend?days=abc', undefined, userToken);
  recordTest('New 6.5 Get Habit Health Trend - Non-numeric days', nonNumericDaysRes.status === 200 || nonNumericDaysRes.status === 400);

  // Test 6: Get habit health trend with very large days
  const largeDaysRes = await apiRequest('GET', '/analytics/habit-health-trend?days=1000', undefined, userToken);
  recordTest('New 6.6 Get Habit Health Trend - Large days', largeDaysRes.status === 200 || largeDaysRes.status === 400);

  // Test 7: Get habit health trend - Unauthenticated
  const trendUnauthRes = await apiRequest('GET', '/analytics/habit-health-trend');
  recordTest('New 6.7 Get Habit Health Trend - Unauthenticated', trendUnauthRes.status === 401);

  // ============================================================================
  // ENHANCED BUDDIES ENDPOINTS TESTS
  // ============================================================================
  
  // Test 1: Get buddies (should now include daily_status)
  const getBuddiesRes = await apiRequest('GET', '/buddies', undefined, userToken);
  const buddiesValid = getBuddiesRes.status === 200 && 
    getBuddiesRes.data?.success === true &&
    Array.isArray(getBuddiesRes.data?.data) &&
    (getBuddiesRes.data.data.length === 0 || getBuddiesRes.data.data[0].hasOwnProperty('daily_status'));
  recordTest('New 7.1 Get Buddies - With daily_status', buddiesValid,
    !buddiesValid ? `Expected 200 with daily_status field, got ${getBuddiesRes.status}` : undefined,
    getBuddiesRes.data);

  // Test 2: Get buddies - Verify daily_status values
  if (buddiesValid && getBuddiesRes.data.data.length > 0) {
    const firstBuddy = getBuddiesRes.data.data[0];
    const validStatus = ['PENDING', 'COMPLETED', 'MISSED'].includes(firstBuddy.daily_status);
    recordTest('New 7.2 Get Buddies - Verify daily_status values', validStatus,
      !validStatus ? `Invalid daily_status value: ${firstBuddy.daily_status}` : undefined);
  } else {
    recordTest('New 7.2 Get Buddies - Verify daily_status values - SKIPPED (no buddies)', true);
  }

  // Test 3: Get buddies - Verify streak_days field
  if (buddiesValid && getBuddiesRes.data.data.length > 0) {
    const firstBuddy = getBuddiesRes.data.data[0];
    const hasStreakDays = firstBuddy.hasOwnProperty('streak_days') && typeof firstBuddy.streak_days === 'number';
    recordTest('New 7.3 Get Buddies - Verify streak_days field', hasStreakDays,
      !hasStreakDays ? 'Missing or invalid streak_days field' : undefined);
  } else {
    recordTest('New 7.3 Get Buddies - Verify streak_days field - SKIPPED (no buddies)', true);
  }

  // Test 4: Get buddies - Unauthenticated
  const getBuddiesUnauthRes = await apiRequest('GET', '/buddies');
  recordTest('New 7.4 Get Buddies - Unauthenticated', getBuddiesUnauthRes.status === 401);

  // Test 5: Get buddy profile (should now include level, habit_health, streak summary)
  if (testContext.currentBuddyLinkId) {
    const buddyProfileRes = await apiRequest('GET', `/buddies/${testContext.currentBuddyLinkId}/profile`, undefined, userToken);
    const profileValid = buddyProfileRes.status === 200 &&
      buddyProfileRes.data?.success === true &&
      buddyProfileRes.data?.data?.level !== undefined &&
      buddyProfileRes.data?.data?.habit_health !== undefined &&
      buddyProfileRes.data?.data?.streak?.weekly_completion !== undefined;
    recordTest('New 7.5 Get Buddy Profile - Enhanced', profileValid,
      !profileValid ? `Expected 200 with level, habit_health, weekly_completion, got ${buddyProfileRes.status}` : undefined,
      buddyProfileRes.data);

    // Test 6: Get buddy profile - Verify level structure
    if (profileValid) {
      const level = buddyProfileRes.data.data.level;
      const levelValid = level.current !== undefined &&
        level.name !== undefined &&
        level.progress !== undefined &&
        level.total_xp !== undefined;
      recordTest('New 7.6 Get Buddy Profile - Verify level structure', levelValid,
        !levelValid ? 'Level object missing required fields' : undefined);
    } else {
      recordTest('New 7.6 Get Buddy Profile - Verify level structure - SKIPPED', true);
    }

    // Test 7: Get buddy profile - Verify habit_health range
    if (profileValid) {
      const habitHealth = buddyProfileRes.data.data.habit_health;
      const healthValid = typeof habitHealth === 'number' && habitHealth >= 0 && habitHealth <= 100;
      recordTest('New 7.7 Get Buddy Profile - Verify habit_health range', healthValid,
        !healthValid ? `Invalid habit_health value: ${habitHealth}` : undefined);
    } else {
      recordTest('New 7.7 Get Buddy Profile - Verify habit_health range - SKIPPED', true);
    }

    // Test 8: Get buddy profile - Verify weekly_completion structure
    if (profileValid) {
      const weeklyCompletion = buddyProfileRes.data.data.streak.weekly_completion;
      const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const completionValid = typeof weeklyCompletion === 'object' &&
        weekDays.every(day => weeklyCompletion.hasOwnProperty(day) && typeof weeklyCompletion[day] === 'boolean');
      recordTest('New 7.8 Get Buddy Profile - Verify weekly_completion structure', completionValid,
        !completionValid ? 'Weekly completion missing days or invalid structure' : undefined);
    } else {
      recordTest('New 7.8 Get Buddy Profile - Verify weekly_completion structure - SKIPPED', true);
    }

    // Test 9: Get buddy profile - Verify member_since
    if (profileValid) {
      const hasMemberSince = buddyProfileRes.data.data.member_since !== undefined;
      recordTest('New 7.9 Get Buddy Profile - Verify member_since', hasMemberSince,
        !hasMemberSince ? 'Missing member_since field' : undefined);
    } else {
      recordTest('New 7.9 Get Buddy Profile - Verify member_since - SKIPPED', true);
    }
  } else {
    recordTest('New 7.5 Get Buddy Profile - Enhanced - SKIPPED (no buddy link)', true);
    recordTest('New 7.6 Get Buddy Profile - Verify level structure - SKIPPED (no buddy link)', true);
    recordTest('New 7.7 Get Buddy Profile - Verify habit_health range - SKIPPED (no buddy link)', true);
    recordTest('New 7.8 Get Buddy Profile - Verify weekly_completion structure - SKIPPED (no buddy link)', true);
    recordTest('New 7.9 Get Buddy Profile - Verify member_since - SKIPPED (no buddy link)', true);
  }

  // Test 10: Get buddy profile - Invalid buddy link ID format
  const invalidProfileRes = await apiRequest('GET', '/buddies/invalid-id/profile', undefined, userToken);
  recordTest('New 7.10 Get Buddy Profile - Invalid ID format', invalidProfileRes.status === 400 || invalidProfileRes.status === 404);

  // Test 11: Get buddy profile - Non-existent buddy link
  const nonExistentProfileRes = await apiRequest('GET', `/buddies/${generateNonExistentUUID()}/profile`, undefined, userToken);
  recordTest('New 7.11 Get Buddy Profile - Non-existent', nonExistentProfileRes.status === 404);

  // Test 12: Get buddy profile - Unauthenticated
  const profileUnauthRes = await apiRequest('GET', `/buddies/${testContext.currentBuddyLinkId || 'test-id'}/profile`);
  recordTest('New 7.12 Get Buddy Profile - Unauthenticated', profileUnauthRes.status === 401);
}
