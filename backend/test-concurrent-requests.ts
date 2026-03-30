/**
 * Concurrent Request Test
 * 
 * Tests if backend processes requests in parallel or sequentially
 * Run with: npx tsx test-concurrent-requests.ts
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

async function makeRequest(endpoint: string, name: string): Promise<{ name: string; time: number; success: boolean }> {
  const startTime = Date.now();
  
  try {
    await api.get(endpoint);
    const endTime = Date.now();
    return {
      name,
      time: endTime - startTime,
      success: true,
    };
  } catch (error: any) {
    const endTime = Date.now();
    return {
      name,
      time: endTime - startTime,
      success: false,
    };
  }
}

async function testSequential() {
  console.log('\n📊 Test 1: Sequential Requests (one after another)\n');
  
  const startTime = Date.now();
  
  const result1 = await makeRequest('/api/progress/today', 'Today Progress');
  console.log(`  ${result1.success ? '✅' : '❌'} ${result1.name}: ${result1.time}ms`);
  
  const result2 = await makeRequest('/api/progress/snapshot', 'Progress Snapshot');
  console.log(`  ${result2.success ? '✅' : '❌'} ${result2.name}: ${result2.time}ms`);
  
  const result3 = await makeRequest('/api/stripe/subscription', 'Stripe Subscription');
  console.log(`  ${result3.success ? '✅' : '❌'} ${result3.name}: ${result3.time}ms`);
  
  const totalTime = Date.now() - startTime;
  console.log(`\n  Total Time: ${totalTime}ms`);
  console.log(`  Average: ${Math.round(totalTime / 3)}ms per request`);
  
  return totalTime;
}

async function testConcurrent() {
  console.log('\n📊 Test 2: Concurrent Requests (all at once)\n');
  
  const startTime = Date.now();
  
  const promises = [
    makeRequest('/api/progress/today', 'Today Progress'),
    makeRequest('/api/progress/snapshot', 'Progress Snapshot'),
    makeRequest('/api/stripe/subscription', 'Stripe Subscription'),
  ];
  
  const results = await Promise.all(promises);
  
  results.forEach(result => {
    console.log(`  ${result.success ? '✅' : '❌'} ${result.name}: ${result.time}ms`);
  });
  
  const totalTime = Date.now() - startTime;
  const maxTime = Math.max(...results.map(r => r.time));
  
  console.log(`\n  Total Time: ${totalTime}ms`);
  console.log(`  Longest Request: ${maxTime}ms`);
  console.log(`  Shortest Request: ${Math.min(...results.map(r => r.time))}ms`);
  
  return totalTime;
}

async function testHighConcurrency() {
  console.log('\n📊 Test 3: High Concurrency (10 requests at once)\n');
  
  const startTime = Date.now();
  
  const promises = Array.from({ length: 10 }, (_, i) => 
    makeRequest('/api/progress/today', `Request ${i + 1}`)
  );
  
  const results = await Promise.all(promises);
  
  const successCount = results.filter(r => r.success).length;
  const avgTime = Math.round(results.reduce((sum, r) => sum + r.time, 0) / results.length);
  const maxTime = Math.max(...results.map(r => r.time));
  const minTime = Math.min(...results.map(r => r.time));
  
  console.log(`  Successful: ${successCount}/10`);
  console.log(`  Average Time: ${avgTime}ms`);
  console.log(`  Fastest: ${minTime}ms`);
  console.log(`  Slowest: ${maxTime}ms`);
  
  const totalTime = Date.now() - startTime;
  console.log(`\n  Total Time: ${totalTime}ms`);
  
  return totalTime;
}

async function runTests() {
  console.log('\n🧪 Concurrent Request Processing Test\n');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));
  
  try {
    // Test 1: Sequential
    const sequentialTime = await testSequential();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Concurrent
    const concurrentTime = await testConcurrent();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: High Concurrency
    const highConcurrencyTime = await testHighConcurrency();
    
    // Analysis
    console.log('\n' + '='.repeat(60));
    console.log('📈 Analysis');
    console.log('='.repeat(60));
    
    const speedup = (sequentialTime / concurrentTime).toFixed(2);
    
    console.log(`\nSequential Time: ${sequentialTime}ms`);
    console.log(`Concurrent Time: ${concurrentTime}ms`);
    console.log(`Speedup: ${speedup}x faster`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 Verdict');
    console.log('='.repeat(60));
    
    if (concurrentTime < sequentialTime * 0.5) {
      console.log('\n✅ EXCELLENT! Requests are processed in PARALLEL');
      console.log('   Backend is handling concurrent requests efficiently.');
      console.log('   Connection pool is working correctly.');
    } else if (concurrentTime < sequentialTime * 0.8) {
      console.log('\n✅ GOOD! Requests are mostly parallel');
      console.log('   Some queuing may occur under high load.');
      console.log('   Consider increasing connection_limit if needed.');
    } else {
      console.log('\n❌ ISSUE! Requests are still SEQUENTIAL');
      console.log('   Connection pool may not be configured correctly.');
      console.log('   Check:');
      console.log('   1. DATABASE_URL has connection_limit=10 (not 1)');
      console.log('   2. Backend server was restarted after .env change');
      console.log('   3. No other bottlenecks (slow queries, etc.)');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('');
    
    // High concurrency analysis
    if (highConcurrencyTime < 500) {
      console.log('✅ High concurrency test: EXCELLENT (<500ms for 10 requests)');
    } else if (highConcurrencyTime < 1000) {
      console.log('✅ High concurrency test: GOOD (<1s for 10 requests)');
    } else {
      console.log('⚠️  High concurrency test: SLOW (>1s for 10 requests)');
      console.log('   Consider increasing connection_limit or optimizing queries');
    }
    
    console.log('');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\nMake sure:');
    console.log('1. Backend is running: npm run dev');
    console.log('2. TEST_AUTH_TOKEN is valid in .env');
    console.log('3. Database is accessible');
    process.exit(1);
  }
}

// Run tests
runTests();
