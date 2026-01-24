/**
 * Test Helper Functions
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
export const prisma = new PrismaClient();

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
  dbVerified?: boolean;
  expectedStatus?: number;
  actualStatus?: number;
}

export const testResults: TestResult[] = [];

export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  token?: string,
  expectedStatus?: number
): Promise<{ status: number; data: any }> {
  try {
    const config: any = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Don't throw on any status
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && method !== 'GET') {
      config.data = data;
    }

    const response = await axios(config);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    throw error;
  }
}

export function recordTest(
  name: string,
  passed: boolean,
  error?: string,
  response?: any,
  dbVerified?: boolean,
  expectedStatus?: number,
  actualStatus?: number
) {
  testResults.push({
    name,
    passed,
    error,
    response,
    dbVerified,
    expectedStatus,
    actualStatus,
  });

  const status = passed ? '✅' : '❌';
  const statusInfo = expectedStatus && actualStatus ? ` (Expected: ${expectedStatus}, Got: ${actualStatus})` : '';
  console.log(`${status} ${name}${statusInfo}`);
  
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (!passed && response) {
    console.log(`   Response: ${JSON.stringify(response, null, 2).substring(0, 500)}`);
  }
}

export async function verifyDb(
  query: () => Promise<any>,
  expected: any,
  description: string
): Promise<boolean> {
  try {
    const result = await query();
    const matches = JSON.stringify(result) === JSON.stringify(expected);
    if (!matches) {
      console.log(`   DB Verification Failed: ${description}`);
      console.log(`   Expected: ${JSON.stringify(expected)}`);
      console.log(`   Got: ${JSON.stringify(result)}`);
    }
    return matches;
  } catch (error: any) {
    console.log(`   DB Verification Error: ${description} - ${error.message}`);
    return false;
  }
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateInvalidUUID(): string {
  return 'invalid-uuid-string';
}

export function generateNonExistentUUID(): string {
  return '00000000-0000-0000-0000-000000000000';
}

export function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / testResults.length) * 100).toFixed(2)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults
      .filter((t) => !t.passed)
      .forEach((t) => {
        console.log(`   - ${t.name}`);
        if (t.error) console.log(`     Error: ${t.error}`);
        if (t.expectedStatus && t.actualStatus) {
          console.log(`     Expected Status: ${t.expectedStatus}, Got: ${t.actualStatus}`);
        }
      });
  }

  return failed === 0;
}

/**
 * Test Context - Stores created IDs and data for dependent tests
 */
export class TestContext {
  // Habits
  habitIds: string[] = [];
  currentHabitId?: string;

  // Journeys
  journeyIds: string[] = [];
  currentJourneyId?: string;
  journeyDayIds: string[] = [];
  currentJourneyDayId?: string;
  journeyTaskIds: string[] = [];
  currentJourneyTaskId?: string;

  // Categories
  categoryIds: string[] = [];
  currentCategoryId?: string;

  // Templates
  templateIds: string[] = [];
  currentTemplateId?: string;

  // Badges
  badgeIds: string[] = [];
  currentBadgeId?: string;
  badgeRuleIds: string[] = [];
  currentBadgeRuleId?: string;

  // Point Rules
  pointRuleIds: string[] = [];
  currentPointRuleId?: string;

  // Buddies
  inviteIds: string[] = [];
  currentInviteId?: string;
  inviteCodes: string[] = [];
  currentInviteCode?: string;
  buddyLinkIds: string[] = [];
  currentBuddyLinkId?: string;
  checkinIds: string[] = [];
  currentCheckinId?: string;
  messageIds: string[] = [];
  currentMessageId?: string;

  // Focus
  focusSessionIds: string[] = [];
  currentFocusSessionId?: string;

  // Coach
  coachSessionIds: string[] = [];
  currentCoachSessionId?: string;

  clear() {
    this.habitIds = [];
    this.journeyIds = [];
    this.journeyDayIds = [];
    this.journeyTaskIds = [];
    this.categoryIds = [];
    this.templateIds = [];
    this.badgeIds = [];
    this.badgeRuleIds = [];
    this.pointRuleIds = [];
    this.inviteIds = [];
    this.inviteCodes = [];
    this.buddyLinkIds = [];
    this.checkinIds = [];
    this.messageIds = [];
    this.focusSessionIds = [];
  }
}

export const testContext = new TestContext();

/**
 * Verify operation by checking database
 */
export async function verifyOperation(
  operation: string,
  getQuery: () => Promise<any>,
  expectedCondition: (data: any) => boolean,
  description: string
): Promise<boolean> {
  try {
    const data = await getQuery();
    const matches = expectedCondition(data);
    if (!matches) {
      console.log(`   ⚠️  Verification Failed: ${description}`);
      console.log(`   Operation: ${operation}`);
      console.log(`   Data: ${JSON.stringify(data, null, 2).substring(0, 300)}`);
    }
    return matches;
  } catch (error: any) {
    console.log(`   ⚠️  Verification Error: ${description} - ${error.message}`);
    return false;
  }
}

/**
 * Verify operation by making GET request
 */
export async function verifyByGet(
  operation: string,
  endpoint: string,
  token: string,
  expectedCondition: (data: any) => boolean,
  description: string
): Promise<boolean> {
  try {
    const res = await apiRequest('GET', endpoint, undefined, token);
    if (res.status !== 200) {
      console.log(`   ⚠️  Verification Failed: ${description} - GET returned ${res.status}`);
      return false;
    }
    const matches = expectedCondition(res.data);
    if (!matches) {
      console.log(`   ⚠️  Verification Failed: ${description}`);
      console.log(`   Operation: ${operation}`);
      console.log(`   Data: ${JSON.stringify(res.data, null, 2).substring(0, 300)}`);
    }
    return matches;
  } catch (error: any) {
    console.log(`   ⚠️  Verification Error: ${description} - ${error.message}`);
    return false;
  }
}
