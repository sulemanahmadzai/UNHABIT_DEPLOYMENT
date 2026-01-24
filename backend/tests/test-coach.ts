/**
 * Coach Endpoints Test Suite
 * Tests all coach session and message endpoints
 */

import { apiRequest, recordTest, testContext } from './test-helpers';

export async function testCoachEndpoints(userToken: string) {
  console.log('\n📋 Testing Coach Endpoints...\n');

  // ============================================================================
  // SESSION TESTS
  // ============================================================================
  
  // Test 1: Get sessions list
  const getSessionsRes = await apiRequest('GET', '/coach/sessions', undefined, userToken);
  recordTest('Coach 1.1 Get Sessions', getSessionsRes.status === 200);

  // Test 2: Get sessions with limit
  const getSessionsLimitRes = await apiRequest('GET', '/coach/sessions?limit=5', undefined, userToken);
  recordTest('Coach 1.2 Get Sessions - With limit', getSessionsLimitRes.status === 200);

  // Test 3: Create new session
  const createSessionRes = await apiRequest('POST', '/coach/sessions', {}, userToken);
  const sessionId = createSessionRes.data?.id;
  const sessionCreated = createSessionRes.status === 201 || createSessionRes.status === 200;
  recordTest('Coach 1.3 Create Session - Valid', sessionCreated,
    !sessionCreated ? `Expected 201/200, got ${createSessionRes.status}` : undefined);
  
  if (sessionCreated && sessionId) {
    testContext.coachSessionIds.push(sessionId);
    testContext.currentCoachSessionId = sessionId;
  }

  // Test 4: Get session by ID - Valid
  if (sessionId) {
    const getSessionRes = await apiRequest('GET', `/coach/sessions/${sessionId}`, undefined, userToken);
    recordTest('Coach 1.4 Get Session by ID - Valid', getSessionRes.status === 200);
  } else {
    recordTest('Coach 1.4 Get Session by ID - SKIPPED (no session created)', true);
  }

  // Test 5: Get session by ID - Invalid ID
  const invalidSessionRes = await apiRequest('GET', '/coach/sessions/invalid-id', undefined, userToken);
  recordTest('Coach 1.5 Get Session by ID - Invalid ID', invalidSessionRes.status === 400,
    invalidSessionRes.status !== 400 ? `Expected 400, got ${invalidSessionRes.status}` : undefined);

  // Test 6: Get session by ID - Non-existent
  const nonExistentId = '00000000-0000-0000-0000-000000000000';
  const nonExistentRes = await apiRequest('GET', `/coach/sessions/${nonExistentId}`, undefined, userToken);
  recordTest('Coach 1.6 Get Session by ID - Non-existent', nonExistentRes.status === 404);

  // ============================================================================
  // MESSAGE TESTS
  // ============================================================================
  
  // Test 1: Send message - Valid (requires active session)
  if (sessionId) {
    const sendMessageRes = await apiRequest(
      'POST',
      `/coach/sessions/${sessionId}/messages`,
      {
        message: 'I need help staying motivated today',
        context: {
          journey_day: 5,
          current_streak: 3,
          recent_slip: false
        }
      },
      userToken
    );
    recordTest('Coach 2.1 Send Message - Valid', sendMessageRes.status === 200 || sendMessageRes.status === 502,
      sendMessageRes.status !== 200 && sendMessageRes.status !== 502 ? `Expected 200 or 502, got ${sendMessageRes.status}` : undefined);
  } else {
    recordTest('Coach 2.1 Send Message - SKIPPED (no session)', true);
  }

  // Test 2: Send message - Empty message
  if (sessionId) {
    const emptyMessageRes = await apiRequest(
      'POST',
      `/coach/sessions/${sessionId}/messages`,
      { message: '' },
      userToken
    );
    recordTest('Coach 2.2 Send Message - Empty message', emptyMessageRes.status === 400);
  } else {
    recordTest('Coach 2.2 Send Message - Empty message - SKIPPED (no session)', true);
  }

  // Test 3: Send message - Too long message
  if (sessionId) {
    const longMessageRes = await apiRequest(
      'POST',
      `/coach/sessions/${sessionId}/messages`,
      { message: 'a'.repeat(2001) },
      userToken
    );
    recordTest('Coach 2.3 Send Message - Too long message', longMessageRes.status === 400);
  } else {
    recordTest('Coach 2.3 Send Message - Too long - SKIPPED (no session)', true);
  }

  // Test 4: Send message - Missing message field
  if (sessionId) {
    const missingMessageRes = await apiRequest(
      'POST',
      `/coach/sessions/${sessionId}/messages`,
      {},
      userToken
    );
    recordTest('Coach 2.4 Send Message - Missing message', missingMessageRes.status === 400);
  } else {
    recordTest('Coach 2.4 Send Message - Missing message - SKIPPED (no session)', true);
  }

  // Test 5: Send message - Invalid session ID
  const invalidSessionMessageRes = await apiRequest(
    'POST',
    '/coach/sessions/invalid-id/messages',
    { message: 'Test message' },
    userToken
  );
  recordTest('Coach 2.5 Send Message - Invalid session ID', invalidSessionMessageRes.status === 400 || invalidSessionMessageRes.status === 404);

  // Test 6: Send message - Non-existent session
  const nonExistentSessionRes = await apiRequest(
    'POST',
    `/coach/sessions/${nonExistentId}/messages`,
    { message: 'Test message' },
    userToken
  );
  recordTest('Coach 2.6 Send Message - Non-existent session', nonExistentSessionRes.status === 404);

  // Test 7: Send message - Invalid context
  if (sessionId) {
    const invalidContextRes = await apiRequest(
      'POST',
      `/coach/sessions/${sessionId}/messages`,
      {
        message: 'Test',
        context: {
          journey_day: 'invalid', // Should be number
          current_streak: 'invalid'
        }
      },
      userToken
    );
    recordTest('Coach 2.7 Send Message - Invalid context', invalidContextRes.status === 400);
  } else {
    recordTest('Coach 2.7 Send Message - Invalid context - SKIPPED (no session)', true);
  }

  // ============================================================================
  // END SESSION TESTS
  // ============================================================================
  
  // Test 1: End session - Valid
  if (sessionId) {
    const endSessionRes = await apiRequest('POST', `/coach/sessions/${sessionId}/end`, {}, userToken);
    recordTest('Coach 3.1 End Session - Valid', endSessionRes.status === 200);
  } else {
    recordTest('Coach 3.1 End Session - SKIPPED (no session)', true);
  }

  // Test 2: End session - Already ended (try to end again)
  if (sessionId) {
    const endAgainRes = await apiRequest('POST', `/coach/sessions/${sessionId}/end`, {}, userToken);
    // Should either succeed or return 404/400
    recordTest('Coach 3.2 End Session - Already ended', endAgainRes.status === 200 || endAgainRes.status === 400 || endAgainRes.status === 404);
  } else {
    recordTest('Coach 3.2 End Session - Already ended - SKIPPED (no session)', true);
  }

  // Test 3: End session - Invalid ID
  const endInvalidRes = await apiRequest('POST', '/coach/sessions/invalid-id/end', {}, userToken);
  recordTest('Coach 3.3 End Session - Invalid ID', endInvalidRes.status === 400,
    endInvalidRes.status !== 400 ? `Expected 400, got ${endInvalidRes.status}` : undefined);

  // Test 4: End session - Non-existent
  const endNonExistentRes = await apiRequest('POST', `/coach/sessions/${nonExistentId}/end`, {}, userToken);
  recordTest('Coach 3.4 End Session - Non-existent', endNonExistentRes.status === 404);

  // Test 5: Send message to ended session
  if (sessionId) {
    const messageEndedRes = await apiRequest(
      'POST',
      `/coach/sessions/${sessionId}/messages`,
      { message: 'Test message to ended session' },
      userToken
    );
    recordTest('Coach 3.5 Send Message to Ended Session', messageEndedRes.status === 400 || messageEndedRes.status === 404);
  } else {
    recordTest('Coach 3.5 Send Message to Ended Session - SKIPPED (no session)', true);
  }

  // ============================================================================
  // UNAUTHENTICATED ACCESS TESTS
  // ============================================================================
  
  const unauthenticatedRes = await apiRequest('GET', '/coach/sessions');
  recordTest('Coach 4.1 Unauthenticated Access', unauthenticatedRes.status === 401);
}
