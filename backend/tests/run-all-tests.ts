/**
 * Main Test Runner
 * Sets up test users and runs all test suites
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { apiRequest, printSummary, testResults, recordTest, testContext, prisma, verifyOperation, verifyByGet } from './test-helpers';
import { testAdminEndpoints } from './test-admin';
import { testBuddiesEndpoints } from './test-buddies';
import { testUserEndpoints } from './test-user-endpoints';
import { testAIEndpoints } from './test-ai';
import { testCoachEndpoints } from './test-coach';
import { testAIDiagnosticsEndpoints } from './test-ai-diagnostics';
import { testNewEndpoints } from './test-new-endpoints';

dotenv.config();

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  userId?: string;
  token?: string;
  refreshToken?: string;
  role?: 'user' | 'admin';
}

const testUsers: TestUser[] = [
  {
    email: 'testuser1@unhabit.test',
    password: 'TestUser123!@#',
    fullName: 'Test User 1',
    role: 'user',
  },
  {
    email: 'testuser2@unhabit.test',
    password: 'TestUser123!@#',
    fullName: 'Test User 2',
    role: 'user',
  },
  {
    email: 'admin@unhabit.test',
    password: 'Admin123!@#',
    fullName: 'Admin User',
    role: 'admin',
  },
];

async function setupTestUsers(): Promise<void> {
  console.log('\n🔧 Setting up test users...\n');

  // Step 1: Delete existing test users if they exist
  console.log('   Cleaning up existing test users...');
  for (const user of testUsers) {
    try {
      // Find user by email in database
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id 
        FROM auth.users
        WHERE email = ${user.email}
        LIMIT 1
      `;
      
      if (result && result.length > 0) {
        const userId = result[0].id;
        console.log(`   Deleting existing user: ${user.email}`);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log(`   ✅ Deleted ${user.email}`);
      }
    } catch (error: any) {
      // User doesn't exist or error deleting - continue
      console.log(`   ℹ️  ${user.email} not found or already deleted`);
    }
  }

  // Step 2: Create users using proper methods
  for (const user of testUsers) {
    try {
      if (user.role === 'admin') {
        // Admin: Create directly via Supabase admin (bypasses register endpoint)
        console.log(`   Creating admin user directly: ${user.email}`);
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.fullName,
          },
        });

        if (error) throw error;
        if (!data.user) throw new Error('Admin user creation failed');
        
        user.userId = data.user.id;

        // Set admin role in profiles table
        await prisma.profiles.upsert({
          where: { user_id: user.userId },
          update: { role: 'admin' },
          create: {
            user_id: user.userId,
            full_name: user.fullName,
            role: 'admin',
          },
        });

        console.log(`   ✅ Admin created: ${user.email}`);
      } else {
        // Regular users: Use register endpoint
        console.log(`   Registering user via /auth/register: ${user.email}`);
        const registerRes = await apiRequest('POST', '/auth/register', {
          email: user.email,
          password: user.password,
          full_name: user.fullName,
        });

        if (registerRes.status !== 201 && registerRes.status !== 200) {
          throw new Error(`Registration failed: ${JSON.stringify(registerRes.data)}`);
        }

        if (!registerRes.data.user || !registerRes.data.user.id) {
          throw new Error('Registration succeeded but no user ID returned');
        }

        user.userId = registerRes.data.user.id;
        console.log(`   ✅ User registered: ${user.email}`);
      }

      // Step 3: Login all users to get tokens
      console.log(`   Logging in: ${user.email}`);
      const loginRes = await apiRequest('POST', '/auth/login', {
        email: user.email,
        password: user.password,
      });

      if (loginRes.status !== 200 || !loginRes.data.access_token) {
        throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
      }

      user.token = loginRes.data.access_token;
      user.refreshToken = loginRes.data.refresh_token;

      // Verify user ID matches
      const meRes = await apiRequest('GET', '/auth/me', undefined, user.token);
      if (meRes.status === 200 && meRes.data.id) {
        if (meRes.data.id !== user.userId) {
          console.log(`   ⚠️  User ID mismatch, updating...`);
          user.userId = meRes.data.id;
        }
      }

      // Verify role is set correctly
      if (user.role === 'admin') {
        const profile = await prisma.profiles.findUnique({ where: { user_id: user.userId } });
        if (profile?.role !== 'admin') {
          console.log(`   ⚠️  Admin role not set, updating...`);
          await prisma.profiles.update({
            where: { user_id: user.userId },
            data: { role: 'admin' },
          });
        }
      }

      console.log(`   ✅ Setup complete for ${user.email} (${user.role || 'user'})`);
    } catch (error: any) {
      console.error(`   ❌ Failed to setup user ${user.email}: ${error.message}`);
      throw error;
    }
  }

  console.log('\n✅ Test users setup complete\n');
}

async function testAuthentication() {
  console.log('\n📋 Testing Authentication Endpoints...\n');

  // Test 1.1: Register with valid data (use unique email with timestamp)
  const uniqueEmail = `newuser${Date.now()}@test.com`;
  const registerRes = await apiRequest('POST', '/auth/register', {
    email: uniqueEmail,
    password: 'ValidPass123!',
    full_name: 'New User',
  });
  recordTest(
    '1.1 Register - Valid data',
    registerRes.status === 201 || registerRes.status === 200,
    registerRes.status >= 400 ? JSON.stringify(registerRes.data) : undefined,
    registerRes.data
  );

  // Test 1.2: Register with invalid email
  const invalidEmailRes = await apiRequest('POST', '/auth/register', {
    email: 'not-an-email',
    password: 'ValidPass123!',
  });
  // Zod validation error returns 400 (from error handler)
  recordTest('1.2 Register - Invalid email', invalidEmailRes.status === 400, 
    invalidEmailRes.status !== 400 ? `Expected 400, got ${invalidEmailRes.status}` : undefined,
    invalidEmailRes.data);

  // Test 1.3: Register with short password
  const shortPassRes = await apiRequest('POST', '/auth/register', {
    email: `short${Date.now()}@test.com`,
    password: 'short',
  });
  // Zod validation error returns 400 (from error handler)
  recordTest('1.3 Register - Short password', shortPassRes.status === 400,
    shortPassRes.status !== 400 ? `Expected 400, got ${shortPassRes.status}` : undefined,
    shortPassRes.data);

  // Test 1.4: Register with empty email
  const emptyEmailRes = await apiRequest('POST', '/auth/register', {
    email: '',
    password: 'ValidPass123!',
  });
  recordTest('1.4 Register - Empty email', emptyEmailRes.status >= 400);

  // Test 1.5: Register with empty password
  const emptyPassRes = await apiRequest('POST', '/auth/register', {
    email: 'empty@test.com',
    password: '',
  });
  recordTest('1.5 Register - Empty password', emptyPassRes.status >= 400);

  // Test 1.6: Login with valid credentials
  const loginRes = await apiRequest('POST', '/auth/login', {
    email: testUsers[0].email,
    password: testUsers[0].password,
  });
  recordTest(
    '1.6 Login - Valid credentials',
    loginRes.status === 200 && !!loginRes.data.access_token,
    loginRes.status >= 400 ? JSON.stringify(loginRes.data) : undefined
  );

  // Test 1.7: Login with wrong password
  const wrongPassRes = await apiRequest('POST', '/auth/login', {
    email: testUsers[0].email,
    password: 'WrongPassword123!',
  });
  // Supabase returns 400 for invalid credentials, backend might return 401
  recordTest('1.7 Login - Wrong password', wrongPassRes.status === 401 || wrongPassRes.status === 400,
    wrongPassRes.status !== 401 && wrongPassRes.status !== 400 ? `Expected 401 or 400, got ${wrongPassRes.status}` : undefined,
    wrongPassRes.data);

  // Test 1.8: Login with non-existent email
  const noUserRes = await apiRequest('POST', '/auth/login', {
    email: `nonexistent${Date.now()}@test.com`,
    password: 'Password123!',
  });
  // Supabase returns 400 for invalid credentials
  recordTest('1.8 Login - Non-existent user', noUserRes.status === 401 || noUserRes.status === 400 || noUserRes.status === 404,
    noUserRes.status !== 401 && noUserRes.status !== 400 && noUserRes.status !== 404 ? `Expected 401/400/404, got ${noUserRes.status}` : undefined,
    noUserRes.data);

  // Test 1.9: Get current user (authenticated)
  const meRes = await apiRequest('GET', '/auth/me', undefined, testUsers[0].token);
  // Response structure: { success: true, user: { id, email, ... }, profile: {...} }
  const meValid = meRes.status === 200 && meRes.data.user && meRes.data.user.email === testUsers[0].email;
  recordTest(
    '1.9 Get Current User - Authenticated',
    meValid,
    !meValid ? `Expected status 200 with user.email === ${testUsers[0].email}, got status ${meRes.status}` : undefined,
    meRes.data
  );

  // Test 1.10: Get current user (unauthenticated)
  const meUnauthRes = await apiRequest('GET', '/auth/me');
  recordTest('1.10 Get Current User - Unauthenticated', meUnauthRes.status === 401);

  // Test 1.11: Refresh token
  if (testUsers[0].refreshToken) {
    const refreshRes = await apiRequest('POST', '/auth/refresh', {
      refresh_token: testUsers[0].refreshToken,
    });
    recordTest(
      '1.11 Refresh Token - Valid',
      refreshRes.status === 200 && !!refreshRes.data.access_token
    );
  }

  // Test 1.12: Refresh token with invalid token
  const invalidRefreshRes = await apiRequest('POST', '/auth/refresh', {
    refresh_token: 'invalid-refresh-token',
  });
  recordTest('1.12 Refresh Token - Invalid', invalidRefreshRes.status >= 400);

  // Test 1.13: Update profile
  const updateProfileRes = await apiRequest(
    'PUT',
    '/auth/profile',
    { full_name: 'Updated Name', timezone: 'America/New_York' },
    testUsers[0].token
  );
  recordTest('1.13 Update Profile - Valid', updateProfileRes.status === 200);

  // Test 1.14: Update profile with empty data
  const emptyUpdateRes = await apiRequest('PUT', '/auth/profile', {}, testUsers[0].token);
  recordTest('1.14 Update Profile - Empty data', emptyUpdateRes.status === 200);
}

async function testHabits() {
  console.log('\n📋 Testing Habits Endpoints...\n');

  // Test 2.1: Get templates (public)
  const templatesRes = await apiRequest('GET', '/habits/templates');
  recordTest('2.1 Get Templates - Public', templatesRes.status === 200);

  // Test 2.2: Get categories (public)
  const categoriesRes = await apiRequest('GET', '/habits/categories');
  recordTest('2.2 Get Categories - Public', categoriesRes.status === 200);

  // Test 2.3: Create habit with valid data (REQUIRED for subsequent tests)
  const createHabitRes = await apiRequest(
    'POST',
    '/habits',
    { goal_text: 'Test habit goal for dependency testing' },
    testUsers[0].token
  );
  const habitId = createHabitRes.data?.id;
  const habitCreated = createHabitRes.status === 201 || createHabitRes.status === 200;
  recordTest('2.3 Create Habit - Valid', habitCreated);
  
  if (habitCreated && habitId) {
    testContext.habitIds.push(habitId);
    testContext.currentHabitId = habitId;
    
    // Verify creation by checking database
    const dbVerified = await verifyOperation(
      'Create Habit',
      () => prisma.user_habits.findUnique({ where: { id: habitId } }),
      (data) => data !== null && data.goal_text === 'Test habit goal for dependency testing',
      'Habit exists in database with correct goal_text'
    );
    recordTest('2.3.1 Create Habit - DB Verified', dbVerified, undefined, undefined, dbVerified);
  }

  // Test 2.4: Create habit with empty goal
  const emptyGoalRes = await apiRequest('POST', '/habits', { goal_text: '' }, testUsers[0].token);
  recordTest('2.4 Create Habit - Empty goal', emptyGoalRes.status >= 400);

  // Test 2.5: Create habit with too long goal (>500 chars)
  const longGoalRes = await apiRequest(
    'POST',
    '/habits',
    { goal_text: 'a'.repeat(501) },
    testUsers[0].token
  );
  recordTest('2.5 Create Habit - Too long goal', longGoalRes.status >= 400);

  // Test 2.6: Get all habits
  const getHabitsRes = await apiRequest('GET', '/habits', undefined, testUsers[0].token);
  // Response structure: { success: true, data: [...] }
  const habitsListValid = getHabitsRes.status === 200 && 
                          getHabitsRes.data.success === true && 
                          Array.isArray(getHabitsRes.data.data);
  recordTest('2.6 Get All Habits', habitsListValid,
    !habitsListValid ? `Expected status 200 with success:true and data array, got status ${getHabitsRes.status}` : undefined,
    getHabitsRes.data);
  
  // Verify the created habit is in the list
  if (habitsListValid && habitId && getHabitsRes.data.data) {
    const habitInList = getHabitsRes.data.data.some((h: any) => h.id === habitId);
    recordTest('2.6.1 Get All Habits - Created habit in list', habitInList);
  }

  // Test 2.7: Get habit by ID (DEPENDS ON: habit creation)
  if (habitId) {
    const getHabitRes = await apiRequest('GET', `/habits/${habitId}`, undefined, testUsers[0].token);
    const getValid = getHabitRes.status === 200 && getHabitRes.data?.id === habitId;
    recordTest('2.7 Get Habit by ID - Valid', getValid);
    
    // Verify data matches what we created
    if (getValid) {
      const dataMatches = getHabitRes.data.goal_text === 'Test habit goal for dependency testing';
      recordTest('2.7.1 Get Habit by ID - Data matches', dataMatches);
    }
  } else {
    recordTest('2.7 Get Habit by ID - SKIPPED (no habit created)', true);
  }

  // Test 2.8: Update habit (DEPENDS ON: habit creation)
  if (habitId) {
    const updateRes = await apiRequest(
      'PUT',
      `/habits/${habitId}`,
      { goal_text: 'Updated goal text' },
      testUsers[0].token
    );
    const updateValid = updateRes.status === 200;
    recordTest('2.8 Update Habit - Valid', updateValid);
    
    // Verify update by getting the habit again
    if (updateValid) {
      const verifyUpdate = await verifyByGet(
        'Update Habit',
        `/habits/${habitId}`,
        testUsers[0].token!,
        (data) => data.goal_text === 'Updated goal text',
        'Habit goal_text updated correctly'
      );
      recordTest('2.8.1 Update Habit - Verified by GET', verifyUpdate, undefined, undefined, verifyUpdate);
      
      // Also verify in database
      const dbUpdateVerified = await verifyOperation(
        'Update Habit',
        () => prisma.user_habits.findUnique({ where: { id: habitId } }),
        (data) => data?.goal_text === 'Updated goal text',
        'Habit updated in database'
      );
      recordTest('2.8.2 Update Habit - DB Verified', dbUpdateVerified, undefined, undefined, dbUpdateVerified);
    }
  } else {
    recordTest('2.8 Update Habit - SKIPPED (no habit created)', true);
  }

  // Test 2.9: Delete habit (DEPENDS ON: habit creation)
  if (habitId) {
    const deleteRes = await apiRequest('DELETE', `/habits/${habitId}`, undefined, testUsers[0].token);
    const deleteValid = deleteRes.status === 200 || deleteRes.status === 204;
    recordTest('2.9 Delete Habit - Valid', deleteValid);
    
    // Verify deletion by trying to get it (should 404)
    if (deleteValid) {
      const verifyDelete = await apiRequest('GET', `/habits/${habitId}`, undefined, testUsers[0].token);
      const deleted = verifyDelete.status === 404;
      recordTest('2.9.1 Delete Habit - Verified by GET (404)', deleted);
      
      // Also verify in database
      const dbDeleteVerified = await verifyOperation(
        'Delete Habit',
        () => prisma.user_habits.findUnique({ where: { id: habitId } }),
        (data) => data === null,
        'Habit deleted from database'
      );
      recordTest('2.9.2 Delete Habit - DB Verified', dbDeleteVerified, undefined, undefined, dbDeleteVerified);
    }
  } else {
    recordTest('2.9 Delete Habit - SKIPPED (no habit created)', true);
  }

  // Test 2.10: Try to update non-existent habit
  const updateNonExistentRes = await apiRequest(
    'PUT',
    '/habits/00000000-0000-0000-0000-000000000000',
    { goal_text: 'Should fail' },
    testUsers[0].token
  );
  recordTest('2.10 Update Habit - Non-existent', updateNonExistentRes.status === 404);

  // Test 2.11: Try to delete non-existent habit
  const deleteNonExistentRes = await apiRequest(
    'DELETE',
    '/habits/00000000-0000-0000-0000-000000000000',
    undefined,
    testUsers[0].token
  );
  recordTest('2.11 Delete Habit - Non-existent', deleteNonExistentRes.status === 404);
}

async function testJourneys(userToken: string) {
  console.log('\n📋 Testing Journeys Endpoints...\n');

  // DEPENDENCY: Need a habit first
  if (!testContext.currentHabitId) {
    // Create a habit for journey testing
    const createHabitRes = await apiRequest(
      'POST',
      '/habits',
      { goal_text: 'Journey test habit' },
      userToken
    );
    if (createHabitRes.status === 201 || createHabitRes.status === 200) {
      testContext.currentHabitId = createHabitRes.data?.id;
      testContext.habitIds.push(testContext.currentHabitId!);
    }
  }

  if (!testContext.currentHabitId) {
    console.log('   ⚠️  Skipping journey tests - habit creation failed');
    recordTest('3.0 Journeys - SKIPPED (no habit)', true);
    return;
  }

  const habitId = testContext.currentHabitId;

  // Test 3.1: Get active journey (none exists yet)
  const activeRes = await apiRequest('GET', '/journeys/active', undefined, userToken);
  recordTest('3.1 Get Active Journey - None exists', activeRes.status === 200 || activeRes.status === 404);

  // Test 3.2: Get all journeys
  const allJourneysRes = await apiRequest('GET', '/journeys', undefined, userToken);
  recordTest('3.2 Get All Journeys', allJourneysRes.status === 200);

  // Test 3.3: Create journey with valid plan data (REQUIRED for subsequent tests)
  const planData = {
    days: [
      {
        day_number: 1,
        theme: 'Day 1 Theme',
        tasks: [
          { title: 'Task 1', kind: 'action', effort: 3 },
          { title: 'Task 2', kind: 'reflection', effort: 2 },
        ],
      },
      {
        day_number: 2,
        theme: 'Day 2 Theme',
        tasks: [{ title: 'Task 3', kind: 'action', effort: 2 }],
      },
    ],
  };
  const createJourneyRes = await apiRequest(
    'POST',
    '/journeys',
    { user_habit_id: habitId, plan_data: planData },
    userToken
  );
  const journeyId = createJourneyRes.data?.id;
  const journeyCreated = createJourneyRes.status === 201 || createJourneyRes.status === 200;
  recordTest('3.3 Create Journey - Valid', journeyCreated);

  if (journeyCreated && journeyId) {
    testContext.journeyIds.push(journeyId);
    testContext.currentJourneyId = journeyId;

    // Verify creation in database
    const dbVerified = await verifyOperation(
      'Create Journey',
      () => prisma.journeys.findUnique({ where: { id: journeyId } }),
      (data) => data !== null && data.user_habit_id === habitId,
      'Journey exists in database with correct habit_id'
    );
    recordTest('3.3.1 Create Journey - DB Verified', dbVerified, undefined, undefined, dbVerified);

    // Verify journey days were created
    const daysCount = await prisma.journey_days.count({ where: { journey_id: journeyId } });
    recordTest('3.3.2 Create Journey - Days created', daysCount === 2, undefined, undefined, daysCount === 2);
  }

  // Test 3.4: Create journey with invalid habit_id
  const invalidHabitRes = await apiRequest(
    'POST',
    '/journeys',
    { user_habit_id: '00000000-0000-0000-0000-000000000000', plan_data: planData },
    userToken
  );
  recordTest('3.4 Create Journey - Invalid habit ID', invalidHabitRes.status >= 400);

  // Test 3.5: Create journey with empty plan_data
  const emptyPlanRes = await apiRequest(
    'POST',
    '/journeys',
    { user_habit_id: habitId, plan_data: {} },
    userToken
  );
  recordTest('3.5 Create Journey - Empty plan', emptyPlanRes.status >= 400);

  // Test 3.6: Get journey by ID (DEPENDS ON: journey creation)
  if (journeyId) {
    const getJourneyRes = await apiRequest('GET', `/journeys/${journeyId}`, undefined, userToken);
    const getValid = getJourneyRes.status === 200 && getJourneyRes.data?.id === journeyId;
    recordTest('3.6 Get Journey by ID', getValid);

    // Verify data matches
    if (getValid) {
      const dataMatches = getJourneyRes.data.user_habit_id === habitId;
      recordTest('3.6.1 Get Journey - Data matches', dataMatches);
    }
  } else {
    recordTest('3.6 Get Journey by ID - SKIPPED (no journey created)', true);
  }

  // Test 3.7: Get today's journey day (DEPENDS ON: journey creation)
  if (journeyId) {
    const todayRes = await apiRequest('GET', `/journeys/${journeyId}/today`, undefined, userToken);
    // May return 404 if journey not started yet
    recordTest('3.7 Get Today Journey Day', todayRes.status === 200 || todayRes.status === 404);
  } else {
    recordTest('3.7 Get Today Journey Day - SKIPPED (no journey created)', true);
  }

  // Test 3.8: Get journey calendar (DEPENDS ON: journey creation)
  if (journeyId) {
    const calendarRes = await apiRequest('GET', `/journeys/${journeyId}/calendar`, undefined, userToken);
    const calendarValid = calendarRes.status === 200 && Array.isArray(calendarRes.data);
    recordTest('3.8 Get Journey Calendar', calendarValid);
  } else {
    recordTest('3.8 Get Journey Calendar - SKIPPED (no journey created)', true);
  }

  // Test 3.9: Start journey (DEPENDS ON: journey creation)
  if (journeyId) {
    const startRes = await apiRequest('POST', `/journeys/${journeyId}/start`, undefined, userToken);
    const startValid = startRes.status === 200;
    recordTest('3.9 Start Journey', startValid);

    // Verify status changed to 'active'
    if (startValid) {
      const verifyStart = await verifyByGet(
        'Start Journey',
        `/journeys/${journeyId}`,
        userToken,
        (data) => data.status === 'active',
        'Journey status is active'
      );
      recordTest('3.9.1 Start Journey - Status verified', verifyStart, undefined, undefined, verifyStart);
    }
  } else {
    recordTest('3.9 Start Journey - SKIPPED (no journey created)', true);
  }

  // Test 3.10: Update journey (DEPENDS ON: journey creation)
  if (journeyId) {
    const updateRes = await apiRequest(
      'PUT',
      `/journeys/${journeyId}`,
      { status: 'paused' },
      userToken
    );
    const updateValid = updateRes.status === 200;
    recordTest('3.10 Update Journey - Valid', updateValid);

    // Verify update
    if (updateValid) {
      const verifyUpdate = await verifyByGet(
        'Update Journey',
        `/journeys/${journeyId}`,
        userToken,
        (data) => data.status === 'paused',
        'Journey status is paused'
      );
      recordTest('3.10.1 Update Journey - Status verified', verifyUpdate, undefined, undefined, verifyUpdate);
    }
  } else {
    recordTest('3.10 Update Journey - SKIPPED (no journey created)', true);
  }

  // Test 3.11: Restart journey (DEPENDS ON: journey creation)
  if (journeyId) {
    const restartRes = await apiRequest('POST', `/journeys/${journeyId}/restart`, undefined, userToken);
    const restartValid = restartRes.status === 200;
    recordTest('3.11 Restart Journey', restartValid);

    // Verify restart (should reset to day 1)
    if (restartValid) {
      const verifyRestart = await verifyByGet(
        'Restart Journey',
        `/journeys/${journeyId}`,
        userToken,
        (data) => data.status === 'active' || data.status === 'planned',
        'Journey restarted'
      );
      recordTest('3.11.1 Restart Journey - Verified', verifyRestart, undefined, undefined, verifyRestart);
    }
  } else {
    recordTest('3.11 Restart Journey - SKIPPED (no journey created)', true);
  }
}

async function runAllTests() {
  try {
    console.log('🚀 Starting Comprehensive Test Suite\n');
    console.log('='.repeat(60));

    // Setup
    await setupTestUsers();

    // Verify we have all tokens
    if (!testUsers[0].token || !testUsers[1].token || !testUsers[2].token) {
      throw new Error('Failed to obtain tokens for all test users');
    }

    const [user1, user2, admin] = testUsers;

    // Run test suites (in dependency order)
    await testAuthentication();
    
    // Health check (simple, no auth required)
    const healthRes = await apiRequest('GET', '/health');
    recordTest('Health Check', healthRes.status === 200);
    
    await testHabits();
    await testJourneys(user1.token!);
    await testUserEndpoints(user1.token!, user1.userId!); // Test all user endpoints
    await testAIEndpoints(user1.token!); // Test AI endpoints
    await testCoachEndpoints(user1.token!); // Test Coach endpoints
    await testAIDiagnosticsEndpoints(user1.token!); // Test AI Diagnostics endpoints
    await testNewEndpoints(user1.token!, user1.userId!); // Test new endpoints from Figma
    await testAdminEndpoints(admin.token!, user1.token!);
    await testBuddiesEndpoints(
      user1.token!,
      user1.userId!,
      user2.token!,
      user2.userId!
    );

    // Print summary
    const allPassed = printSummary();

    process.exit(allPassed ? 0 : 1);
  } catch (error: any) {
    console.error('\n💥 Fatal Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runAllTests();
