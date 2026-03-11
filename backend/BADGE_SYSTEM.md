# UnHabit Badge System

## Overview
The UnHabit badge system rewards users for their progress and achievements throughout their journey. Badges are automatically awarded when users meet specific criteria, providing motivation and recognition for their efforts.

## Badge Categories

### 🏆 Streak Badges (7 badges)
Progressive badges for maintaining daily streaks:
- **3-Day Beginner** (Bronze) - Complete your first 3 days
- **7-Day UnHabit Warrior** (Silver) - Maintain a 7-day streak
- **14-Day Champion** (Gold) - Maintain a 14-day streak
- **21-Day Transformation** (Platinum) - Complete the full 21-day journey
- **30-Day Legend** (Diamond) - Maintain a 30-day streak
- **50-Day Master** (Diamond) - Maintain a 50-day streak
- **100-Day Elite** (Legendary) - Maintain a 100-day streak

### 🎯 Milestone Badges (6 badges)
Badges for completing tasks:
- **First Win** (Bronze) - Complete your first task
- **Task Warrior** (Bronze) - Complete 10 tasks
- **Task Champion** (Silver) - Complete 50 tasks
- **Task Master** (Gold) - Complete 100 tasks
- **Task Legend** (Platinum) - Complete 250 tasks
- **Task Elite** (Diamond) - Complete 500 tasks

### 📅 Consistency Badges (4 badges)
Badges for perfect day completions:
- **Perfect Week** (Gold) - Complete all tasks for 7 consecutive days
- **Perfect Fortnight** (Platinum) - Complete all tasks for 14 consecutive days
- **Perfect Month** (Diamond) - Complete all tasks for 30 consecutive days
- **Early Bird** (Silver) - Complete 10 tasks before noon

### 🧘 Focus Badges (5 badges)
Badges for focus session completions:
- **Focus Starter** (Bronze) - Complete your first focus session
- **Focus Master** (Silver) - Complete 10 focus sessions
- **Focus Champion** (Gold) - Complete 25 focus sessions
- **Focus Legend** (Platinum) - Complete 50 focus sessions
- **Deep Work Warrior** (Diamond) - Complete 100 focus sessions

### 🤝 Social Badges (4 badges)
Badges for social interactions:
- **Buddy Builder** (Bronze) - Invite and connect with a buddy
- **Social Butterfly** (Silver) - Connect with 3 buddies
- **Community Leader** (Gold) - Connect with 5 buddies
- **Support Champion** (Silver) - Send 25 buddy check-ins

### ⚡ XP Badges (5 badges)
Badges for earning experience points:
- **XP Novice** (Bronze) - Earn 100 XP
- **XP Warrior** (Silver) - Earn 500 XP
- **XP Champion** (Gold) - Earn 1,000 XP
- **XP Master** (Platinum) - Earn 2,500 XP
- **XP Legend** (Diamond) - Earn 5,000 XP

### 🔄 Recovery Badges (3 badges)
Badges for resilience and recovery:
- **Comeback Kid** (Bronze) - Restart your journey after a slip
- **Resilience Warrior** (Gold) - Maintain a streak longer than your previous best
- **Phoenix Rising** (Platinum) - Achieve a 21-day streak after a major setback

### 🎉 Special Badges (3 badges)
Unique achievement badges:
- **Weekend Warrior** (Silver) - Complete all tasks on 10 weekends
- **Night Owl** (Bronze) - Complete 10 tasks after 8 PM
- **Reflection Master** (Silver) - Submit 20 reflections

## Badge Tiers
Badges are organized into tiers representing difficulty:
- **Bronze** - Entry-level achievements
- **Silver** - Intermediate achievements
- **Gold** - Advanced achievements
- **Platinum** - Expert-level achievements
- **Diamond** - Elite achievements
- **Legendary** - Ultimate achievements

## How Badges Are Awarded

### Automatic Awarding
Badges are automatically checked and awarded when:
1. A user completes a task
2. A user completes a focus session
3. A user connects with a buddy
4. A user submits a reflection
5. Daily cron jobs run to check progress

### Badge Rules
Each badge has one or more rules that define when it should be awarded. Rules include:
- `streak_days` - Current streak length
- `best_streak` - Best streak ever achieved
- `tasks_completed` - Total tasks completed
- `focus_sessions` - Total focus sessions completed
- `buddies_connected` - Number of active buddy connections
- `perfect_days` - Days where all tasks were completed
- `xp_earned` - Total XP earned
- `buddy_checkins` - Number of buddy check-ins sent
- `journey_restarts` - Number of times journey was restarted
- `reflections_submitted` - Number of reflections submitted
- `early_tasks` - Tasks completed before noon
- `night_tasks` - Tasks completed after 8 PM
- `weekend_completions` - Weekend days with all tasks completed
- `recovery_streak` - Streak length after a setback

## Technical Implementation

### Database Schema
```sql
-- Badge definitions
badge_definitions (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT,
  description TEXT,
  icon_url TEXT,
  category TEXT,
  tier TEXT
)

-- Badge rules
badge_rules (
  id UUID PRIMARY KEY,
  badge_id UUID REFERENCES badge_definitions,
  rule_type TEXT,
  threshold INTEGER,
  description TEXT,
  is_active BOOLEAN,
  UNIQUE(badge_id, rule_type)
)

-- User badges
user_badges (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  badge_id UUID REFERENCES badge_definitions,
  earned_at TIMESTAMP,
  evidence JSONB,
  UNIQUE(user_id, badge_id)
)
```

### Service Functions

#### Check and Award Badges
```typescript
// Check all badges for a user
await checkAndAwardBadges(userId);

// Check specific badge type
await checkAndAwardBadgeType(userId, 'streak_days');

// Called after task completion
await onTaskCompleted(userId, taskId);
```

#### Admin Functions
```typescript
// Get all badge definitions
await getBadgeDefinitions();

// Create new badge
await createBadgeDefinition(data);

// Update badge
await updateBadgeDefinition(id, data);

// Delete badge
await deleteBadgeDefinition(id);

// Manage badge rules
await createBadgeRule(data);
await updateBadgeRule(id, data);
await deleteBadgeRule(id);
```

## API Endpoints

### User Endpoints
- `GET /rewards/badges` - Get user's earned badges
- `GET /rewards/badges/available` - Get all available badges
- `GET /rewards/badges/gallery` - Get badge gallery with progress
- `GET /rewards/badges/next` - Get next badge to earn

### Admin Endpoints
- `GET /admin/badges` - List all badge definitions
- `POST /admin/badges` - Create new badge
- `PUT /admin/badges/:id` - Update badge
- `DELETE /admin/badges/:id` - Delete badge
- `GET /admin/badge-rules` - List all badge rules
- `POST /admin/badge-rules` - Create badge rule
- `PUT /admin/badge-rules/:id` - Update badge rule
- `DELETE /admin/badge-rules/:id` - Delete badge rule
- `POST /admin/seed/badges` - Seed default badges

## Maintenance Scripts

### Check Current Badges
```bash
npx tsx check-badges.ts
```

### Cleanup and Seed Badges
```bash
npx tsx cleanup-and-seed-badges.ts
```

This script:
1. Removes test badges without rules
2. Seeds all 37 production badges
3. Creates badge rules for each badge
4. Updates existing badges without overwriting

## Future Enhancements

### Potential New Badge Categories
- **Habit-Specific Badges** - Badges for specific habit types
- **Time-Based Badges** - Badges for completing tasks at specific times
- **Seasonal Badges** - Limited-time seasonal achievements
- **Challenge Badges** - Badges for completing specific challenges
- **Collaboration Badges** - Badges for group achievements

### Advanced Features
- Badge levels (e.g., Bronze → Silver → Gold for same achievement)
- Hidden/secret badges
- Badge showcasing on profile
- Badge trading or gifting
- Badge-based leaderboards
- Custom badge icons
- Badge notifications with animations
- Badge sharing on social media

## Notes
- All test badges have been removed from the system
- Each badge now has proper logic and earning criteria
- Badges are checked automatically after key user actions
- The system is designed to be easily extensible for new badge types
- Badge awarding is idempotent (won't award the same badge twice)
