import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupAndSeedBadges() {
  try {
    console.log('=== CLEANING UP TEST BADGES ===\n');

    // Delete test badges (badges without rules or with "test" in slug)
    const testBadgeSlugs = [
      'test-badge',
      'rule-test-badge',
      'test-badge-1769251045147',
      'test-badge-1769252175620',
      'test-badge-1769253263316',
      'test-badge-1769262970726',
      'test-badge-1769264178388'
    ];

    for (const slug of testBadgeSlugs) {
      try {
        await prisma.badge_definitions.delete({
          where: { slug }
        });
        console.log(`✓ Deleted test badge: ${slug}`);
      } catch (e) {
        console.log(`  Badge ${slug} not found, skipping`);
      }
    }

    console.log('\n=== SEEDING COMPREHENSIVE BADGE SYSTEM ===\n');

    // Define comprehensive badge system
    const badges = [
      // ========== STREAK BADGES (Progressive) ==========
      { 
        slug: "3-day-beginner", 
        name: "3-Day Beginner", 
        description: "Complete your first 3 days", 
        category: "streak", 
        tier: "bronze",
        icon_url: "🥉"
      },
      { 
        slug: "7-day-warrior", 
        name: "7-Day UnHabit Warrior", 
        description: "Maintain a 7-day streak", 
        category: "streak", 
        tier: "silver",
        icon_url: "🥈"
      },
      { 
        slug: "14-day-champion", 
        name: "14-Day Champion", 
        description: "Maintain a 14-day streak", 
        category: "streak", 
        tier: "gold",
        icon_url: "🥇"
      },
      { 
        slug: "21-day-transformation", 
        name: "21-Day Transformation", 
        description: "Complete the full 21-day journey", 
        category: "streak", 
        tier: "platinum",
        icon_url: "💎"
      },
      { 
        slug: "30-day-legend", 
        name: "30-Day Legend", 
        description: "Maintain a 30-day streak - You're unstoppable!", 
        category: "streak", 
        tier: "diamond",
        icon_url: "👑"
      },
      { 
        slug: "50-day-master", 
        name: "50-Day Master", 
        description: "Maintain a 50-day streak - True dedication!", 
        category: "streak", 
        tier: "diamond",
        icon_url: "🏆"
      },
      { 
        slug: "100-day-elite", 
        name: "100-Day Elite", 
        description: "Maintain a 100-day streak - Elite status achieved!", 
        category: "streak", 
        tier: "legendary",
        icon_url: "⭐"
      },

      // ========== MILESTONE BADGES ==========
      { 
        slug: "first-win", 
        name: "First Win", 
        description: "Complete your first task", 
        category: "milestone", 
        tier: "bronze",
        icon_url: "🎯"
      },
      { 
        slug: "task-warrior-10", 
        name: "Task Warrior", 
        description: "Complete 10 tasks", 
        category: "milestone", 
        tier: "bronze",
        icon_url: "💪"
      },
      { 
        slug: "task-champion-50", 
        name: "Task Champion", 
        description: "Complete 50 tasks", 
        category: "milestone", 
        tier: "silver",
        icon_url: "🎖️"
      },
      { 
        slug: "task-master-100", 
        name: "Task Master", 
        description: "Complete 100 tasks", 
        category: "milestone", 
        tier: "gold",
        icon_url: "🏅"
      },
      { 
        slug: "task-legend-250", 
        name: "Task Legend", 
        description: "Complete 250 tasks - Legendary commitment!", 
        category: "milestone", 
        tier: "platinum",
        icon_url: "🌟"
      },
      { 
        slug: "task-elite-500", 
        name: "Task Elite", 
        description: "Complete 500 tasks - Elite performer!", 
        category: "milestone", 
        tier: "diamond",
        icon_url: "💫"
      },

      // ========== CONSISTENCY BADGES ==========
      { 
        slug: "perfect-week", 
        name: "Perfect Week", 
        description: "Complete all tasks for 7 consecutive days", 
        category: "consistency", 
        tier: "gold",
        icon_url: "📅"
      },
      { 
        slug: "perfect-fortnight", 
        name: "Perfect Fortnight", 
        description: "Complete all tasks for 14 consecutive days", 
        category: "consistency", 
        tier: "platinum",
        icon_url: "📆"
      },
      { 
        slug: "perfect-month", 
        name: "Perfect Month", 
        description: "Complete all tasks for 30 consecutive days", 
        category: "consistency", 
        tier: "diamond",
        icon_url: "🗓️"
      },
      { 
        slug: "early-bird", 
        name: "Early Bird", 
        description: "Complete 10 tasks before noon", 
        category: "consistency", 
        tier: "silver",
        icon_url: "🌅"
      },

      // ========== FOCUS BADGES ==========
      { 
        slug: "focus-starter", 
        name: "Focus Starter", 
        description: "Complete your first focus session", 
        category: "focus", 
        tier: "bronze",
        icon_url: "🎯"
      },
      { 
        slug: "focus-master", 
        name: "Focus Master", 
        description: "Complete 10 focus sessions", 
        category: "focus", 
        tier: "silver",
        icon_url: "🧘"
      },
      { 
        slug: "focus-champion-25", 
        name: "Focus Champion", 
        description: "Complete 25 focus sessions", 
        category: "focus", 
        tier: "gold",
        icon_url: "🎓"
      },
      { 
        slug: "focus-legend-50", 
        name: "Focus Legend", 
        description: "Complete 50 focus sessions - Master of concentration!", 
        category: "focus", 
        tier: "platinum",
        icon_url: "🧠"
      },
      { 
        slug: "deep-work-warrior", 
        name: "Deep Work Warrior", 
        description: "Complete 100 focus sessions", 
        category: "focus", 
        tier: "diamond",
        icon_url: "⚡"
      },

      // ========== SOCIAL BADGES ==========
      { 
        slug: "buddy-builder", 
        name: "Buddy Builder", 
        description: "Invite and connect with a buddy", 
        category: "social", 
        tier: "bronze",
        icon_url: "🤝"
      },
      { 
        slug: "social-butterfly", 
        name: "Social Butterfly", 
        description: "Connect with 3 buddies", 
        category: "social", 
        tier: "silver",
        icon_url: "🦋"
      },
      { 
        slug: "community-leader", 
        name: "Community Leader", 
        description: "Connect with 5 buddies", 
        category: "social", 
        tier: "gold",
        icon_url: "👥"
      },
      { 
        slug: "support-champion", 
        name: "Support Champion", 
        description: "Send 25 buddy check-ins", 
        category: "social", 
        tier: "silver",
        icon_url: "💬"
      },

      // ========== XP/POINTS BADGES ==========
      { 
        slug: "xp-novice-100", 
        name: "XP Novice", 
        description: "Earn 100 XP", 
        category: "xp", 
        tier: "bronze",
        icon_url: "⚡"
      },
      { 
        slug: "xp-warrior-500", 
        name: "XP Warrior", 
        description: "Earn 500 XP", 
        category: "xp", 
        tier: "silver",
        icon_url: "💥"
      },
      { 
        slug: "xp-champion-1000", 
        name: "XP Champion", 
        description: "Earn 1,000 XP", 
        category: "xp", 
        tier: "gold",
        icon_url: "✨"
      },
      { 
        slug: "xp-master-2500", 
        name: "XP Master", 
        description: "Earn 2,500 XP", 
        category: "xp", 
        tier: "platinum",
        icon_url: "🌠"
      },
      { 
        slug: "xp-legend-5000", 
        name: "XP Legend", 
        description: "Earn 5,000 XP - Legendary status!", 
        category: "xp", 
        tier: "diamond",
        icon_url: "💎"
      },

      // ========== RECOVERY BADGES ==========
      { 
        slug: "comeback-kid", 
        name: "Comeback Kid", 
        description: "Restart your journey after a slip", 
        category: "recovery", 
        tier: "bronze",
        icon_url: "🔄"
      },
      { 
        slug: "resilience-warrior", 
        name: "Resilience Warrior", 
        description: "Maintain a streak longer than your previous best", 
        category: "recovery", 
        tier: "gold",
        icon_url: "💪"
      },
      { 
        slug: "phoenix-rising", 
        name: "Phoenix Rising", 
        description: "Achieve a 21-day streak after a major setback", 
        category: "recovery", 
        tier: "platinum",
        icon_url: "🔥"
      },

      // ========== SPECIAL BADGES ==========
      { 
        slug: "weekend-warrior", 
        name: "Weekend Warrior", 
        description: "Complete all tasks on 10 weekends", 
        category: "special", 
        tier: "silver",
        icon_url: "🎉"
      },
      { 
        slug: "night-owl", 
        name: "Night Owl", 
        description: "Complete 10 tasks after 8 PM", 
        category: "special", 
        tier: "bronze",
        icon_url: "🦉"
      },
      { 
        slug: "reflection-master", 
        name: "Reflection Master", 
        description: "Submit 20 reflections", 
        category: "special", 
        tier: "silver",
        icon_url: "📝"
      },
    ];

    // Upsert badges
    const createdBadges = [];
    for (const badge of badges) {
      const created = await prisma.badge_definitions.upsert({
        where: { slug: badge.slug },
        update: {
          name: badge.name,
          description: badge.description,
          category: badge.category,
          tier: badge.tier,
          icon_url: badge.icon_url,
        },
        create: badge,
      });
      createdBadges.push(created);
      console.log(`✓ ${badge.name} (${badge.slug})`);
    }

    console.log('\n=== CREATING BADGE RULES ===\n');

    // Define badge rules
    const badgeRules = [
      // Streak badges
      { slug: "3-day-beginner", rule_type: "streak_days", threshold: 3 },
      { slug: "7-day-warrior", rule_type: "streak_days", threshold: 7 },
      { slug: "14-day-champion", rule_type: "streak_days", threshold: 14 },
      { slug: "21-day-transformation", rule_type: "streak_days", threshold: 21 },
      { slug: "30-day-legend", rule_type: "streak_days", threshold: 30 },
      { slug: "50-day-master", rule_type: "streak_days", threshold: 50 },
      { slug: "100-day-elite", rule_type: "streak_days", threshold: 100 },

      // Milestone badges
      { slug: "first-win", rule_type: "tasks_completed", threshold: 1 },
      { slug: "task-warrior-10", rule_type: "tasks_completed", threshold: 10 },
      { slug: "task-champion-50", rule_type: "tasks_completed", threshold: 50 },
      { slug: "task-master-100", rule_type: "tasks_completed", threshold: 100 },
      { slug: "task-legend-250", rule_type: "tasks_completed", threshold: 250 },
      { slug: "task-elite-500", rule_type: "tasks_completed", threshold: 500 },

      // Consistency badges
      { slug: "perfect-week", rule_type: "perfect_days", threshold: 7 },
      { slug: "perfect-fortnight", rule_type: "perfect_days", threshold: 14 },
      { slug: "perfect-month", rule_type: "perfect_days", threshold: 30 },
      { slug: "early-bird", rule_type: "early_tasks", threshold: 10 },

      // Focus badges
      { slug: "focus-starter", rule_type: "focus_sessions", threshold: 1 },
      { slug: "focus-master", rule_type: "focus_sessions", threshold: 10 },
      { slug: "focus-champion-25", rule_type: "focus_sessions", threshold: 25 },
      { slug: "focus-legend-50", rule_type: "focus_sessions", threshold: 50 },
      { slug: "deep-work-warrior", rule_type: "focus_sessions", threshold: 100 },

      // Social badges
      { slug: "buddy-builder", rule_type: "buddies_connected", threshold: 1 },
      { slug: "social-butterfly", rule_type: "buddies_connected", threshold: 3 },
      { slug: "community-leader", rule_type: "buddies_connected", threshold: 5 },
      { slug: "support-champion", rule_type: "buddy_checkins", threshold: 25 },

      // XP badges
      { slug: "xp-novice-100", rule_type: "xp_earned", threshold: 100 },
      { slug: "xp-warrior-500", rule_type: "xp_earned", threshold: 500 },
      { slug: "xp-champion-1000", rule_type: "xp_earned", threshold: 1000 },
      { slug: "xp-master-2500", rule_type: "xp_earned", threshold: 2500 },
      { slug: "xp-legend-5000", rule_type: "xp_earned", threshold: 5000 },

      // Recovery badges
      { slug: "comeback-kid", rule_type: "journey_restarts", threshold: 1 },
      { slug: "resilience-warrior", rule_type: "best_streak", threshold: 1 }, // Special: current > previous best
      { slug: "phoenix-rising", rule_type: "recovery_streak", threshold: 21 },

      // Special badges
      { slug: "weekend-warrior", rule_type: "weekend_completions", threshold: 10 },
      { slug: "night-owl", rule_type: "night_tasks", threshold: 10 },
      { slug: "reflection-master", rule_type: "reflections_submitted", threshold: 20 },
    ];

    for (const rule of badgeRules) {
      const badge = createdBadges.find(b => b.slug === rule.slug);
      if (badge) {
        await prisma.badge_rules.upsert({
          where: {
            badge_id_rule_type: {
              badge_id: badge.id,
              rule_type: rule.rule_type,
            },
          },
          update: {
            threshold: rule.threshold,
            is_active: true,
          },
          create: {
            badge_id: badge.id,
            rule_type: rule.rule_type,
            threshold: rule.threshold,
            is_active: true,
          },
        });
        console.log(`✓ Rule: ${badge.name} - ${rule.rule_type} >= ${rule.threshold}`);
      }
    }

    console.log('\n=== BADGE SYSTEM SETUP COMPLETE ===\n');
    console.log(`Total badges: ${createdBadges.length}`);
    console.log(`Total rules: ${badgeRules.length}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

cleanupAndSeedBadges();
