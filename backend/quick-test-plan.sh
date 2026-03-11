#!/bin/bash

# Quick test to check if AI service returns new format

echo "Testing AI Plan Structure..."
echo "=============================="
echo ""

curl -X POST http://localhost:8000/plan-21d \
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
  }' | python -m json.tool

echo ""
echo "=============================="
echo "Check if day_1 is an array of objects (not a string)"
