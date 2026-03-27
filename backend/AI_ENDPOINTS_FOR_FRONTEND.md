# AI Endpoints for Frontend Integration

## ✅ CORRECT 21-Day Plan Endpoint (WITH REASON FIELD)

### Endpoint
```
POST /api/ai/plan-21d
```

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Request Body
```json
{
  "habit_goal": "excessive social media use",
  "quiz_summary": "{\"user_habit_raw\":\"I scroll social media too much\",\"canonical_habit_name\":\"social media scrolling\",\"habit_category\":\"social_media\",\"severity_level\":\"moderate\",\"main_trigger\":\"boredom\",\"motivation_reason\":\"desire to improve health and sleep\"}",
  "user_context": "optional additional context"
}
```

### Response Format (NEW - WITH REASON)
```json
{
  "success": true,
  "data": {
    "plan_summary": "This 21-day plan helps you reduce excessive social media use...",
    "day_tasks": {
      "day_1": [
        {
          "title": "Track patterns",
          "description": "Write down when and why excessive social media use happens.",
          "reason": "Understanding your patterns is the first step to breaking them.",
          "kind": "reflection"
        },
        {
          "title": "Identify trigger",
          "description": "Note what most often leads to excessive social media use.",
          "reason": "Knowing your triggers helps you prepare and avoid automatic responses.",
          "kind": "cognitive"
        },
        {
          "title": "Set intention",
          "description": "Write why reducing excessive social media use matters.",
          "reason": "Clear motivation strengthens your commitment when urges arise.",
          "kind": "identity"
        }
      ],
      "day_2": [
        // 3-4 tasks per day...
      ],
      // ... day_3 through day_21
    },
    "day_whys": null
  }
}
```

### Task Structure (IMPORTANT!)
Each task now has **4 fields**:
- `title` (string): Short task title (≤ 12 words)
- `description` (string): Detailed task description (≤ 50 words)
- `reason` (string): **NEW!** Why this task matters (≤ 40 words)
- `kind` (string): Task type - one of: "behavioral", "cognitive", "environmental", "identity", "reflection"

### Number of Tasks Per Day
- Each day has **3-4 tasks** (not just 1!)
- Total: 21 days × 3-4 tasks = 63-84 tasks

---

## ⚠️ OLD Endpoint (DO NOT USE)

If you're getting responses without `reason` field or with only 1 task per day, you might be using an old endpoint or have cached data.

### Clear Cache
If you're getting old responses, clear Redis cache:
```bash
redis-cli FLUSHDB
```

Or use a different test input to bypass cache.

---

## Testing the Endpoint

### Using curl:
```bash
curl -X POST http://localhost:3000/api/ai/plan-21d \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "habit_goal": "excessive social media use",
    "quiz_summary": "{\"user_habit_raw\":\"I scroll social media too much\",\"canonical_habit_name\":\"social media scrolling\",\"habit_category\":\"social_media\",\"severity_level\":\"moderate\",\"main_trigger\":\"boredom\",\"motivation_reason\":\"desire to improve health and sleep\"}"
  }'
```

### Expected Response Time
- First request: 60-120 seconds (AI generation)
- Cached requests: < 1 second (24-hour cache)

---

## Full Flow for Frontend

1. **User completes quiz** → Call `/api/ai/quiz-summary`
2. **Get quiz summary response** → Extract the full JSON
3. **Generate 21-day plan** → Call `/api/ai/plan-21d` with:
   - `habit_goal`: User's habit description
   - `quiz_summary`: Stringified JSON from step 2
4. **Display plan** → Parse `data.day_tasks` and show 3-4 tasks per day

---

## Common Issues

### Issue: Getting old format without `reason`
**Solution**: Clear Redis cache or use different input

### Issue: Only 1 task per day
**Solution**: You're hitting old cached data. Clear cache.

### Issue: 502 Bad Gateway
**Solution**: AI service is down. Check if `http://localhost:8000` is running.

### Issue: Timeout
**Solution**: Normal for first request. Wait up to 2 minutes. Subsequent requests are cached.

---

## Verification

To verify you're getting the correct response:
1. Check that each task has `reason` field
2. Check that each day has 3-4 tasks (not 1)
3. Check that `kind` is one of: behavioral, cognitive, environmental, identity, reflection

---

## Contact

If you're still getting old responses after clearing cache, the issue is likely:
1. Using wrong endpoint
2. Old code deployed
3. Cache not cleared properly

Current correct version deployed: **March 26, 2026**
