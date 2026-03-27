#!/bin/bash

# Test script for 21-day plan endpoint
# This verifies the endpoint returns the correct format with reason field

echo "Testing /api/ai/plan-21d endpoint..."
echo ""

# You need to replace YOUR_JWT_TOKEN with an actual token
# Get token by logging in first: POST /api/auth/login

JWT_TOKEN="YOUR_JWT_TOKEN"

if [ "$JWT_TOKEN" = "YOUR_JWT_TOKEN" ]; then
  echo "⚠️  Please set JWT_TOKEN in this script first!"
  echo "   Get a token by calling: POST /api/auth/login"
  exit 1
fi

# Make the request
RESPONSE=$(curl -s -X POST http://localhost:3000/api/ai/plan-21d \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "habit_goal": "excessive social media scrolling",
    "quiz_summary": "{\"user_habit_raw\":\"I scroll social media too much before bed\",\"canonical_habit_name\":\"social media scrolling\",\"habit_category\":\"social_media\",\"severity_level\":\"moderate\",\"main_trigger\":\"boredom\",\"peak_times\":\"late night\",\"motivation_reason\":\"want better sleep\"}"
  }')

echo "Response received!"
echo ""

# Check if response has the correct structure
if echo "$RESPONSE" | grep -q '"reason"'; then
  echo "✅ SUCCESS: Response contains 'reason' field"
else
  echo "❌ FAIL: Response does NOT contain 'reason' field"
  echo ""
  echo "This means you're getting old cached data or using wrong endpoint."
  echo "Try clearing Redis cache: redis-cli FLUSHDB"
fi

# Count tasks in day_1
TASK_COUNT=$(echo "$RESPONSE" | grep -o '"title"' | head -4 | wc -l)
if [ "$TASK_COUNT" -ge 3 ]; then
  echo "✅ SUCCESS: Day 1 has $TASK_COUNT tasks (expected 3-4)"
else
  echo "❌ FAIL: Day 1 has only $TASK_COUNT tasks (expected 3-4)"
fi

echo ""
echo "Full response saved to: plan-response.json"
echo "$RESPONSE" | jq '.' > plan-response.json 2>/dev/null || echo "$RESPONSE" > plan-response.json

echo ""
echo "Sample task from day_1:"
echo "$RESPONSE" | jq '.data.day_tasks.day_1[0]' 2>/dev/null || echo "Install jq to see formatted output"
