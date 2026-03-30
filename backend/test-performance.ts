/**
 * Performance Test Script
 * 
 * Tests task completion speed before and after Redis caching
 * Run with: npx tsx test-performance.ts
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

async function getTodayTasks() {
  try {
    const response = await api.get('/api/progress/today');
    return response.data.data.tasks || [];
  } catch (error: any) {
    console.error('Failed to get today\'s tasks:', error.message);
    return [];
  }
}

async function completeTask(taskId: string): Promise<number> {
  const startTime = Date.now();
  
  try {
    await api.post(`/api/progress/tasks/${taskId}/complete`);
    const endTime = Date.now();
    return endTime - startTime;
  } catch (error: any) {
    console.error(`Failed to complete task ${taskId}:`, error.message);
    return -1;
  }
}

async function uncompleteTask(taskId: string) {
  try {
    await api.post(`/api/progress/tasks/${taskId}/uncomplete`);
  } catch (error: any) {
    console.error(`Failed to uncomplete task ${taskId}:`, error.message);
  }
}

async function runPerformanceTest() {
  console.log('\n🚀 Performance Test: Task Completion Speed\n');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));
  console.log('');

  // Get today's tasks
  console.log('📋 Fetching today\'s tasks...');
  const tasks = await getTodayTasks();

  if (tasks.length === 0) {
    console.error('❌ No tasks found for today. Please ensure you have an active journey.');
    process.exit(1);
  }

  const testTask = tasks[0];
  console.log(`✅ Found task: "${testTask.title}" (ID: ${testTask.id})`);
  console.log('');

  // Ensure task is not completed
  if (testTask.completed) {
    console.log('🔄 Uncompleting task for test...');
    await uncompleteTask(testTask.id);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test 1: First completion (cache miss)
  console.log('📊 Test 1: First Completion (Cache Miss)');
  const time1 = await completeTask(testTask.id);
  if (time1 > 0) {
    console.log(`   ⏱️  Time: ${time1}ms`);
    if (time1 < 200) {
      console.log('   ✅ Excellent! (< 200ms)');
    } else if (time1 < 500) {
      console.log('   ⚠️  Good, but could be faster (200-500ms)');
    } else {
      console.log('   ❌ Slow! (> 500ms) - Check if Redis is running');
    }
  }
  console.log('');

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Uncomplete for second test
  console.log('🔄 Resetting task...');
  await uncompleteTask(testTask.id);
  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 2: Second completion (cache hit)
  console.log('📊 Test 2: Second Completion (Cache Hit)');
  const time2 = await completeTask(testTask.id);
  if (time2 > 0) {
    console.log(`   ⏱️  Time: ${time2}ms`);
    if (time2 < 100) {
      console.log('   ✅ Excellent! Cache is working (< 100ms)');
    } else if (time2 < 200) {
      console.log('   ✅ Good! (100-200ms)');
    } else {
      console.log('   ⚠️  Slower than expected - Cache might not be working');
    }
  }
  console.log('');

  // Test 3: Multiple rapid completions
  console.log('📊 Test 3: Rapid Completions (5x)');
  const times: number[] = [];
  
  for (let i = 0; i < 5; i++) {
    await uncompleteTask(testTask.id);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const time = await completeTask(testTask.id);
    if (time > 0) {
      times.push(time);
      console.log(`   ${i + 1}. ${time}ms`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  if (times.length > 0) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    console.log('');
    console.log('   📈 Statistics:');
    console.log(`      Average: ${avg}ms`);
    console.log(`      Min: ${min}ms`);
    console.log(`      Max: ${max}ms`);
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('📊 Performance Summary');
  console.log('='.repeat(60));
  
  if (time1 > 0 && time2 > 0) {
    const improvement = Math.round(((time1 - time2) / time1) * 100);
    console.log(`First completion: ${time1}ms`);
    console.log(`Second completion: ${time2}ms`);
    console.log(`Improvement: ${improvement}% faster`);
    console.log('');
    
    if (time1 < 200 && time2 < 100) {
      console.log('✅ Performance is EXCELLENT!');
      console.log('   Redis caching is working perfectly.');
    } else if (time1 < 500 && time2 < 200) {
      console.log('✅ Performance is GOOD!');
      console.log('   Redis caching is working.');
    } else if (time1 > 500) {
      console.log('⚠️  Performance needs improvement!');
      console.log('   Recommendations:');
      console.log('   1. Ensure Redis is running: redis-server');
      console.log('   2. Check REDIS_ENABLED=true in .env');
      console.log('   3. Check REDIS_URL in .env');
      console.log('   4. Restart the backend server');
    } else {
      console.log('⚠️  Performance is OK but could be better.');
      console.log('   Check Redis connection and cache configuration.');
    }
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  // Redis check
  console.log('💡 Tips:');
  console.log('   - First completion is slower (cache miss)');
  console.log('   - Subsequent completions should be faster (cache hit)');
  console.log('   - Cache expires after 5 minutes');
  console.log('   - Without Redis: 500-2000ms per completion');
  console.log('   - With Redis: 50-150ms (first), 30-50ms (cached)');
  console.log('');
}

// Run test
runPerformanceTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
