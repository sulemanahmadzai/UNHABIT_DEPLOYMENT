/**
 * AI Diagnostics Endpoints Test Suite
 * Tests all AI diagnostics storage and retrieval endpoints
 */

import { apiRequest, recordTest, testContext } from './test-helpers';

export async function testAIDiagnosticsEndpoints(userToken: string) {
  console.log('\n📋 Testing AI Diagnostics Endpoints...\n');

  // ============================================================================
  // QUIZ FORM TESTS
  // ============================================================================
  
  // Test 1: Store quiz form - Valid
  const quizFormData = {
    user_habit_id: testContext.currentHabitId || undefined,
    raw_input: 'I want to quit smoking',
    quiz_form: {
      habit_name_guess: 'Smoking',
      questions: [
        {
          id: 'q1',
          question: 'How often do you smoke?',
          helper_text: 'Be honest',
          options: [
            { id: 'opt1', label: 'Daily' },
            { id: 'opt2', label: 'Weekly' }
          ]
        }
      ]
    }
  };
  const storeQuizFormRes = await apiRequest('POST', '/ai-diagnostics/quiz-form', quizFormData, userToken);
  const quizFormId = storeQuizFormRes.data?.id;
  const quizFormStored = storeQuizFormRes.status === 201 || storeQuizFormRes.status === 200;
  recordTest('AI Diagnostics 1.1 Store Quiz Form - Valid', quizFormStored,
    !quizFormStored ? `Expected 201/200, got ${storeQuizFormRes.status}` : undefined);

  // Test 2: Store quiz form - Missing raw_input
  const missingInputRes = await apiRequest(
    'POST',
    '/ai-diagnostics/quiz-form',
    {
      quiz_form: quizFormData.quiz_form
    },
    userToken
  );
  recordTest('AI Diagnostics 1.2 Store Quiz Form - Missing raw_input', missingInputRes.status === 400);

  // Test 3: Store quiz form - Missing quiz_form
  const missingQuizFormRes = await apiRequest(
    'POST',
    '/ai-diagnostics/quiz-form',
    {
      raw_input: 'Test input'
    },
    userToken
  );
  recordTest('AI Diagnostics 1.3 Store Quiz Form - Missing quiz_form', missingQuizFormRes.status === 400);

  // Test 4: Store quiz form - Invalid habit ID
  const invalidHabitIdRes = await apiRequest(
    'POST',
    '/ai-diagnostics/quiz-form',
    {
      user_habit_id: 'invalid-uuid',
      raw_input: 'Test',
      quiz_form: quizFormData.quiz_form
    },
    userToken
  );
  recordTest('AI Diagnostics 1.4 Store Quiz Form - Invalid habit ID', invalidHabitIdRes.status === 400);

  // ============================================================================
  // QUIZ SUMMARY TESTS
  // ============================================================================
  
  // Test 1: Store quiz summary - Valid
  const quizSummaryData = {
    user_habit_id: testContext.currentHabitId || undefined,
    raw_input: 'I smoke 10 cigarettes per day',
    quiz_summary: {
      user_habit_raw: 'Smoking cigarettes',
      canonical_habit_name: 'Tobacco Use',
      habit_category: 'Substance Use',
      category_confidence: 'high' as const,
      product_type: 'Cigarettes',
      severity_level: 'moderate' as const,
      core_loop: 'Stress -> Smoke -> Relief',
      primary_payoff: 'Stress relief',
      avoidance_target: 'Anxiety',
      identity_link: 'Smoker identity',
      dopamine_profile: 'High',
      collapse_condition: 'Stressful situations',
      long_term_cost: 'Health issues'
    },
    user_answers: {
      'q1': 'opt1',
      'q2': 'opt2'
    }
  };
  const storeQuizSummaryRes = await apiRequest('POST', '/ai-diagnostics/quiz-summary', quizSummaryData, userToken);
  const quizSummaryId = storeQuizSummaryRes.data?.id;
  const quizSummaryStored = storeQuizSummaryRes.status === 201 || storeQuizSummaryRes.status === 200;
  recordTest('AI Diagnostics 2.1 Store Quiz Summary - Valid', quizSummaryStored,
    !quizSummaryStored ? `Expected 201/200, got ${storeQuizSummaryRes.status}` : undefined);

  // Test 2: Store quiz summary - Missing raw_input
  const missingRawInputRes = await apiRequest(
    'POST',
    '/ai-diagnostics/quiz-summary',
    {
      quiz_summary: quizSummaryData.quiz_summary
    },
    userToken
  );
  recordTest('AI Diagnostics 2.2 Store Quiz Summary - Missing raw_input', missingRawInputRes.status === 400);

  // Test 3: Store quiz summary - Missing quiz_summary
  const missingSummaryRes = await apiRequest(
    'POST',
    '/ai-diagnostics/quiz-summary',
    {
      raw_input: 'Test input'
    },
    userToken
  );
  recordTest('AI Diagnostics 2.3 Store Quiz Summary - Missing quiz_summary', missingSummaryRes.status === 400);

  // Test 4: Store quiz summary - Invalid enum values
  const invalidEnumRes = await apiRequest(
    'POST',
    '/ai-diagnostics/quiz-summary',
    {
      raw_input: 'Test',
      quiz_summary: {
        ...quizSummaryData.quiz_summary,
        category_confidence: 'invalid' as any,
        severity_level: 'invalid' as any
      }
    },
    userToken
  );
  recordTest('AI Diagnostics 2.4 Store Quiz Summary - Invalid enum values', invalidEnumRes.status === 400);

  // ============================================================================
  // SAFETY ASSESSMENT TESTS
  // ============================================================================
  
  // Test 1: Store safety assessment - Valid
  const safetyData = {
    user_habit_id: testContext.currentHabitId || undefined,
    raw_input: 'I want to stop self-harming',
    safety: {
      risk: 'self_harm' as const,
      action: 'block_and_escalate' as const,
      message: 'This requires professional help'
    }
  };
  const storeSafetyRes = await apiRequest('POST', '/ai-diagnostics/safety', safetyData, userToken);
  const safetyId = storeSafetyRes.data?.id;
  const safetyStored = storeSafetyRes.status === 201 || storeSafetyRes.status === 200;
  recordTest('AI Diagnostics 3.1 Store Safety Assessment - Valid', safetyStored,
    !safetyStored ? `Expected 201/200, got ${storeSafetyRes.status}` : undefined);

  // Test 2: Store safety - Missing raw_input
  const missingSafetyInputRes = await apiRequest(
    'POST',
    '/ai-diagnostics/safety',
    {
      safety: safetyData.safety
    },
    userToken
  );
  recordTest('AI Diagnostics 3.2 Store Safety - Missing raw_input', missingSafetyInputRes.status === 400);

  // Test 3: Store safety - Missing safety object
  const missingSafetyObjRes = await apiRequest(
    'POST',
    '/ai-diagnostics/safety',
    {
      raw_input: 'Test input'
    },
    userToken
  );
  recordTest('AI Diagnostics 3.3 Store Safety - Missing safety object', missingSafetyObjRes.status === 400);

  // Test 4: Store safety - Invalid risk enum
  const invalidRiskRes = await apiRequest(
    'POST',
    '/ai-diagnostics/safety',
    {
      raw_input: 'Test',
      safety: {
        risk: 'invalid' as any,
        action: 'allow' as const,
        message: 'Test'
      }
    },
    userToken
  );
  recordTest('AI Diagnostics 3.4 Store Safety - Invalid risk enum', invalidRiskRes.status === 400);

  // ============================================================================
  // PLAN 21D TESTS
  // ============================================================================
  
  // Test 1: Store 21-day plan - Valid
  const plan21dData = {
    user_habit_id: testContext.currentHabitId || undefined,
    raw_input: 'Generate a plan to quit smoking',
    plan: {
      plan_summary: '21-day plan to quit smoking',
      day_tasks: {
        '1': 'Identify triggers',
        '2': 'Replace with healthy alternatives',
        '3': 'Practice breathing exercises'
      },
      day_whys: {
        '1': 'Understanding triggers helps avoid them',
        '2': 'Replacement reduces cravings'
      }
    }
  };
  const storePlanRes = await apiRequest('POST', '/ai-diagnostics/plan-21d', plan21dData, userToken);
  const planId = storePlanRes.data?.id;
  const planStored = storePlanRes.status === 201 || storePlanRes.status === 200;
  recordTest('AI Diagnostics 4.1 Store 21-Day Plan - Valid', planStored,
    !planStored ? `Expected 201/200, got ${storePlanRes.status}` : undefined);

  // Test 2: Store plan - Missing raw_input
  const missingPlanInputRes = await apiRequest(
    'POST',
    '/ai-diagnostics/plan-21d',
    {
      plan: plan21dData.plan
    },
    userToken
  );
  recordTest('AI Diagnostics 4.2 Store Plan - Missing raw_input', missingPlanInputRes.status === 400);

  // Test 3: Store plan - Missing plan object
  const missingPlanObjRes = await apiRequest(
    'POST',
    '/ai-diagnostics/plan-21d',
    {
      raw_input: 'Test input'
    },
    userToken
  );
  recordTest('AI Diagnostics 4.3 Store Plan - Missing plan object', missingPlanObjRes.status === 400);

  // ============================================================================
  // GET DIAGNOSTICS TESTS
  // ============================================================================
  
  // Test 1: Get all diagnostics
  const getAllRes = await apiRequest('GET', '/ai-diagnostics', undefined, userToken);
  recordTest('AI Diagnostics 5.1 Get All Diagnostics', getAllRes.status === 200);

  // Test 2: Get diagnostics with habit ID filter
  if (testContext.currentHabitId) {
    const getByHabitRes = await apiRequest(
      'GET',
      `/ai-diagnostics?user_habit_id=${testContext.currentHabitId}`,
      undefined,
      userToken
    );
    recordTest('AI Diagnostics 5.2 Get Diagnostics - By habit ID', getByHabitRes.status === 200);
  } else {
    recordTest('AI Diagnostics 5.2 Get Diagnostics - By habit ID - SKIPPED (no habit)', true);
  }

  // Test 3: Get diagnostics by type
  const getByTypeRes = await apiRequest(
    'GET',
    '/ai-diagnostics?type=quiz_form',
    undefined,
    userToken
  );
  recordTest('AI Diagnostics 5.3 Get Diagnostics - By type', getByTypeRes.status === 200);

  // Test 4: Get diagnostics with limit
  const getWithLimitRes = await apiRequest(
    'GET',
    '/ai-diagnostics?limit=5',
    undefined,
    userToken
  );
  recordTest('AI Diagnostics 5.4 Get Diagnostics - With limit', getWithLimitRes.status === 200);

  // Test 5: Get diagnostics - Invalid type
  const invalidTypeRes = await apiRequest(
    'GET',
    '/ai-diagnostics?type=invalid_type',
    undefined,
    userToken
  );
  // Should either return 400 or return empty/ignore invalid type
  recordTest('AI Diagnostics 5.5 Get Diagnostics - Invalid type', invalidTypeRes.status === 200 || invalidTypeRes.status === 400);

  // Test 6: Get diagnostic by ID - Valid
  if (quizFormId) {
    const getByIdRes = await apiRequest('GET', `/ai-diagnostics/${quizFormId}`, undefined, userToken);
    recordTest('AI Diagnostics 5.6 Get Diagnostic by ID - Valid', getByIdRes.status === 200);
  } else {
    recordTest('AI Diagnostics 5.6 Get Diagnostic by ID - SKIPPED (no diagnostic created)', true);
  }

  // Test 7: Get diagnostic by ID - Invalid ID
  const invalidIdRes = await apiRequest('GET', '/ai-diagnostics/invalid-id', undefined, userToken);
  recordTest('AI Diagnostics 5.7 Get Diagnostic by ID - Invalid ID', invalidIdRes.status === 400,
    invalidIdRes.status !== 400 ? `Expected 400, got ${invalidIdRes.status}` : undefined);

  // Test 8: Get diagnostic by ID - Non-existent
  const nonExistentId = '00000000-0000-0000-0000-000000000000';
  const nonExistentRes = await apiRequest('GET', `/ai-diagnostics/${nonExistentId}`, undefined, userToken);
  recordTest('AI Diagnostics 5.8 Get Diagnostic by ID - Non-existent', nonExistentRes.status === 404);

  // Test 9: Get latest diagnostic for habit - Valid
  if (testContext.currentHabitId) {
    const getLatestRes = await apiRequest(
      'GET',
      `/ai-diagnostics/habit/${testContext.currentHabitId}/latest/quiz_form`,
      undefined,
      userToken
    );
    recordTest('AI Diagnostics 5.9 Get Latest Diagnostic - Valid', getLatestRes.status === 200 || getLatestRes.status === 404);
  } else {
    recordTest('AI Diagnostics 5.9 Get Latest Diagnostic - SKIPPED (no habit)', true);
  }

  // Test 10: Get latest diagnostic - Invalid type
  if (testContext.currentHabitId) {
    const invalidLatestTypeRes = await apiRequest(
      'GET',
      `/ai-diagnostics/habit/${testContext.currentHabitId}/latest/invalid_type`,
      undefined,
      userToken
    );
    recordTest('AI Diagnostics 5.10 Get Latest Diagnostic - Invalid type', invalidLatestTypeRes.status === 400);
  } else {
    recordTest('AI Diagnostics 5.10 Get Latest Diagnostic - Invalid type - SKIPPED (no habit)', true);
  }

  // Test 11: Get latest diagnostic - Invalid habit ID
  const invalidHabitLatestRes = await apiRequest(
    'GET',
    '/ai-diagnostics/habit/invalid-id/latest/quiz_form',
    undefined,
    userToken
  );
  recordTest('AI Diagnostics 5.11 Get Latest Diagnostic - Invalid habit ID', invalidHabitLatestRes.status === 400,
    invalidHabitLatestRes.status !== 400 ? `Expected 400, got ${invalidHabitLatestRes.status}` : undefined);

  // ============================================================================
  // UNAUTHENTICATED ACCESS TESTS
  // ============================================================================
  
  const unauthenticatedRes = await apiRequest('GET', '/ai-diagnostics');
  recordTest('AI Diagnostics 6.1 Unauthenticated Access', unauthenticatedRes.status === 401);
}
