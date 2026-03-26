/**
 * Stripe Integration Test Script
 * 
 * This script tests the complete Stripe integration flow
 * Run with: tsx test-stripe-integration.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('❌ TEST_AUTH_TOKEN not found in .env file');
  process.exit(1);
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, data?: any) {
  results.push({ name, passed, error, data });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (data) console.log(`   Data:`, JSON.stringify(data, null, 2));
}

async function testGetConfig() {
  try {
    const response = await api.get('/api/stripe/config');
    const hasPublishableKey = !!response.data.publishableKey;
    logTest(
      'Get Stripe Config',
      hasPublishableKey,
      hasPublishableKey ? undefined : 'No publishable key returned',
      response.data
    );
    return response.data.publishableKey;
  } catch (error: any) {
    logTest('Get Stripe Config', false, error.message);
    return null;
  }
}

async function testGetSubscription() {
  try {
    const response = await api.get('/api/stripe/subscription');
    logTest(
      'Get Subscription Status',
      response.data.success === true,
      undefined,
      response.data
    );
    return response.data.subscription;
  } catch (error: any) {
    logTest('Get Subscription Status', false, error.message);
    return null;
  }
}

async function testCreateCheckoutSession() {
  try {
    const response = await api.post('/api/stripe/create-checkout-session', {
      priceId: process.env.STRIPE_PRICE_ID || 'price_1TEa2lEoULduCiVK8c4Q8lFk',
      successUrl: `${BASE_URL}/success`,
      cancelUrl: `${BASE_URL}/cancel`,
    });
    
    const hasSessionId = !!response.data.sessionId;
    const hasUrl = !!response.data.url;
    
    logTest(
      'Create Checkout Session',
      hasSessionId && hasUrl,
      hasSessionId && hasUrl ? undefined : 'Missing sessionId or url',
      { sessionId: response.data.sessionId, url: response.data.url }
    );
    
    if (hasUrl) {
      console.log(`\n   🔗 Checkout URL: ${response.data.url}`);
      console.log('   📝 Complete checkout with test card: 4242 4242 4242 4242\n');
    }
    
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message;
    logTest('Create Checkout Session', false, errorMessage);
    return null;
  }
}

async function testCreatePortalSession(hasSubscription: boolean) {
  if (!hasSubscription) {
    logTest('Create Portal Session', false, 'Skipped - No active subscription');
    return null;
  }

  try {
    const response = await api.post('/api/stripe/create-portal-session', {
      returnUrl: `${BASE_URL}/settings`,
    });
    
    const hasUrl = !!response.data.url;
    
    logTest(
      'Create Portal Session',
      hasUrl,
      hasUrl ? undefined : 'No portal URL returned',
      { url: response.data.url }
    );
    
    if (hasUrl) {
      console.log(`\n   🔗 Portal URL: ${response.data.url}\n`);
    }
    
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message;
    logTest('Create Portal Session', false, errorMessage);
    return null;
  }
}

async function testCancelSubscription(hasActiveSubscription: boolean) {
  if (!hasActiveSubscription) {
    logTest('Cancel Subscription', false, 'Skipped - No active subscription');
    return false;
  }

  try {
    const response = await api.post('/api/stripe/cancel-subscription');
    logTest(
      'Cancel Subscription',
      response.data.success === true,
      undefined,
      response.data
    );
    return true;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message;
    logTest('Cancel Subscription', false, errorMessage);
    return false;
  }
}

async function testReactivateSubscription(wasCanceled: boolean) {
  if (!wasCanceled) {
    logTest('Reactivate Subscription', false, 'Skipped - Subscription not canceled');
    return false;
  }

  try {
    const response = await api.post('/api/stripe/reactivate-subscription');
    logTest(
      'Reactivate Subscription',
      response.data.success === true,
      undefined,
      response.data
    );
    return true;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message;
    logTest('Reactivate Subscription', false, errorMessage);
    return false;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Stripe Integration Tests\n');
  console.log('='.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(50));
  console.log('');

  // Test 1: Get Config
  console.log('📋 Test 1: Get Stripe Configuration');
  const publishableKey = await testGetConfig();
  console.log('');

  // Test 2: Get Subscription Status
  console.log('📋 Test 2: Get Subscription Status');
  const subscription = await testGetSubscription();
  const hasActiveSubscription = subscription && ['active', 'trialing'].includes(subscription.status);
  console.log('');

  // Test 3: Create Checkout Session
  console.log('📋 Test 3: Create Checkout Session');
  await testCreateCheckoutSession();
  console.log('');

  // Test 4: Create Portal Session
  console.log('📋 Test 4: Create Customer Portal Session');
  await testCreatePortalSession(!!subscription);
  console.log('');

  // Test 5: Cancel Subscription
  console.log('📋 Test 5: Cancel Subscription');
  const wasCanceled = await testCancelSubscription(hasActiveSubscription);
  console.log('');

  // Test 6: Reactivate Subscription
  console.log('📋 Test 6: Reactivate Subscription');
  await testReactivateSubscription(wasCanceled);
  console.log('');

  // Summary
  console.log('='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    console.log('');
  }

  console.log('='.repeat(50));
  console.log('');

  // Next Steps
  if (!hasActiveSubscription) {
    console.log('📝 Next Steps:');
    console.log('1. Complete the checkout using the URL above');
    console.log('2. Use test card: 4242 4242 4242 4242');
    console.log('3. Run this test again to verify subscription creation');
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
