# Testing New AI Plan Structure (3-4 Tasks Per Day)

## What Changed

The AI service now returns **3-4 tasks per day** instead of a single task string.

### Old Structure:
```json
{
  "day_1": "Write down when and why smoking happens",
  "day_2": "Pause 30 seconds before each urge"
}
```

### New Structure:
```json
{
  "day_1": [
    {
      "title": "Track your habit patterns",
      "description": "Write down when and why smoking usually happens. No pressure to change yet.",
      "kind": "reflection"
    },
    {
      "title": "Identify your main trigger",
      "description": "Note the one situation or feeling that most often leads to smoking.",
      "kind": "cognitive"
    },
    {
      "title": "Set your intention",
      "description": "Write one sentence about why quitting matters to you.",
      "kind": "identity"
    }
  ]
}
```

## Steps to Test

### Step 1: Restart the AI Service

The AI service needs to be restarted to pick up the schema changes.

**If using deployed AI service:**
- The deployed service needs to be updated with the new code
- Contact your deployment team or redeploy the AI service

**If using local AI service:**
```bash
# Navigate to AI directory
cd UnHabit/UNHABIT/AI

# Stop the current service (if running)
# Press Ctrl+C in the terminal where it's running

# Restart the service
python api_main.py
```

Or if using uvicorn:
```bash
uvicorn api_main:app --reload --host 0.0.0.0 --port 8000
```

### Step 2: Clear Redis Cache

Clear the cached plan responses so the new structure is fetched:

```bash
# Clear all AI plan cache
docker exec -it unhabit-redis redis-cli KEYS "ai:/plan-21d:*" | xargs docker exec -i unhabit-redis redis-cli DEL

# Or clear all AI cache
docker exec -it unhabit-redis redis-cli KEYS "ai:*" | xargs docker exec -i unhabit-redis redis-cli DEL
```

### Step 3: Run the Test

```bash
cd UnHabit/UNHABIT/backend
npm run test:ai-plan
```

## Expected Output

If everything is working correctly, you should see:

```
🧪 TESTING NEW AI PLAN STRUCTURE (3-4 TASKS PER DAY)
======================================================================

✅ AI service responded in ~10000ms

📊 PLAN STRUCTURE ANALYSIS
======================================================================
✅ Plan has all 21 days

DAILY TASK BREAKDOWN
──────────────────────────────────────────────────────────────────────
✅ Day  1: 3 tasks
✅ Day  2: 4 tasks
✅ Day  3: 3 tasks
... (all 21 days)

EXAMPLE: Day 1 Tasks (detailed view)
──────────────────────────────────────────────────────────────────────
  Task 1:
    Title: Track your habit patterns
    Description: Write down when and why smoking usually happens...
    Kind: reflection

  Task 2:
    Title: Identify your main trigger
    Description: Note the one situation or feeling...
    Kind: cognitive

  Task 3:
    Title: Set your intention
    Description: Write one sentence about why quitting matters...
    Kind: identity

📈 STATISTICS
======================================================================
Total tasks across 21 days: 70
Average tasks per day: 3.3

Task count distribution:
  3 tasks: 12 days (57%)
  4 tasks: 9 days (43%)

Task type distribution:
  behavioral: 25 tasks (36%)
  cognitive: 18 tasks (26%)
  environmental: 12 tasks (17%)
  identity: 10 tasks (14%)
  reflection: 5 tasks (7%)

✨ VALIDATION RESULTS
======================================================================
✅ Plan has 21 days
✅ All days have array of tasks
✅ Average 3-4 tasks per day
✅ All tasks have required fields
✅ Multiple task types used

ALL CHECKS PASSED! ✨

🎉 The new AI plan structure is working correctly!
✅ Backend can now receive 3-4 tasks per day
✅ Each task has title, description, and kind
✅ Ready for production use!
```

## Troubleshooting

### Issue: Still getting old structure (strings instead of arrays)

**Cause:** AI service hasn't picked up the schema changes

**Solution:**
1. Make sure you've restarted the AI service
2. Clear Redis cache: `docker exec -it unhabit-redis redis-cli FLUSHDB`
3. Run the test again

### Issue: AI service not responding

**Cause:** AI service is not running

**Solution:**
```bash
# Check if AI service is running
curl http://localhost:8000/health

# If not, start it:
cd UnHabit/UNHABIT/AI
python api_main.py
```

### Issue: "OPENAI_API_KEY not configured"

**Cause:** AI service needs OpenAI API key

**Solution:**
Add to `UnHabit/UNHABIT/AI/.env`:
```
OPENAI_API_KEY=your-api-key-here
```

## Backend Changes Made

The following files were updated to support the new structure:

1. **AI Service (Python):**
   - `schemas.py` - Added `DayTask` model, updated `Plan21D`
   - `prompts.py` - Updated `PLAN_21D_PROMPT` to request 3-4 tasks
   - `ai_nodes.py` - Updated fallback plan (not used if LLM works)

2. **Backend (TypeScript):**
   - `src/services/ai-client.service.ts` - Updated `Plan21DResponse` interface
   - Added `DayTask` interface
   - Exported new types

3. **Test Script:**
   - `test-ai-plan-structure.ts` - New test to verify structure

## Next Steps

Once the test passes:

1. ✅ The AI service is generating 3-4 tasks per day
2. ✅ The backend can receive and parse the new structure
3. ✅ Redis caching works with the new structure
4. ✅ Ready to update the frontend to display multiple tasks per day

## Manual Testing

You can also test manually with curl:

```bash
curl -X POST http://localhost:3000/api/ai/plan-21d \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "habit_goal": "quit smoking",
    "quiz_summary": "{\"user_habit_raw\": \"smoking\", \"canonical_habit_name\": \"cigarette smoking\", \"habit_category\": \"nicotine_smoking\", \"severity_level\": \"moderate\", \"core_loop\": \"stress relief\", \"primary_payoff\": \"relaxation\", \"avoidance_target\": \"anxiety\", \"identity_link\": \"daily routine\", \"dopamine_profile\": \"quick spike\", \"collapse_condition\": \"high stress\", \"long_term_cost\": \"health issues\"}"
  }'
```

Check that the response has arrays of tasks for each day.
