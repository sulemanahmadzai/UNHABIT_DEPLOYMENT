/**
 * AI Endpoints Test Suite
 * Tests all AI-related endpoints including onboarding, canonicalization, safety, quiz, plan generation, and coach chat
 */

import { apiRequest, recordTest } from './test-helpers';

export async function testAIEndpoints(userToken: string) {
  console.log('\n📋 Testing AI Endpoints...\n');

  // ============================================================================
  // AI HEALTH CHECK
  // ============================================================================
  const healthRes = await apiRequest('GET', '/ai/health', undefined);
  recordTest('AI 1.1 Health Check', healthRes.status === 200 || healthRes.status === 502,
    healthRes.status !== 200 && healthRes.status !== 502 ? `Expected 200 or 502, got ${healthRes.status}` : undefined);

  // ============================================================================
  // ONBOARDING TESTS
  // ============================================================================
  
  // Test 1: Start onboarding - Valid input
  const onboardingRes = await apiRequest(
    'POST',
    '/ai/onboarding/start',
    { user_input: 'I want to quit smoking cigarettes' },
    userToken
  );
  recordTest('AI 2.1 Start Onboarding - Valid', onboardingRes.status === 200 || onboardingRes.status === 502,
    onboardingRes.status !== 200 && onboardingRes.status !== 502 ? `Expected 200 or 502, got ${onboardingRes.status}` : undefined);

  // Test 2: Start onboarding - Empty input
  const emptyOnboardingRes = await apiRequest(
    'POST',
    '/ai/onboarding/start',
    { user_input: '' },
    userToken
  );
  recordTest('AI 2.2 Start Onboarding - Empty input', emptyOnboardingRes.status === 400);

  // Test 3: Start Onboarding - Too long input
  const longInput = 'a'.repeat(2001);
  const longOnboardingRes = await apiRequest(
    'POST',
    '/ai/onboarding/start',
    { user_input: longInput },
    userToken
  );
  recordTest('AI 2.3 Start Onboarding - Too long input', longOnboardingRes.status === 400);

  // Test 4: Start Onboarding - Missing field
  const missingOnboardingRes = await apiRequest(
    'POST',
    '/ai/onboarding/start',
    {},
    userToken
  );
  recordTest('AI 2.4 Start Onboarding - Missing field', missingOnboardingRes.status === 400);

  // ============================================================================
  // CANONICALIZE HABIT TESTS
  // ============================================================================
  
  // Test 1: Canonicalize habit - Valid
  const canonicalizeRes = await apiRequest(
    'POST',
    '/ai/canonicalize-habit',
    { user_input: 'I smoke cigarettes daily' },
    userToken
  );
  recordTest('AI 3.1 Canonicalize Habit - Valid', canonicalizeRes.status === 200 || canonicalizeRes.status === 502);

  // Test 2: Canonicalize habit - Empty input
  const emptyCanonicalizeRes = await apiRequest(
    'POST',
    '/ai/canonicalize-habit',
    { user_input: '' },
    userToken
  );
  recordTest('AI 3.2 Canonicalize Habit - Empty input', emptyCanonicalizeRes.status === 400);

  // Test 3: Canonicalize habit - Too long
  const longCanonicalizeRes = await apiRequest(
    'POST',
    '/ai/canonicalize-habit',
    { user_input: 'a'.repeat(1001) },
    userToken
  );
  recordTest('AI 3.3 Canonicalize Habit - Too long', longCanonicalizeRes.status === 400);

  // ============================================================================
  // SAFETY ASSESSMENT TESTS
  // ============================================================================
  
  // Test 1: Safety assessment - Valid
  const safetyRes = await apiRequest(
    'POST',
    '/ai/safety',
    { user_input: 'I want to stop cutting myself' },
    userToken
  );
  recordTest('AI 4.1 Safety Assessment - Valid', safetyRes.status === 200 || safetyRes.status === 502);

  // Test 2: Safety assessment - Empty input
  const emptySafetyRes = await apiRequest(
    'POST',
    '/ai/safety',
    { user_input: '' },
    userToken
  );
  recordTest('AI 4.2 Safety Assessment - Empty input', emptySafetyRes.status === 400);

  // Test 3: Safety assessment - Too long
  const longSafetyRes = await apiRequest(
    'POST',
    '/ai/safety',
    { user_input: 'a'.repeat(2001) },
    userToken
  );
  recordTest('AI 4.3 Safety Assessment - Too long', longSafetyRes.status === 400);

  // ============================================================================
  // QUIZ FORM TESTS
  // ============================================================================
  
  // Test 1: Generate quiz form - Valid
  const quizFormRes = await apiRequest(
    'POST',
    '/ai/quiz-form',
    {
      habit_category: 'smoking',
      user_context: 'I smoke 10 cigarettes per day',
      habit_description: 'Smoking cigarettes'
    },
    userToken
  );
  recordTest('AI 5.1 Generate Quiz Form - Valid', quizFormRes.status === 200 || quizFormRes.status === 502);

  // Test 2: Generate quiz form - Missing category
  const missingCategoryRes = await apiRequest(
    'POST',
    '/ai/quiz-form',
    {
      user_context: 'Test context',
    },
    userToken
  );
  recordTest('AI 5.2 Generate Quiz Form - Missing category', missingCategoryRes.status === 400);

  // Test 3: Generate quiz form - Empty category
  const emptyCategoryRes = await apiRequest(
    'POST',
    '/ai/quiz-form',
    {
      habit_category: '',
      user_context: 'Test context',
    },
    userToken
  );
  recordTest('AI 5.3 Generate Quiz Form - Empty category', emptyCategoryRes.status === 400);

  // ============================================================================
  // QUIZ SUMMARY TESTS
  // ============================================================================
  
  // Test 1: Get quiz summary - Valid
  const quizSummaryRes = await apiRequest(
    'POST',
    '/ai/quiz-summary',
    {
      answers: {
        'q1': 'option1',
        'q2': 'option2'
      },
      habit_category: 'smoking',
      habit_description: 'Smoking cigarettes',
      quiz_form: {
        habit_name_guess: 'Smoking',
        questions: [
          {
            id: 'q1',
            question: 'How often?',
            helper_text: null,
            options: [
              { id: 'opt1', label: 'Daily', helper_text: null }
            ]
          }
        ]
      }
    },
    userToken
  );
  recordTest('AI 6.1 Get Quiz Summary - Valid', quizSummaryRes.status === 200 || quizSummaryRes.status === 502);

  // Test 2: Get quiz summary - Missing answers
  const missingAnswersRes = await apiRequest(
    'POST',
    '/ai/quiz-summary',
    {
      habit_category: 'smoking',
    },
    userToken
  );
  recordTest('AI 6.2 Get Quiz Summary - Missing answers', missingAnswersRes.status === 400);

  // Test 3: Get quiz summary - Missing category
  const missingCategorySummaryRes = await apiRequest(
    'POST',
    '/ai/quiz-summary',
    {
      answers: { 'q1': 'option1' },
    },
    userToken
  );
  recordTest('AI 6.3 Get Quiz Summary - Missing category', missingCategorySummaryRes.status === 400);

  // ============================================================================
  // PLAN 21D TESTS
  // ============================================================================
  
  // Test 1: Generate 21-day plan - Valid
  const plan21dRes = await apiRequest(
    'POST',
    '/ai/plan-21d',
    {
      habit_goal: 'Quit smoking cigarettes',
      quiz_summary: 'User smokes 10 cigarettes per day, started 5 years ago',
      user_context: 'Works in stressful environment'
    },
    userToken
  );
  recordTest('AI 7.1 Generate 21-Day Plan - Valid', plan21dRes.status === 200 || plan21dRes.status === 502);

  // Test 2: Generate plan - Missing goal
  const missingGoalRes = await apiRequest(
    'POST',
    '/ai/plan-21d',
    {
      quiz_summary: 'Test summary',
    },
    userToken
  );
  recordTest('AI 7.2 Generate 21-Day Plan - Missing goal', missingGoalRes.status === 400);

  // Test 3: Generate plan - Missing summary
  const missingSummaryRes = await apiRequest(
    'POST',
    '/ai/plan-21d',
    {
      habit_goal: 'Quit smoking',
    },
    userToken
  );
  recordTest('AI 7.3 Generate 21-Day Plan - Missing summary', missingSummaryRes.status === 400);

  // Test 4: Generate plan - Too long goal
  const longGoalRes = await apiRequest(
    'POST',
    '/ai/plan-21d',
    {
      habit_goal: 'a'.repeat(501),
      quiz_summary: 'Test summary',
    },
    userToken
  );
  recordTest('AI 7.4 Generate 21-Day Plan - Too long goal', longGoalRes.status === 400);

  // ============================================================================
  // AI COACH TESTS
  // ============================================================================
  
  // Test 1: AI Coach chat - Valid
  const coachRes = await apiRequest(
    'POST',
    '/ai/coach',
    {
      message: 'I need help staying motivated',
      session_history: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'How can I help?' }
      ],
      context: {
        journey_day: 5,
        current_streak: 3,
        recent_slip: false
      }
    },
    userToken
  );
  recordTest('AI 8.1 AI Coach Chat - Valid', coachRes.status === 200 || coachRes.status === 502);

  // Test 2: AI Coach - Empty message
  const emptyCoachRes = await apiRequest(
    'POST',
    '/ai/coach',
    {
      message: '',
    },
    userToken
  );
  recordTest('AI 8.2 AI Coach Chat - Empty message', emptyCoachRes.status === 400);

  // Test 3: AI Coach - Too long message
  const longCoachRes = await apiRequest(
    'POST',
    '/ai/coach',
    {
      message: 'a'.repeat(2001),
    },
    userToken
  );
  recordTest('AI 8.3 AI Coach Chat - Too long message', longCoachRes.status === 400);

  // Test 4: AI Coach - Invalid session history
  const invalidHistoryRes = await apiRequest(
    'POST',
    '/ai/coach',
    {
      message: 'Test',
      session_history: [
        { role: 'invalid', content: 'Test' }
      ],
    },
    userToken
  );
  recordTest('AI 8.4 AI Coach Chat - Invalid session history', invalidHistoryRes.status === 400);

  // Test 5: AI Coach - Missing message
  const missingMessageRes = await apiRequest(
    'POST',
    '/ai/coach',
    {
      session_history: [],
    },
    userToken
  );
  recordTest('AI 8.5 AI Coach Chat - Missing message', missingMessageRes.status === 400);

  // ============================================================================
  // WHY DAY TESTS
  // ============================================================================
  
  // Test 1: Explain day - Valid
  const whyDayRes = await apiRequest(
    'POST',
    '/ai/why-day',
    {
      day_number: 5,
      day_theme: 'Understanding triggers',
      day_tasks: [
        { title: 'Identify triggers', kind: 'reflection' },
        { title: 'Practice breathing', kind: 'action' }
      ],
      habit_goal: 'Quit smoking'
    },
    userToken
  );
  recordTest('AI 9.1 Explain Day - Valid', whyDayRes.status === 200 || whyDayRes.status === 502);

  // Test 2: Explain day - Invalid day number (too low)
  const lowDayRes = await apiRequest(
    'POST',
    '/ai/why-day',
    {
      day_number: 0,
      day_theme: 'Test',
      day_tasks: [],
      habit_goal: 'Test'
    },
    userToken
  );
  recordTest('AI 9.2 Explain Day - Invalid day (too low)', lowDayRes.status === 400);

  // Test 3: Explain day - Invalid day number (too high)
  const highDayRes = await apiRequest(
    'POST',
    '/ai/why-day',
    {
      day_number: 22,
      day_theme: 'Test',
      day_tasks: [],
      habit_goal: 'Test'
    },
    userToken
  );
  recordTest('AI 9.3 Explain Day - Invalid day (too high)', highDayRes.status === 400);

  // Test 4: Explain day - Missing theme
  const missingThemeRes = await apiRequest(
    'POST',
    '/ai/why-day',
    {
      day_number: 5,
      day_tasks: [],
      habit_goal: 'Test'
    },
    userToken
  );
  recordTest('AI 9.4 Explain Day - Missing theme', missingThemeRes.status === 400);

  // Test 5: Explain day - Missing goal
  const missingGoalDayRes = await apiRequest(
    'POST',
    '/ai/why-day',
    {
      day_number: 5,
      day_theme: 'Test',
      day_tasks: [],
    },
    userToken
  );
  recordTest('AI 9.5 Explain Day - Missing goal', missingGoalDayRes.status === 400);

  // ============================================================================
  // UNAUTHENTICATED ACCESS TESTS
  // ============================================================================
  
  const unauthenticatedRes = await apiRequest(
    'POST',
    '/ai/onboarding/start',
    { user_input: 'Test' }
  );
  recordTest('AI 10.1 Unauthenticated Access', unauthenticatedRes.status === 401);
}
