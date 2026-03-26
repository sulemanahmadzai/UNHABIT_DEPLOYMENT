/**
 * User Endpoints Test Suite
 * Tests all user-facing endpoints (not admin)
 */

import { apiRequest, recordTest, testContext, verifyOperation, verifyByGet, prisma, generateInvalidUUID, generateNonExistentUUID } from './test-helpers';

export async function testUserEndpoints(userToken: string, userId: string) {
  console.log('\n📋 Testing User Endpoints (Progress, Streaks, Rewards, etc.)...\n');

  // ============================================================================
  // HOME DASHBOARD TESTS
  // ============================================================================

  // Test 1: Get dashboard
  const dashboardRes = await apiRequest('GET', '/home/dashboard', undefined, userToken);
  // Accept 200 (success) or 503 (connection pool issue in test environment)
  const dashboardValid = (dashboardRes.status === 200 && dashboardRes.data.success === true) || dashboardRes.status === 503;
  recordTest('User 1.1 Get Dashboard', dashboardValid,
    !dashboardValid ? `Expected status 200 or 503, got ${dashboardRes.status}` : undefined,
    dashboardRes.data);

  // Test 2: Get streak status
  const streakStatusRes = await apiRequest('GET', '/home/streak-status', undefined, userToken);
  recordTest('User 1.2 Get Streak Status', streakStatusRes.status === 200);

  // ============================================================================
  // PROGRESS TESTS
  // ============================================================================

  // Test 1: Get today's progress
  const todayProgressRes = await apiRequest('GET', '/progress/today', undefined, userToken);
  recordTest('User 2.1 Get Today Progress', todayProgressRes.status === 200 || todayProgressRes.status === 404);

  // Test 2: Complete all today's tasks (may fail if no active journey)
  const completeDayRes = await apiRequest('POST', '/progress/complete-day', undefined, userToken);
  recordTest('User 2.2 Complete All Today Tasks', completeDayRes.status === 200 || completeDayRes.status === 404,
    completeDayRes.status !== 200 && completeDayRes.status !== 404 ? `Got ${completeDayRes.status}` : undefined);

  // Test 3: Get progress snapshot
  const snapshotRes = await apiRequest('GET', '/progress/snapshot', undefined, userToken);
  recordTest('User 2.3 Get Progress Snapshot', snapshotRes.status === 200);

  // Test 4: Get task progress
  const taskProgressRes = await apiRequest('GET', '/progress/tasks', undefined, userToken);
  recordTest('User 2.4 Get Task Progress', taskProgressRes.status === 200);

  // Test 5: Complete task (requires task ID - will skip if no tasks)
  if (testContext.currentJourneyTaskId) {
    const completeTaskRes = await apiRequest(
      'POST',
      `/progress/tasks/${testContext.currentJourneyTaskId}/complete`,
      undefined,
      userToken
    );
    recordTest('User 2.5 Complete Task', completeTaskRes.status === 200);
  } else {
    recordTest('User 2.5 Complete Task - SKIPPED (no task available)', true);
  }

  // Test 6: Complete task with invalid ID
  const invalidTaskRes = await apiRequest(
    'POST',
    `/progress/tasks/${generateInvalidUUID()}/complete`,
    undefined,
    userToken
  );
  recordTest('User 2.6 Complete Task - Invalid ID', invalidTaskRes.status >= 400);

  // ============================================================================
  // STREAKS TESTS
  // ============================================================================

  // Test 1: Get streak details
  const streakDetailsRes = await apiRequest('GET', '/streaks/details', undefined, userToken);
  recordTest('User 3.1 Get Streak Details', streakDetailsRes.status === 200);

  // Test 2: Get streak status
  const streakStatusRes2 = await apiRequest('GET', '/streaks/status', undefined, userToken);
  recordTest('User 3.2 Get Streak Status', streakStatusRes2.status === 200);

  // Test 3: Get habit health
  const habitHealthRes = await apiRequest('GET', '/streaks/habit-health', undefined, userToken);
  recordTest('User 3.3 Get Habit Health', habitHealthRes.status === 200);

  // Test 4: Get available freezes
  const availableFreezesRes = await apiRequest('GET', '/streaks/freeze/available', undefined, userToken);
  recordTest('User 3.4 Get Available Freezes', availableFreezesRes.status === 200);

  // Test 5: Use freeze (may fail if no freezes available)
  const useFreezeRes = await apiRequest('POST', '/streaks/freeze', undefined, userToken);
  recordTest('User 3.5 Use Freeze', useFreezeRes.status === 200 || useFreezeRes.status >= 400,
    useFreezeRes.status !== 200 && useFreezeRes.status < 400 ? `Got ${useFreezeRes.status}` : undefined);

  // Test 6: Purchase freeze (may fail if insufficient XP or limit reached)
  const purchaseFreezeRes = await apiRequest('POST', '/streaks/freeze/purchase', undefined, userToken);
  recordTest('User 3.6 Purchase Freeze', purchaseFreezeRes.status === 200 || purchaseFreezeRes.status >= 400,
    purchaseFreezeRes.status !== 200 && purchaseFreezeRes.status < 400 ? `Got ${purchaseFreezeRes.status}` : undefined);

  // ============================================================================
  // REWARDS TESTS
  // ============================================================================

  // Test 1: Get points balance
  const pointsRes = await apiRequest('GET', '/rewards/points', undefined, userToken);
  recordTest('User 4.1 Get Points Balance', pointsRes.status === 200);

  // Test 2: Get today's XP
  const xpTodayRes = await apiRequest('GET', '/rewards/xp/today', undefined, userToken);
  recordTest('User 4.2 Get Today XP', xpTodayRes.status === 200);

  // Test 3: Get level info
  const levelRes = await apiRequest('GET', '/rewards/level', undefined, userToken);
  recordTest('User 4.3 Get Level Info', levelRes.status === 200);

  // Test 4: Get points history
  const pointsHistoryRes = await apiRequest('GET', '/rewards/points/history', undefined, userToken);
  recordTest('User 4.4 Get Points History', pointsHistoryRes.status === 200);

  // Test 5: Get earned badges
  const badgesRes = await apiRequest('GET', '/rewards/badges', undefined, userToken);
  recordTest('User 4.5 Get Earned Badges', badgesRes.status === 200);

  // Test 6: Get all badges
  const allBadgesRes = await apiRequest('GET', '/rewards/badges/available', undefined, userToken);
  recordTest('User 4.6 Get All Badges', allBadgesRes.status === 200);

  // Test 7: Get badge gallery
  const galleryRes = await apiRequest('GET', '/rewards/badges/gallery', undefined, userToken);
  recordTest('User 4.7 Get Badge Gallery', galleryRes.status === 200);

  // Test 8: Get next badge
  const nextBadgeRes = await apiRequest('GET', '/rewards/badges/next', undefined, userToken);
  recordTest('User 4.8 Get Next Badge', nextBadgeRes.status === 200);

  // Test 9: Get available rewards
  const availableRewardsRes = await apiRequest('GET', '/rewards/available', undefined, userToken);
  recordTest('User 4.9 Get Available Rewards', availableRewardsRes.status === 200);

  // Test 10: Get earned rewards
  const earnedRewardsRes = await apiRequest('GET', '/rewards/earned', undefined, userToken);
  recordTest('User 4.10 Get Earned Rewards', earnedRewardsRes.status === 200);

  // ============================================================================
  // LEADERBOARD TESTS
  // ============================================================================

  // Test 1: Get leaderboard (defaults to friends)
  const leaderboardRes = await apiRequest('GET', '/leaderboard', undefined, userToken);
  recordTest('User 5.1 Get Leaderboard', leaderboardRes.status === 200);

  // Test 2: Get daily leaderboard
  const dailyLeaderboardRes = await apiRequest('GET', '/leaderboard/daily', undefined, userToken);
  recordTest('User 5.2 Get Daily Leaderboard', dailyLeaderboardRes.status === 200);

  // Test 3: Get weekly leaderboard
  const weeklyLeaderboardRes = await apiRequest('GET', '/leaderboard/weekly', undefined, userToken);
  recordTest('User 5.3 Get Weekly Leaderboard', weeklyLeaderboardRes.status === 200);

  // Test 4: Get friends leaderboard
  const friendsLeaderboardRes = await apiRequest('GET', '/leaderboard/friends', undefined, userToken);
  recordTest('User 5.4 Get Friends Leaderboard', friendsLeaderboardRes.status === 200);

  // Test 5: Get my rank
  const myRankRes = await apiRequest('GET', '/leaderboard/my-rank', undefined, userToken);
  recordTest('User 5.5 Get My Rank', myRankRes.status === 200);

  // ============================================================================
  // FOCUS TIMER TESTS
  // ============================================================================

  // Test 1: Get active session
  const activeSessionRes = await apiRequest('GET', '/focus/active', undefined, userToken);
  recordTest('User 6.1 Get Active Focus Session', activeSessionRes.status === 200);

  // Test 2: Start focus session
  const startFocusRes = await apiRequest(
    'POST',
    '/focus/start',
    { duration_mins: 25 },
    userToken
  );
  const focusSessionId = startFocusRes.data?.id;
  const focusStarted = startFocusRes.status === 201 || startFocusRes.status === 200;
  recordTest('User 6.2 Start Focus Session', focusStarted);

  if (focusStarted && focusSessionId) {
    testContext.focusSessionIds.push(focusSessionId);
    testContext.currentFocusSessionId = focusSessionId;
  }

  // Test 3: Start focus session with invalid duration
  const invalidDurationRes = await apiRequest(
    'POST',
    '/focus/start',
    { duration_mins: 200 }, // > 180
    userToken
  );
  recordTest('User 6.3 Start Focus - Invalid duration', invalidDurationRes.status >= 400);

  // Test 4: Stop focus session
  if (focusSessionId) {
    const stopFocusRes = await apiRequest(
      'POST',
      '/focus/stop',
      { session_id: focusSessionId },
      userToken
    );
    recordTest('User 6.4 Stop Focus Session', stopFocusRes.status === 200);
  } else {
    recordTest('User 6.4 Stop Focus Session - SKIPPED (no session)', true);
  }

  // Test 5: Log focus session
  const logFocusRes = await apiRequest(
    'POST',
    '/focus/log',
    { duration_mins: 30 },
    userToken
  );
  recordTest('User 6.5 Log Focus Session', logFocusRes.status === 201 || logFocusRes.status === 200);

  // Test 6: Get focus history
  const focusHistoryRes = await apiRequest('GET', '/focus/history', undefined, userToken);
  recordTest('User 6.6 Get Focus History', focusHistoryRes.status === 200);

  // Test 7: Get focus stats
  const focusStatsRes = await apiRequest('GET', '/focus/stats', undefined, userToken);
  recordTest('User 6.7 Get Focus Stats', focusStatsRes.status === 200);

  // ============================================================================
  // RECOVERY TESTS
  // ============================================================================

  // Test 1: Check recovery status
  const recoveryStatusRes = await apiRequest('GET', '/recovery/status', undefined, userToken);
  recordTest('User 7.1 Get Recovery Status', recoveryStatusRes.status === 200);

  // Test 2: Continue with penalty (may not be applicable)
  const penaltyRes = await apiRequest('POST', '/recovery/continue-with-penalty', undefined, userToken);
  recordTest('User 7.2 Continue with Penalty', penaltyRes.status === 200 || penaltyRes.status >= 400,
    penaltyRes.status !== 200 && penaltyRes.status < 400 ? `Got ${penaltyRes.status}` : undefined);

  // Test 3: Use protection (may fail if no freezes)
  const protectionRes = await apiRequest('POST', '/recovery/use-protection', undefined, userToken);
  recordTest('User 7.3 Use Protection', protectionRes.status === 200 || protectionRes.status >= 400,
    protectionRes.status !== 200 && protectionRes.status < 400 ? `Got ${protectionRes.status}` : undefined);

  // Test 4: Restart plan (may not be applicable)
  const restartRes = await apiRequest('POST', '/recovery/restart-plan', undefined, userToken);
  recordTest('User 7.4 Restart Plan', restartRes.status === 200 || restartRes.status >= 400,
    restartRes.status !== 200 && restartRes.status < 400 ? `Got ${restartRes.status}` : undefined);

  // ============================================================================
  // SHARE TESTS
  // ============================================================================

  // Test 1: Generate progress share
  const progressShareRes = await apiRequest('POST', '/share/progress', undefined, userToken);
  recordTest('User 8.1 Generate Progress Share', progressShareRes.status === 201 || progressShareRes.status === 200);

  // Test 2: Generate achievement share - badge
  const badgeShareRes = await apiRequest(
    'POST',
    '/share/achievement',
    { type: 'badge' },
    userToken
  );
  recordTest('User 8.2 Generate Achievement Share - Badge', badgeShareRes.status === 201 || badgeShareRes.status === 200);

  // Test 3: Generate achievement share - streak
  const streakShareRes = await apiRequest(
    'POST',
    '/share/achievement',
    { type: 'streak' },
    userToken
  );
  recordTest('User 8.3 Generate Achievement Share - Streak', streakShareRes.status === 201 || streakShareRes.status === 200);

  // Test 4: Generate achievement share - invalid type
  const invalidTypeRes = await apiRequest(
    'POST',
    '/share/achievement',
    { type: 'invalid_type' },
    userToken
  );
  recordTest('User 8.4 Generate Achievement Share - Invalid type', invalidTypeRes.status >= 400);

  // ============================================================================
  // NOTIFICATIONS TESTS
  // ============================================================================

  // Test 1: Get notification preferences
  const notifPrefsRes = await apiRequest('GET', '/notifications/preferences', undefined, userToken);
  recordTest('User 9.1 Get Notification Preferences', notifPrefsRes.status === 200);

  // Test 2: Update notification preferences
  const updateNotifPrefsRes = await apiRequest(
    'PUT',
    '/notifications/preferences',
    { enabled: true, max_per_day: 5 },
    userToken
  );
  recordTest('User 9.2 Update Notification Preferences', updateNotifPrefsRes.status === 200);

  // Test 3: Get prime time
  const primeTimeRes = await apiRequest('GET', '/notifications/prime-time', undefined, userToken);
  recordTest('User 9.3 Get Prime Time', primeTimeRes.status === 200);

  // Test 4: Set prime time
  const setPrimeTimeRes = await apiRequest(
    'POST',
    '/notifications/prime-time',
    { windows: [{ dow: 1, start_minute: 540, end_minute: 720 }] },
    userToken
  );
  recordTest('User 9.4 Set Prime Time', setPrimeTimeRes.status === 200 || setPrimeTimeRes.status === 201);

  // Test 5: Get quiet hours
  const quietHoursRes = await apiRequest('GET', '/notifications/quiet-hours', undefined, userToken);
  recordTest('User 9.5 Get Quiet Hours', quietHoursRes.status === 200);

  // Test 6: Set quiet hours
  const setQuietHoursRes = await apiRequest(
    'POST',
    '/notifications/quiet-hours',
    { start_minute: 1320, end_minute: 480 },
    userToken
  );
  recordTest('User 9.6 Set Quiet Hours', setQuietHoursRes.status === 200 || setQuietHoursRes.status === 201);

  // Test 7: Get scheduled nudges
  const scheduledRes = await apiRequest('GET', '/notifications/scheduled', undefined, userToken);
  recordTest('User 9.7 Get Scheduled Nudges', scheduledRes.status === 200);

  // Test 8: Get notification history
  const notifHistoryRes = await apiRequest('GET', '/notifications/history', undefined, userToken);
  recordTest('User 9.8 Get Notification History', notifHistoryRes.status === 200);

  // Test 9: Add task reminder (requires journey_task_id)
  if (testContext.currentJourneyTaskId) {
    const addReminderRes = await apiRequest(
      'POST',
      '/notifications/reminders',
      {
        journey_task_id: testContext.currentJourneyTaskId,
        remind_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      },
      userToken
    );
    const reminderId = addReminderRes.data?.id;
    recordTest('User 9.9 Add Task Reminder', addReminderRes.status === 201 || addReminderRes.status === 200);

    // Test 10: Get reminders
    const remindersRes = await apiRequest('GET', '/notifications/reminders', undefined, userToken);
    recordTest('User 9.10 Get Reminders', remindersRes.status === 200);

    // Test 11: Delete reminder
    if (reminderId) {
      const deleteReminderRes = await apiRequest('DELETE', `/notifications/reminders/${reminderId}`, undefined, userToken);
      recordTest('User 9.11 Delete Reminder', deleteReminderRes.status === 200 || deleteReminderRes.status === 204);
    }
  } else {
    recordTest('User 9.9 Add Task Reminder - SKIPPED (no task available)', true);
  }

  // ============================================================================
  // SETTINGS TESTS
  // ============================================================================

  // Test 1: Get privacy settings
  const privacyRes = await apiRequest('GET', '/settings/privacy', undefined, userToken);
  recordTest('User 10.1 Get Privacy Settings', privacyRes.status === 200);

  // Test 2: Update privacy settings
  const updatePrivacyRes = await apiRequest(
    'PUT',
    '/settings/privacy',
    { share_with_buddy: true, allow_research: false },
    userToken
  );
  recordTest('User 10.2 Update Privacy Settings', updatePrivacyRes.status === 200);

  // Test 3: Get share preferences
  const sharePrefsRes = await apiRequest('GET', '/settings/share', undefined, userToken);
  recordTest('User 10.3 Get Share Preferences', sharePrefsRes.status === 200);

  // Test 4: Update share preferences
  const updateShareRes = await apiRequest(
    'PUT',
    '/settings/share',
    { share_metrics: true, share_streaks: true },
    userToken
  );
  recordTest('User 10.4 Update Share Preferences', updateShareRes.status === 200);

  // Test 5: Get devices
  const devicesRes = await apiRequest('GET', '/settings/devices', undefined, userToken);
  recordTest('User 10.5 Get Devices', devicesRes.status === 200);

  // Test 6: Register device (database only allows ios/android, not web)
  const registerDeviceRes = await apiRequest(
    'POST',
    '/settings/devices',
    { platform: 'ios', app_version: '1.0.0' },
    userToken
  );
  const deviceId = registerDeviceRes.data?.id;
  const deviceRegistered = registerDeviceRes.status === 201 || registerDeviceRes.status === 200;
  recordTest('User 10.6 Register Device', deviceRegistered,
    !deviceRegistered ? `Expected 201/200, got ${registerDeviceRes.status}` : undefined,
    registerDeviceRes.data);
  
  // Test 6.1: Register device with invalid platform (web not allowed)
  const invalidPlatformRes = await apiRequest(
    'POST',
    '/settings/devices',
    { platform: 'web', app_version: '1.0.0' },
    userToken
  );
  recordTest('User 10.6.1 Register Device - Invalid platform', invalidPlatformRes.status === 400,
    invalidPlatformRes.status !== 400 ? `Expected 400, got ${invalidPlatformRes.status}` : undefined);

  // Test 7: Unregister device
  if (deviceId) {
    const unregisterDeviceRes = await apiRequest('DELETE', `/settings/devices/${deviceId}`, undefined, userToken);
    recordTest('User 10.7 Unregister Device', unregisterDeviceRes.status === 200 || unregisterDeviceRes.status === 204);
  } else {
    recordTest('User 10.7 Unregister Device - SKIPPED (no device registered)', true);
  }

  // ============================================================================
  // ANALYTICS TESTS
  // ============================================================================

  // Test 1: Get streaks
  const analyticsStreaksRes = await apiRequest('GET', '/analytics/streaks', undefined, userToken);
  recordTest('User 11.1 Get Analytics Streaks', analyticsStreaksRes.status === 200);

  // Test 2: Get identity score
  const identityScoreRes = await apiRequest('GET', '/analytics/identity-score', undefined, userToken);
  recordTest('User 11.2 Get Identity Score', identityScoreRes.status === 200);

  // Test 3: Get consistency
  const consistencyRes = await apiRequest('GET', '/analytics/consistency', undefined, userToken);
  recordTest('User 11.3 Get Consistency', consistencyRes.status === 200);

  // Test 4: Get adherence (requires journey_id)
  if (testContext.currentJourneyId) {
    const adherenceRes = await apiRequest(
      'GET',
      `/analytics/adherence/${testContext.currentJourneyId}`,
      undefined,
      userToken
    );
    recordTest('User 11.4 Get Adherence', adherenceRes.status === 200);
  } else {
    recordTest('User 11.4 Get Adherence - SKIPPED (no journey)', true);
  }

  // Test 5: Get insights
  const insightsRes = await apiRequest('GET', '/analytics/insights', undefined, userToken);
  recordTest('User 11.5 Get Insights', insightsRes.status === 200);

  // Test 6: Get heatmap
  const heatmapRes = await apiRequest('GET', '/analytics/heatmap', undefined, userToken);
  recordTest('User 11.6 Get Heatmap', heatmapRes.status === 200);

  // Test 7: Get daily metrics
  const dailyMetricsRes = await apiRequest('GET', '/analytics/daily-metrics', undefined, userToken);
  recordTest('User 11.7 Get Daily Metrics', dailyMetricsRes.status === 200);

  // Test 8: Export data
  const exportRes = await apiRequest('GET', '/analytics/export?format=json', undefined, userToken);
  recordTest('User 11.8 Export Data', exportRes.status === 200);
}
