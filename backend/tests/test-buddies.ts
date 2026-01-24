/**
 * Buddies Endpoints Test Suite
 * Tests buddy system with two users
 */

import { apiRequest, recordTest, verifyDb, prisma, generateInvalidUUID, generateNonExistentUUID, testContext, verifyOperation, verifyByGet } from './test-helpers';

export async function testBuddiesEndpoints(user1Token: string, user1Id: string, user2Token: string, user2Id: string) {
  console.log('\n📋 Testing Buddies Endpoints (Two Users Required)...\n');

  // ============================================================================
  // BUDDY INVITE TESTS
  // ============================================================================

  // Test 1: Create invite (User 1) (REQUIRED for subsequent tests)
  const createInviteRes = await apiRequest(
    'POST',
    '/buddies/invite',
    { expires_in_days: 7 },
    user1Token
  );
  const inviteCode = createInviteRes.data?.invite_code;
  const inviteId = createInviteRes.data?.id;
  const inviteCreated = createInviteRes.status === 201 || createInviteRes.status === 200;
  recordTest('Buddies 1.1 Create Invite - Valid', inviteCreated);
  
  if (inviteCreated && inviteId && inviteCode) {
    testContext.inviteIds.push(inviteId);
    testContext.currentInviteId = inviteId;
    testContext.inviteCodes.push(inviteCode);
    testContext.currentInviteCode = inviteCode;
    
    // Verify creation in database
    const dbVerified = await verifyOperation(
      'Create Invite',
      () => prisma.buddy_links.findUnique({ where: { id: inviteId } }),
      (data) => data !== null,
      'Invite exists in database'
    );
    recordTest('Buddies 1.1.1 Create Invite - DB Verified', dbVerified, undefined, undefined, dbVerified);
  }

  // Test 2: Create invite with invalid expiration
  const invalidExpiryRes = await apiRequest(
    'POST',
    '/buddies/invite',
    { expires_in_days: 100 }, // > 30 days
    user1Token
  );
  recordTest('Buddies 1.2 Create Invite - Invalid expiration', invalidExpiryRes.status >= 400);

  // Test 3: Create invite with negative expiration
  const negativeExpiryRes = await apiRequest(
    'POST',
    '/buddies/invite',
    { expires_in_days: -1 },
    user1Token
  );
  recordTest('Buddies 1.3 Create Invite - Negative expiration', negativeExpiryRes.status >= 400);

  // Test 4: Get sent invites (User 1)
  const getInvitesRes = await apiRequest('GET', '/buddies/invites', undefined, user1Token);
  recordTest('Buddies 1.4 Get Sent Invites', getInvitesRes.status === 200);

  // Test 5: Get invite URL
  if (inviteCode) {
    const getUrlRes = await apiRequest('GET', `/buddies/invite/${inviteCode}/url`, undefined, user1Token);
    // Response structure: { success: true, data: { invite_url: "..." } }
    const urlValid = getUrlRes.status === 200 && 
                     getUrlRes.data.success === true && 
                     getUrlRes.data.data && 
                     !!getUrlRes.data.data.invite_url;
    recordTest('Buddies 1.5 Get Invite URL', urlValid,
      !urlValid ? `Expected status 200 with invite_url, got status ${getUrlRes.status}` : undefined,
      getUrlRes.data);
  }

  // Test 6: Get invite URL with invalid code
  const invalidUrlRes = await apiRequest('GET', '/buddies/invite/invalid-code-12345/url', undefined, user1Token);
  // Backend should return 404 for non-existent invite code
  recordTest('Buddies 1.6 Get Invite URL - Invalid code', invalidUrlRes.status === 404,
    invalidUrlRes.status !== 404 ? `Expected 404, got ${invalidUrlRes.status}` : undefined,
    invalidUrlRes.data);

  // Test 7: Resend invite
  if (inviteId) {
    const resendRes = await apiRequest('POST', `/buddies/invites/${inviteId}/resend`, undefined, user1Token);
    recordTest('Buddies 1.7 Resend Invite', resendRes.status === 200);
  }

  // Test 8: Resend invite with invalid ID
  const invalidResendRes = await apiRequest(
    'POST',
    `/buddies/invites/${generateInvalidUUID()}/resend`,
    undefined,
    user1Token
  );
  recordTest('Buddies 1.8 Resend Invite - Invalid ID', invalidResendRes.status >= 400);

  // ============================================================================
  // ACCEPT INVITE TESTS
  // ============================================================================

  // Test 1: Accept invite (User 2 accepts User 1's invite) (DEPENDS ON: invite creation)
  if (inviteCode) {
    const acceptRes = await apiRequest('POST', `/buddies/accept/${inviteCode}`, undefined, user2Token);
    const buddyLinkId = acceptRes.data?.id;
    const acceptValid = acceptRes.status === 201 || acceptRes.status === 200;
    recordTest('Buddies 2.1 Accept Invite - Valid', acceptValid);
    
    if (acceptValid && buddyLinkId) {
      testContext.buddyLinkIds.push(buddyLinkId);
      testContext.currentBuddyLinkId = buddyLinkId;
      
      // Verify buddy link created in database
      const dbVerified = await verifyOperation(
        'Accept Invite',
        () => prisma.buddy_links.findUnique({ where: { id: buddyLinkId } }),
        (data) => data !== null && (data.user1_id === user1Id || data.user2_id === user1Id),
        'Buddy link exists in database'
      );
      recordTest('Buddies 2.1.1 Accept Invite - DB Verified', dbVerified, undefined, undefined, dbVerified);
    }

    // Test 2: Accept already accepted invite
    const duplicateAcceptRes = await apiRequest('POST', `/buddies/accept/${inviteCode}`, undefined, user2Token);
    recordTest('Buddies 2.2 Accept Invite - Already accepted', duplicateAcceptRes.status >= 400);

    // Test 3: Accept own invite (should fail)
    const ownInviteRes = await apiRequest('POST', `/buddies/accept/${inviteCode}`, undefined, user1Token);
    recordTest('Buddies 2.3 Accept Invite - Own invite', ownInviteRes.status >= 400);

    // Test 4: Accept invalid invite code
    const invalidAcceptRes = await apiRequest('POST', '/buddies/accept/invalid-code', undefined, user2Token);
    recordTest('Buddies 2.4 Accept Invite - Invalid code', invalidAcceptRes.status === 404);

    // ============================================================================
    // BUDDY LIST TESTS
    // ============================================================================

    // Test 1: Get all buddies (User 1)
    const getBuddies1Res = await apiRequest('GET', '/buddies', undefined, user1Token);
    recordTest('Buddies 3.1 Get Buddies - User 1', getBuddies1Res.status === 200);

    // Test 2: Get all buddies (User 2)
    const getBuddies2Res = await apiRequest('GET', '/buddies', undefined, user2Token);
    recordTest('Buddies 3.2 Get Buddies - User 2', getBuddies2Res.status === 200);

    // Test 3: Get quick view (User 1)
    const quickViewRes = await apiRequest('GET', '/buddies/quick-view', undefined, user1Token);
    recordTest('Buddies 3.3 Get Quick View', quickViewRes.status === 200);

    // Test 4: Get completed today
    const completedTodayRes = await apiRequest('GET', '/buddies/completed-today', undefined, user1Token);
    recordTest('Buddies 3.4 Get Completed Today', completedTodayRes.status === 200);

    // ============================================================================
    // BUDDY PROFILE TESTS
    // ============================================================================

    if (buddyLinkId) {
      // Test 1: Get buddy profile
      const profileRes = await apiRequest('GET', `/buddies/${buddyLinkId}/profile`, undefined, user1Token);
      recordTest('Buddies 4.1 Get Buddy Profile', profileRes.status === 200);

      // Test 2: Get buddy profile with invalid ID
      const invalidProfileRes = await apiRequest(
        'GET',
        `/buddies/${generateInvalidUUID()}/profile`,
        undefined,
        user1Token
      );
      recordTest('Buddies 4.2 Get Buddy Profile - Invalid ID', invalidProfileRes.status >= 400);

      // Test 3: Get buddy profile with non-existent ID
      const nonExistentProfileRes = await apiRequest(
        'GET',
        `/buddies/${generateNonExistentUUID()}/profile`,
        undefined,
        user1Token
      );
      recordTest('Buddies 4.3 Get Buddy Profile - Non-existent ID', nonExistentProfileRes.status === 404);

      // ============================================================================
      // BUDDY CHECK-IN TESTS
      // ============================================================================

      // Test 1: Submit check-in (User 1) (DEPENDS ON: buddy link)
      const checkinRes = await apiRequest(
        'POST',
        '/buddies/checkin',
        { buddy_link_id: buddyLinkId, note: 'Day 1 complete!' },
        user1Token
      );
      const checkinId = checkinRes.data?.id;
      const checkinValid = checkinRes.status === 201 || checkinRes.status === 200;
      recordTest('Buddies 5.1 Submit Check-in - Valid', checkinValid);
      
      if (checkinValid && checkinId) {
        testContext.checkinIds.push(checkinId);
        testContext.currentCheckinId = checkinId;
        
        // Verify check-in in database
        const dbVerified = await verifyOperation(
          'Submit Check-in',
          () => prisma.buddy_checkins.findUnique({ where: { id: checkinId } }),
          (data) => data !== null && data.note === 'Day 1 complete!',
          'Check-in exists in database with correct note'
        );
        recordTest('Buddies 5.1.1 Submit Check-in - DB Verified', dbVerified, undefined, undefined, dbVerified);
      }

      // Test 2: Submit check-in with empty note
      const emptyNoteRes = await apiRequest(
        'POST',
        '/buddies/checkin',
        { buddy_link_id: buddyLinkId, note: '' },
        user1Token
      );
      recordTest('Buddies 5.2 Submit Check-in - Empty note', emptyNoteRes.status === 200 || emptyNoteRes.status >= 400);

      // Test 3: Submit check-in with too long note (>500 chars)
      const longNoteRes = await apiRequest(
        'POST',
        '/buddies/checkin',
        { buddy_link_id: buddyLinkId, note: 'a'.repeat(501) },
        user1Token
      );
      recordTest('Buddies 5.3 Submit Check-in - Too long note', longNoteRes.status >= 400);

      // Test 4: Submit check-in with invalid buddy_link_id
      const invalidCheckinRes = await apiRequest(
        'POST',
        '/buddies/checkin',
        { buddy_link_id: generateInvalidUUID(), note: 'Test' },
        user1Token
      );
      recordTest('Buddies 5.4 Submit Check-in - Invalid buddy ID', invalidCheckinRes.status >= 400);

      // Test 5: Get check-ins
      const getCheckinsRes = await apiRequest('GET', '/buddies/checkins', undefined, user1Token);
      recordTest('Buddies 5.5 Get Check-ins', getCheckinsRes.status === 200);

      // Test 6: Get check-ins with filter
      const filteredCheckinsRes = await apiRequest(
        'GET',
        `/buddies/checkins?buddy_link_id=${buddyLinkId}`,
        undefined,
        user1Token
      );
      recordTest('Buddies 5.6 Get Check-ins - Filtered', filteredCheckinsRes.status === 200);

      // ============================================================================
      // BUDDY MESSAGES TESTS
      // ============================================================================

      // Test 1: Send message (User 1 to User 2) (DEPENDS ON: buddy link)
      const sendMessageRes = await apiRequest(
        'POST',
        '/buddies/messages',
        { buddy_link_id: buddyLinkId, content: 'Great job!' },
        user1Token
      );
      const messageId = sendMessageRes.data?.id;
      const messageValid = sendMessageRes.status === 201 || sendMessageRes.status === 200;
      recordTest('Buddies 6.1 Send Message - Valid', messageValid);
      
      if (messageValid && messageId) {
        testContext.messageIds.push(messageId);
        testContext.currentMessageId = messageId;
        
        // Verify message in database
        const dbVerified = await verifyOperation(
          'Send Message',
          () => prisma.buddy_messages.findUnique({ where: { id: messageId } }),
          (data) => data !== null && data.content === 'Great job!',
          'Message exists in database with correct content'
        );
        recordTest('Buddies 6.1.1 Send Message - DB Verified', dbVerified, undefined, undefined, dbVerified);
      }

      // Test 2: Send message with empty content
      const emptyContentRes = await apiRequest(
        'POST',
        '/buddies/messages',
        { buddy_link_id: buddyLinkId, content: '' },
        user1Token
      );
      recordTest('Buddies 6.2 Send Message - Empty content', emptyContentRes.status >= 400);

      // Test 3: Send message with too long content (>1000 chars)
      const longContentRes = await apiRequest(
        'POST',
        '/buddies/messages',
        { buddy_link_id: buddyLinkId, content: 'a'.repeat(1001) },
        user1Token
      );
      recordTest('Buddies 6.3 Send Message - Too long content', longContentRes.status >= 400);

      // Test 4: Get messages
      const getMessagesRes = await apiRequest(
        'GET',
        `/buddies/messages?buddy_link_id=${buddyLinkId}`,
        undefined,
        user1Token
      );
      recordTest('Buddies 6.4 Get Messages', getMessagesRes.status === 200);

      // Test 5: Get messages with pagination
      const paginatedMessagesRes = await apiRequest(
        'GET',
        `/buddies/messages?buddy_link_id=${buddyLinkId}&limit=10&offset=0`,
        undefined,
        user1Token
      );
      recordTest('Buddies 6.5 Get Messages - Paginated', paginatedMessagesRes.status === 200);

      // ============================================================================
      // BUDDY NUDGES TESTS
      // ============================================================================

      // Test 1: Send nudge (User 1 to User 2)
      const sendNudgeRes = await apiRequest(
        'POST',
        `/buddies/${buddyLinkId}/nudge`,
        { message: 'You got this! 💪' },
        user1Token
      );
      recordTest('Buddies 7.1 Send Nudge - Valid', sendNudgeRes.status === 201 || sendNudgeRes.status === 200);

      // Test 2: Send nudge with empty message
      const emptyNudgeRes = await apiRequest(
        'POST',
        `/buddies/${buddyLinkId}/nudge`,
        { message: '' },
        user1Token
      );
      recordTest('Buddies 7.2 Send Nudge - Empty message', emptyNudgeRes.status >= 400);

      // Test 3: Send nudge with too long message (>200 chars)
      const longNudgeRes = await apiRequest(
        'POST',
        `/buddies/${buddyLinkId}/nudge`,
        { message: 'a'.repeat(201) },
        user1Token
      );
      recordTest('Buddies 7.3 Send Nudge - Too long message', longNudgeRes.status >= 400);

      // Test 4: Get nudges (User 2)
      const getNudgesRes = await apiRequest('GET', '/buddies/nudges', undefined, user2Token);
      recordTest('Buddies 7.4 Get Nudges', getNudgesRes.status === 200);

      // ============================================================================
      // BUDDY SUMMARY TESTS
      // ============================================================================

      // Test 1: Get weekly summary
      const summaryRes = await apiRequest('GET', '/buddies/summary', undefined, user1Token);
      recordTest('Buddies 8.1 Get Weekly Summary', summaryRes.status === 200);

      // ============================================================================
      // REMOVE BUDDY TESTS
      // ============================================================================

      // Test 1: Remove buddy (DEPENDS ON: buddy link)
      const removeRes = await apiRequest('DELETE', `/buddies/${buddyLinkId}`, undefined, user1Token);
      const removeValid = removeRes.status === 200 || removeRes.status === 204;
      recordTest('Buddies 9.1 Remove Buddy', removeValid);
      
      // Verify deletion
      if (removeValid) {
        const verifyDelete = await apiRequest('GET', `/buddies/${buddyLinkId}/profile`, undefined, user1Token);
        const deleted = verifyDelete.status === 404;
        recordTest('Buddies 9.1.1 Remove Buddy - Verified by GET (404)', deleted);
        
        // Verify in database
        const dbVerified = await verifyOperation(
          'Remove Buddy',
          () => prisma.buddy_links.findUnique({ where: { id: buddyLinkId } }),
          (data) => data === null,
          'Buddy link deleted from database'
        );
        recordTest('Buddies 9.1.2 Remove Buddy - DB Verified', dbVerified, undefined, undefined, dbVerified);
      }

      // Test 2: Remove already removed buddy
      const removeAgainRes = await apiRequest('DELETE', `/buddies/${buddyLinkId}`, undefined, user1Token);
      recordTest('Buddies 9.2 Remove Buddy - Already removed', removeAgainRes.status === 404);

      // Test 3: Remove buddy with invalid ID
      const invalidRemoveRes = await apiRequest(
        'DELETE',
        `/buddies/${generateInvalidUUID()}`,
        undefined,
        user1Token
      );
      recordTest('Buddies 9.3 Remove Buddy - Invalid ID', invalidRemoveRes.status >= 400);
    }
  }

  // ============================================================================
  // CANCEL INVITE TESTS
  // ============================================================================

  // Create another invite to test cancellation
  const cancelInviteRes = await apiRequest(
    'POST',
    '/buddies/invite',
    { expires_in_days: 7 },
    user1Token
  );
  const cancelInviteId = cancelInviteRes.data?.id;

  if (cancelInviteId) {
    // Test 1: Cancel invite
    const cancelRes = await apiRequest('DELETE', `/buddies/invites/${cancelInviteId}`, undefined, user1Token);
    recordTest('Buddies 10.1 Cancel Invite', cancelRes.status === 200 || cancelRes.status === 204);

    // Test 2: Cancel already cancelled invite
    const cancelAgainRes = await apiRequest('DELETE', `/buddies/invites/${cancelInviteId}`, undefined, user1Token);
    recordTest('Buddies 10.2 Cancel Invite - Already cancelled', cancelAgainRes.status === 404);

    // Test 3: Cancel invite with invalid ID
    const invalidCancelRes = await apiRequest(
      'DELETE',
      `/buddies/invites/${generateInvalidUUID()}`,
      undefined,
      user1Token
    );
    recordTest('Buddies 10.3 Cancel Invite - Invalid ID', invalidCancelRes.status >= 400);
  }
}
