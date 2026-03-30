# Performance Issue Analysis & Fix

## Issue Identified

The backend is experiencing significant slowness when completing daily tasks. The problem is in the **badge-awarding system**.

## Root Cause

When a user completes a task via `POST /api/progress/tasks/:taskId/complete`, the following happens:

1. Task is marked complete
2. XP is awarded
3. **`BadgeAwardingService.onTaskCompleted()` is called**
4. This triggers `checkAndAwardBadges()` which:
   - Fetches ALL badge rules from database
   - Fetches ALL earned badges for user
   - Calls `getUserStats()` which makes **6 separate database queries**:
     - Streaks query
     - Count all completed tasks
     - Count all focus sessions
     - Count all buddy links
     - **`countPerfectDays()` - MAJOR BOTTLENECK**
     - Point balance query

## The Major Bottleneck: `countPerfectDays()`

```typescript
async function countPerfectDays(userId: string): Promise<number> {
  const journeyDays = await prisma.journey_days.findMany({
    where: { journeys: { user_id: userId } },
    include: {
      journey_tasks: {
        include: {
          user_task_progress: { where: { user_id: userId } }
        }
      }
    }
  });
  // Then loops through ALL journey days and tasks
}
```

This query:
- Fetches ALL journey days for the user (could be 21+ days per journey)
- For EACH day, fetches ALL tasks
- For EACH task, fetches ALL progress records
- Then loops through everything in memory

**For a user with 3 journeys of 21 days each with 5 tasks per day:**
- 63 journey days
- 315 tasks
- 315+ progress records
- All loaded into memory and processed

This happens **EVERY TIME** a user completes a single task!

## Performance Impact

- Simple task completion: Should be ~50-100ms
- Current implementation: 500-2000ms+ (depending on user's journey history)
- Gets worse as user completes more journeys

## Solutions

### Option 1: Cache Badge Stats (Recommended)
Use Redis to cache user stats with a short TTL:

```typescript
// Cache stats for 5 minutes
const cacheKey = `user:${userId}:badge_stats`;
let stats = await redis.get(cacheKey);
if (!stats) {
  stats = await getUserStats(userId);
  await redis.setex(cacheKey, 300, JSON.stringify(stats));
}
```

### Option 2: Denormalize Perfect Days Count
Add a `perfect_days_count` column to `point_balances` or create a new `user_stats` table:
- Update count when day is completed
- Read from single row instead of calculating

### Option 3: Defer Badge Checking
Move badge checking to a background job:
- Complete task immediately
- Queue badge check for async processing
- User gets badges within a few seconds

### Option 4: Optimize Query
Add database indexes and optimize the query:
```sql
CREATE INDEX idx_journey_days_user ON journey_days(user_id);
CREATE INDEX idx_task_progress_user_status ON user_task_progress(user_id, status);
```

## Recommended Fix (Hybrid Approach)

1. **Immediate**: Add Redis caching for badge stats (5-minute TTL)
2. **Short-term**: Denormalize perfect_days_count
3. **Long-term**: Move badge checking to background jobs

## Implementation Priority

1. ✅ Add Redis caching to `getUserStats()` - **CRITICAL** (fixes issue immediately)
2. Add database indexes
3. Denormalize perfect_days_count
4. Consider background job processing for non-critical badge checks

## Testing

After implementing Redis caching:
- Task completion should drop from 500-2000ms to 50-150ms
- Subsequent completions within 5 minutes will be even faster (~30-50ms)

## Files to Modify

1. `src/services/badge-awarding.service.ts` - Add Redis caching
2. `src/services/progress.service.ts` - Ensure efficient queries
3. Database migrations - Add indexes
