# AI Service Deployment Checklist

## Changes Made for 3-4 Tasks Per Day

The following files have been updated to return 3-4 tasks per day instead of 1:

### Modified Files:
1. ✅ `schemas.py` - Added `DayTask` model, updated `Plan21D`
2. ✅ `prompts.py` - Updated `PLAN_21D_PROMPT` to request 3-4 tasks
3. ✅ `ai_nodes.py` - Updated imports to include `DayTask`

### What Changed:

**Before (Old Format):**
```python
class Plan21D(BaseModel):
    plan_summary: str
    day_tasks: Dict[str, str]  # {"day_1": "Do X", "day_2": "Do Y"}
```

**After (New Format):**
```python
class DayTask(BaseModel):
    title: str
    description: str
    kind: str  # "behavioral", "cognitive", "environmental", "identity", "reflection"

class Plan21D(BaseModel):
    plan_summary: str
    day_tasks: Dict[str, List[DayTask]]  # {"day_1": [task1, task2, task3]}
```

## Deployment Steps

### Step 1: Verify Files Are Updated

Check that these files have the new code:

```bash
cd UnHabit/UNHABIT/AI

# Check schemas.py has DayTask class
grep -A 5 "class DayTask" schemas.py

# Check prompts.py has updated output format
grep -A 10 "OUTPUT FORMAT" prompts.py

# Check ai_nodes.py imports DayTask
grep "DayTask" ai_nodes.py
```

### Step 2: Deploy to Production

**Option A: Manual Deployment**
1. Copy the 3 updated files to your production server
2. Restart the AI service

**Option B: Git Deployment**
```bash
# Commit changes
git add schemas.py prompts.py ai_nodes.py
git commit -m "Update AI plan to return 3-4 tasks per day"
git push

# On production server
git pull
# Restart the service (method depends on your setup)
```

**Option C: Docker Deployment**
```bash
# Rebuild Docker image
docker build -t unhabit-ai .

# Push to registry (if using one)
docker push your-registry/unhabit-ai:latest

# On production, pull and restart
docker pull your-registry/unhabit-ai:latest
docker-compose up -d ai
```

### Step 3: Verify Deployment

Test the deployed service:

```bash
# Health check
curl https://py.khurasanlabs.com/health

# Test plan generation (replace YOUR_TOKEN)
curl -X POST https://py.khurasanlabs.com/plan-21d \
  -H "Content-Type: application/json" \
  -d '{
    "state": {
      "habit_description": "smoking cigarettes",
      "quiz_summary": {
        "user_habit_raw": "smoking",
        "canonical_habit_name": "cigarette smoking",
        "habit_category": "nicotine_smoking",
        "severity_level": "moderate",
        "core_loop": "stress relief",
        "primary_payoff": "relaxation",
        "avoidance_target": "anxiety",
        "identity_link": "daily routine",
        "dopamine_profile": "quick spike",
        "collapse_condition": "high stress",
        "long_term_cost": "health issues"
      }
    }
  }'
```

Check that the response has arrays of tasks:
```json
{
  "day_1": [
    {"title": "...", "description": "...", "kind": "..."},
    {"title": "...", "description": "...", "kind": "..."},
    {"title": "...", "description": "...", "kind": "..."}
  ]
}
```

### Step 4: Clear Backend Cache

After deployment, clear the Redis cache on your backend:

```bash
# Clear all AI plan cache
docker exec -it unhabit-redis redis-cli KEYS "ai:/plan-21d:*" | xargs docker exec -i unhabit-redis redis-cli DEL

# Or clear all AI cache
docker exec -it unhabit-redis redis-cli FLUSHDB
```

### Step 5: Test from Backend

```bash
cd UnHabit/UNHABIT/backend

# Make sure .env points to deployed service
# AI_SERVICE_URL="https://py.khurasanlabs.com"

# Run the test
npm run test:ai-plan
```

## Expected Test Results

After successful deployment, you should see:

```
✅ Plan has all 21 days
✅ All days have array of tasks
✅ Average 3-4 tasks per day
✅ All tasks have required fields
✅ Multiple task types used

ALL CHECKS PASSED! ✨
```

## Rollback Plan

If something goes wrong:

1. **Revert the files:**
```bash
git revert HEAD
git push
```

2. **Or manually restore old versions:**
   - Restore `schemas.py` with old `Plan21D` (Dict[str, str])
   - Restore `prompts.py` with old output format
   - Restart service

3. **Clear cache:**
```bash
docker exec -it unhabit-redis redis-cli FLUSHDB
```

## Verification Checklist

After deployment, verify:

- [ ] AI service health check returns OK
- [ ] Plan endpoint returns arrays of tasks (not strings)
- [ ] Each task has title, description, and kind
- [ ] Each day has 3-4 tasks
- [ ] Backend test passes: `npm run test:ai-plan`
- [ ] Frontend can display multiple tasks (if updated)

## Notes

- The backend has already been updated to handle the new structure
- The old format will cause validation errors in the backend
- Make sure to clear Redis cache after deployment
- Test thoroughly before deploying to production

## Support

If you encounter issues:

1. Check AI service logs for errors
2. Verify the schema changes are present in deployed code
3. Clear Redis cache completely
4. Test with a fresh request (not cached)
5. Check that OpenAI API key is configured

## Current Status

- ✅ AI code updated (schemas, prompts, nodes)
- ✅ Backend updated to receive new structure
- ✅ Test script created
- ⏳ **Waiting for AI service redeployment**
- ⏳ Backend test pending (will pass after redeployment)
