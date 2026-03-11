import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyBadges() {
  try {
    console.log('=== VERIFYING BADGE SYSTEM ===\n');

    const badges = await prisma.badge_definitions.findMany({
      include: { badge_rules: true },
      orderBy: { slug: 'asc' }
    });

    // Check 1: Verify all badges have unique slugs
    console.log('1. Checking for duplicate slugs...');
    const slugs = badges.map(b => b.slug);
    const uniqueSlugs = new Set(slugs);
    if (slugs.length !== uniqueSlugs.size) {
      console.log('   ❌ DUPLICATE SLUGS FOUND!');
      const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
      console.log('   Duplicates:', duplicates);
    } else {
      console.log('   ✓ All slugs are unique');
    }

    // Check 2: Verify all badges have unique names
    console.log('\n2. Checking for duplicate names...');
    const names = badges.map(b => b.name);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      console.log('   ❌ DUPLICATE NAMES FOUND!');
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
      console.log('   Duplicates:', duplicates);
    } else {
      console.log('   ✓ All names are unique');
    }

    // Check 3: Verify all badges have rules
    console.log('\n3. Checking for badges without rules...');
    const badgesWithoutRules = badges.filter(b => b.badge_rules.length === 0);
    if (badgesWithoutRules.length > 0) {
      console.log(`   ❌ ${badgesWithoutRules.length} badges without rules:`);
      badgesWithoutRules.forEach(b => console.log(`      - ${b.name} (${b.slug})`));
    } else {
      console.log('   ✓ All badges have rules');
    }

    // Check 4: Verify rule types are valid
    console.log('\n4. Checking rule types...');
    const validRuleTypes = [
      'streak_days',
      'best_streak',
      'tasks_completed',
      'focus_sessions',
      'buddies_connected',
      'perfect_days',
      'xp_earned',
      'buddy_checkins',
      'journey_restarts',
      'reflections_submitted',
      'early_tasks',
      'night_tasks',
      'weekend_completions',
      'recovery_streak'
    ];
    
    let invalidRules = 0;
    badges.forEach(badge => {
      badge.badge_rules.forEach(rule => {
        if (!validRuleTypes.includes(rule.rule_type)) {
          console.log(`   ❌ Invalid rule type: ${rule.rule_type} for badge ${badge.name}`);
          invalidRules++;
        }
      });
    });
    
    if (invalidRules === 0) {
      console.log('   ✓ All rule types are valid');
    }

    // Check 5: Verify thresholds are positive
    console.log('\n5. Checking thresholds...');
    let invalidThresholds = 0;
    badges.forEach(badge => {
      badge.badge_rules.forEach(rule => {
        if (rule.threshold <= 0) {
          console.log(`   ❌ Invalid threshold: ${rule.threshold} for badge ${badge.name}`);
          invalidThresholds++;
        }
      });
    });
    
    if (invalidThresholds === 0) {
      console.log('   ✓ All thresholds are positive');
    }

    // Check 6: Verify badge categories
    console.log('\n6. Badge distribution by category:');
    const categoryCount: Record<string, number> = {};
    badges.forEach(badge => {
      const cat = badge.category || 'uncategorized';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    Object.entries(categoryCount).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} badges`);
    });

    // Check 7: Verify badge tiers
    console.log('\n7. Badge distribution by tier:');
    const tierCount: Record<string, number> = {};
    badges.forEach(badge => {
      const tier = badge.tier || 'untiered';
      tierCount[tier] = (tierCount[tier] || 0) + 1;
    });
    Object.entries(tierCount).forEach(([tier, count]) => {
      console.log(`   ${tier}: ${count} badges`);
    });

    // Check 8: Look for similar badges
    console.log('\n8. Checking for potentially similar badges...');
    const similarBadges: string[] = [];
    for (let i = 0; i < badges.length; i++) {
      for (let j = i + 1; j < badges.length; j++) {
        const badge1 = badges[i];
        const badge2 = badges[j];
        
        // Check if they have the same rule type and threshold
        const rules1 = badge1.badge_rules.map(r => `${r.rule_type}:${r.threshold}`);
        const rules2 = badge2.badge_rules.map(r => `${r.rule_type}:${r.threshold}`);
        
        const hasCommonRule = rules1.some(r => rules2.includes(r));
        if (hasCommonRule && badge1.category === badge2.category) {
          similarBadges.push(`   ⚠️  ${badge1.name} and ${badge2.name} might be similar`);
        }
      }
    }
    
    if (similarBadges.length > 0) {
      similarBadges.forEach(msg => console.log(msg));
    } else {
      console.log('   ✓ No similar badges found');
    }

    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log(`Total badges: ${badges.length}`);
    console.log(`Total rules: ${badges.reduce((sum, b) => sum + b.badge_rules.length, 0)}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

verifyBadges();
