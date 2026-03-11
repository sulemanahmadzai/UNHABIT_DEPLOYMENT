/**
 * Test script for new AI Plan structure (3-4 tasks per day)
 * 
 * This script tests that the AI service returns the new structure
 * with multiple tasks per day instead of a single task string.
 */

import "dotenv/config";
import * as AIClient from "./src/services/ai-client.service.js";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function warning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function highlight(message: string) {
  log(`🚀 ${message}`, colors.magenta);
}

async function testPlanStructure() {
  log("\n" + "=".repeat(70), colors.cyan);
  log("🧪 TESTING NEW AI PLAN STRUCTURE (3-4 TASKS PER DAY)", colors.cyan);
  log("=".repeat(70) + "\n", colors.cyan);

  info("Testing AI service to verify it returns 3-4 tasks per day...\n");

  // Create a test quiz summary
  const testQuizSummary = {
    user_habit_raw: "smoking cigarettes",
    canonical_habit_name: "cigarette smoking",
    habit_category: "nicotine_smoking",
    category_confidence: "high" as const,
    product_type: "cigarettes",
    severity_level: "moderate" as const,
    core_loop: "Stress triggers craving, smoking provides relief",
    primary_payoff: "Stress relief and relaxation",
    avoidance_target: "Anxiety and discomfort",
    identity_link: "Part of daily routine and social identity",
    dopamine_profile: "Quick spike followed by craving",
    collapse_condition: "High stress situations",
    long_term_cost: "Health deterioration and financial burden",
  };

  const request: AIClient.Plan21DRequest = {
    habit_goal: "quit smoking cigarettes",
    quiz_summary: JSON.stringify(testQuizSummary),
  };

  info("Sending request to AI service...");
  info(`Habit goal: ${request.habit_goal}`);
  info(`AI Service URL: ${process.env.AI_SERVICE_URL || "http://localhost:8000"}\n`);

  const startTime = Date.now();
  const result = await AIClient.generatePlan21D(request);
  const duration = Date.now() - startTime;

  if (!result.success) {
    error(`AI service request failed: ${result.error}`);
    error("Make sure your AI service is running!");
    process.exit(1);
  }

  success(`AI service responded in ${duration}ms\n`);

  log("=".repeat(70), colors.blue);
  log("📊 PLAN STRUCTURE ANALYSIS", colors.blue);
  log("=".repeat(70), colors.blue);

  const plan = result.data!;

  // Check plan summary
  info(`Plan Summary: ${plan.plan_summary.substring(0, 100)}...`);

  // Analyze day_tasks structure
  const dayKeys = Object.keys(plan.day_tasks);
  info(`\nTotal days in plan: ${dayKeys.length}`);

  if (dayKeys.length !== 21) {
    warning(`Expected 21 days, got ${dayKeys.length}`);
  } else {
    success("Plan has all 21 days");
  }

  // Check structure of each day
  let structureValid = true;
  let totalTasks = 0;
  const taskCounts: Record<number, number> = {};

  log("\n" + "─".repeat(70), colors.cyan);
  log("DAILY TASK BREAKDOWN", colors.cyan);
  log("─".repeat(70), colors.cyan);

  for (let i = 1; i <= 21; i++) {
    const dayKey = `day_${i}`;
    const dayTasks = plan.day_tasks[dayKey];

    if (!dayTasks) {
      error(`Missing ${dayKey}`);
      structureValid = false;
      continue;
    }

    // Check if it's an array
    if (!Array.isArray(dayTasks)) {
      error(`${dayKey}: Expected array, got ${typeof dayTasks}`);
      structureValid = false;
      continue;
    }

    const taskCount = dayTasks.length;
    totalTasks += taskCount;
    taskCounts[taskCount] = (taskCounts[taskCount] || 0) + 1;

    // Validate each task has required fields
    let dayValid = true;
    for (let j = 0; j < dayTasks.length; j++) {
      const task = dayTasks[j];
      if (!task.title || !task.description || !task.kind) {
        error(`${dayKey} Task ${j + 1}: Missing required fields`);
        dayValid = false;
        structureValid = false;
      }
    }

    const statusIcon = dayValid && taskCount >= 3 && taskCount <= 4 ? "✅" : "⚠️";
    const countColor = taskCount >= 3 && taskCount <= 4 ? colors.green : colors.yellow;
    
    log(
      `${statusIcon} Day ${i.toString().padStart(2)}: ${taskCount} tasks`,
      countColor
    );

    // Show first day's tasks in detail
    if (i === 1) {
      log("\n" + "  " + "─".repeat(66), colors.cyan);
      log("  EXAMPLE: Day 1 Tasks (detailed view)", colors.cyan);
      log("  " + "─".repeat(66), colors.cyan);
      dayTasks.forEach((task, idx) => {
        log(`  Task ${idx + 1}:`, colors.magenta);
        log(`    Title: ${task.title}`, colors.reset);
        log(`    Description: ${task.description}`, colors.reset);
        log(`    Kind: ${task.kind}`, colors.reset);
        if (idx < dayTasks.length - 1) log("");
      });
      log("  " + "─".repeat(66) + "\n", colors.cyan);
    }
  }

  // Summary statistics
  log("\n" + "=".repeat(70), colors.cyan);
  log("📈 STATISTICS", colors.cyan);
  log("=".repeat(70), colors.cyan);

  info(`Total tasks across 21 days: ${totalTasks}`);
  info(`Average tasks per day: ${(totalTasks / 21).toFixed(1)}`);
  
  log("\nTask count distribution:", colors.cyan);
  Object.entries(taskCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([count, days]) => {
      const percentage = ((days / 21) * 100).toFixed(0);
      log(`  ${count} tasks: ${days} days (${percentage}%)`, colors.reset);
    });

  // Check task kinds distribution
  const kindCounts: Record<string, number> = {};
  Object.values(plan.day_tasks).forEach((dayTasks) => {
    if (Array.isArray(dayTasks)) {
      dayTasks.forEach((task) => {
        kindCounts[task.kind] = (kindCounts[task.kind] || 0) + 1;
      });
    }
  });

  log("\nTask type distribution:", colors.cyan);
  Object.entries(kindCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([kind, count]) => {
      const percentage = ((count / totalTasks) * 100).toFixed(0);
      log(`  ${kind}: ${count} tasks (${percentage}%)`, colors.reset);
    });

  // Final validation
  log("\n" + "=".repeat(70), colors.cyan);
  log("✨ VALIDATION RESULTS", colors.cyan);
  log("=".repeat(70), colors.cyan);

  const checks = [
    {
      name: "Plan has 21 days",
      passed: dayKeys.length === 21,
    },
    {
      name: "All days have array of tasks",
      passed: structureValid,
    },
    {
      name: "Average 3-4 tasks per day",
      passed: totalTasks >= 63 && totalTasks <= 84, // 21 * 3 to 21 * 4
    },
    {
      name: "All tasks have required fields",
      passed: structureValid,
    },
    {
      name: "Multiple task types used",
      passed: Object.keys(kindCounts).length >= 3,
    },
  ];

  checks.forEach((check) => {
    if (check.passed) {
      success(check.name);
    } else {
      error(check.name);
    }
  });

  const allPassed = checks.every((c) => c.passed);

  log("\n" + "=".repeat(70), colors.cyan);
  if (allPassed) {
    success("ALL CHECKS PASSED! ✨");
    log("\n🎉 The new AI plan structure is working correctly!", colors.green);
    log("✅ Backend can now receive 3-4 tasks per day", colors.green);
    log("✅ Each task has title, description, and kind", colors.green);
    log("✅ Ready for production use!\n", colors.green);
  } else {
    warning("SOME CHECKS FAILED");
    log("\n⚠️  The AI plan structure needs adjustment", colors.yellow);
    log("Check the errors above for details\n", colors.yellow);
  }

  // Show sample JSON structure
  log("=".repeat(70), colors.cyan);
  log("📄 SAMPLE JSON STRUCTURE (Day 1)", colors.cyan);
  log("=".repeat(70), colors.cyan);
  console.log(JSON.stringify({ day_1: plan.day_tasks.day_1 }, null, 2));
  log("=".repeat(70) + "\n", colors.cyan);

  process.exit(allPassed ? 0 : 1);
}

// Run the test
testPlanStructure().catch((err) => {
  error(`Test failed with error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
