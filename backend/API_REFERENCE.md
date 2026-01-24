# UnHabit API Reference

Complete API documentation for the UnHabit backend service.

**Base URL:** `http://localhost:3000/api`

**Authentication:** Most endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Table of Contents

1. [Health](#health)
2. [Authentication](#authentication)
3. [Habits](#habits)
4. [Journeys](#journeys)
5. [Progress](#progress)
6. [Analytics](#analytics)
7. [AI Services](#ai-services)
8. [AI Diagnostics Storage](#ai-diagnostics-storage)
9. [Coach](#coach)
10. [Notifications](#notifications)
11. [Rewards](#rewards)
12. [Settings](#settings)
13. [Buddies](#buddies)
14. [Daily Challenges](#daily-challenges)

---

## Health

### GET /api/health
Check API health status.

**Auth Required:** No

**Response:**
```json
{
  "ok": true,
  "ts": 1704931200000
}
```

---

## Authentication

### POST /api/auth/register
Register a new user.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "user": { "id": "uuid", "email": "user@example.com" },
  "message": "User registered successfully. Please check email for verification."
}
```

---

### POST /api/auth/login
Login with email/password.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": { "id": "uuid", "email": "user@example.com", "created_at": "..." },
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

---

### POST /api/auth/oauth/:provider
Complete OAuth login (google | apple).

**Auth Required:** No

**Request Body:**
```json
{
  "id_token": "...",
  "nonce": "..."  // optional
}
```

**Response:**
```json
{
  "success": true,
  "provider": "google",
  "user": { "id": "uuid", "email": "..." },
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

---

### POST /api/auth/verify-email
Verify email with OTP token.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "token": "123456"
}
```

---

### POST /api/auth/forgot-password
Send password reset email.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

---

### POST /api/auth/reset-password
Reset password (requires auth).

**Auth Required:** Yes

**Request Body:**
```json
{
  "new_password": "newpassword123"
}
```

---

### GET /api/auth/me
Get current user profile.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "user": { "id": "uuid", "email": "...", "created_at": "...", "last_sign_in_at": "..." },
  "profile": { "full_name": "...", "avatar_url": "...", "timezone": "...", "locale": "...", "onboarded": false }
}
```

---

### PUT /api/auth/profile
Update user profile.

**Auth Required:** Yes

**Request Body:**
```json
{
  "full_name": "John Doe",     // optional
  "avatar_url": "https://...", // optional
  "timezone": "America/New_York", // optional
  "locale": "en"               // optional
}
```

---

### POST /api/auth/onboarded
Mark user as onboarded.

**Auth Required:** Yes

---

### POST /api/auth/logout
Logout user (invalidate session).

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Note:** For Supabase, logout is typically handled client-side. This endpoint can be used to clear server-side session if needed.

---

### DELETE /api/auth/account
Delete user account.

**Auth Required:** Yes

---

## Habits

### GET /api/habits
List user's habits.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "goal_text": "Stop doomscrolling",
      "status": "active",
      "started_at": "...",
      "created_at": "..."
    }
  ]
}
```

---

### GET /api/habits/:id
Get habit details.

**Auth Required:** Yes

---

### POST /api/habits
Create new habit.

**Auth Required:** Yes

**Request Body:**
```json
{
  "goal_text": "Stop doomscrolling on social media",
  "template_id": "uuid",  // optional
  "started_at": "2024-01-01T00:00:00Z"  // optional
}
```

---

### PUT /api/habits/:id
Update habit.

**Auth Required:** Yes

**Request Body:**
```json
{
  "goal_text": "Updated goal",  // optional
  "status": "active|paused|completed|archived",  // optional
  "started_at": "2024-01-01T00:00:00Z"  // optional
}
```

---

### DELETE /api/habits/:id
Delete habit.

**Auth Required:** Yes

---

### GET /api/habits/:id/triggers
Get habit triggers.

**Auth Required:** Yes

---

### POST /api/habits/:id/triggers
Add trigger to habit.

**Auth Required:** Yes

**Request Body:**
```json
{
  "trigger_id": "uuid"
}
```

---

### DELETE /api/habits/:id/triggers/:triggerId
Remove trigger from habit.

**Auth Required:** Yes

---

## Journeys

### GET /api/journeys
List user's journeys.

**Auth Required:** Yes

**Query Parameters:**
- `status` (optional): Filter by status (planned|active|paused|completed|cancelled)

---

### GET /api/journeys/:id
Get journey details with days.

**Auth Required:** Yes

---

### POST /api/journeys
Create journey from plan data. **Accepts both formats automatically.**

**Auth Required:** Yes

**Request Body (Standard Format):**
```json
{
  "user_habit_id": "uuid",
  "blueprint_id": "uuid",  // optional
  "plan_data": {
    "days": [
      {
        "day_number": 1,
        "theme": "Awareness",  // optional
        "tasks": [
          {
            "title": "Write down when the habit occurs",
            "kind": "action",  // optional
            "effort": 3,  // optional, 1-5
            "meta": {}  // optional
          }
        ],
        "prompts": ["How did this task make you feel?"]  // optional
      }
    ]
  },
  "start_date": "2024-01-01T00:00:00Z"  // optional
}
```

**Request Body (AI Format - auto-transformed):**
```json
{
  "user_habit_id": "uuid",
  "blueprint_id": "uuid",  // optional
  "plan_data": {
    "plan_summary": "This 21-day plan helps you...",  // optional
    "day_tasks": {
      "day_1": "Task for day 1",
      "day_2": "Task for day 2",
      "day_21": "Final task"
    },
    "day_whys": {  // optional
      "day_1": "Understanding triggers is the first step"
    }
  },
  "start_date": "2024-01-01T00:00:00Z"  // optional
}
```

**Note:** The endpoint auto-detects the format. If `day_tasks` is present, it transforms to `days` array automatically.

---

### PUT /api/journeys/:id
Update journey status.

**Auth Required:** Yes

**Request Body:**
```json
{
  "status": "planned|active|paused|completed|cancelled",  // optional
  "start_date": "2024-01-01T00:00:00Z"  // optional
}
```

---

### GET /api/journeys/:id/days
Get all journey days.

**Auth Required:** Yes

---

### GET /api/journeys/:id/days/:dayNumber
Get specific day with tasks.

**Auth Required:** Yes

---

### POST /api/journeys/:id/start
Start journey (sets status to active and start_date to now).

**Auth Required:** Yes

---

### POST /api/journeys/:id/pause
Pause journey.

**Auth Required:** Yes

---

### POST /api/journeys/:id/resume
Resume paused journey.

**Auth Required:** Yes

---

### POST /api/journeys/from-ai-plan
Create journey directly from AI plan format. Automatically transforms the AI's `day_tasks` object to the `days` array format.

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_habit_id": "uuid",
  "blueprint_id": "uuid",  // optional
  "ai_plan": {
    "plan_summary": "This 21-day plan helps you...",  // optional
    "day_tasks": {
      "day_1": "Write down when the habit occurs",
      "day_2": "Before each urge, pause 30 seconds",
      "day_3": "...",
      "day_21": "Review progress and choose one keystone rule"
    },
    "day_whys": {  // optional
      "day_1": "Understanding triggers is the first step",
      "day_2": "Creating pause breaks automatic responses"
    }
  },
  "start_date": "2024-01-01T00:00:00Z"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "user_habit_id": "uuid",
    "status": "planned",
    "planned_days": 21,
    "journey_days": [
      {
        "day_number": 1,
        "theme": "Awareness & Observation",
        "journey_tasks": [
          { "id": "uuid", "title": "Write down when the habit occurs", "kind": "daily_action" }
        ]
      }
    ]
  }
}
```

---

## Progress

### POST /api/progress/tasks/:taskId/complete
Mark task as completed.

**Auth Required:** Yes

---

### POST /api/progress/tasks/:taskId/uncomplete
Undo task completion.

**Auth Required:** Yes

---

### GET /api/progress/tasks
Get user's task progress.

**Auth Required:** Yes

**Query Parameters:**
- `journey_id` (optional): Filter by journey

---

### GET /api/progress/journeys/:journeyId
Get journey progress summary.

**Auth Required:** Yes

---

### POST /api/progress/reflections
Submit daily reflection.

**Auth Required:** Yes

**Request Body:**
```json
{
  "journey_day_id": "uuid",
  "content": "Today I felt...",  // optional
  "answers": {  // optional
    "mood": "good",
    "difficulty": 3
  }
}
```

---

### GET /api/progress/reflections/:journeyDayId
Get reflection for day.

**Auth Required:** Yes

---

### POST /api/progress/slips
Report slip event.

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_habit_id": "uuid",  // optional
  "happened_at": "2024-01-01T12:00:00Z",
  "context": {  // optional
    "trigger": "stress",
    "location": "home"
  }
}
```

---

### GET /api/progress/slips
Get slip history.

**Auth Required:** Yes

**Query Parameters:**
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

---

## Analytics

### GET /api/analytics/streaks
Get all streak types.

**Auth Required:** Yes

---

### GET /api/analytics/identity-score
Get identity score history.

**Auth Required:** Yes

**Query Parameters:**
- `days` (optional, default: 30)

---

### GET /api/analytics/consistency
Get consistency index.

**Auth Required:** Yes

**Query Parameters:**
- `time_window` (optional, default: "weekly")

---

### GET /api/analytics/adherence/:journeyId
Get adherence scores for journey.

**Auth Required:** Yes

---

### GET /api/analytics/insights
Get personalized insights.

**Auth Required:** Yes

**Query Parameters:**
- `limit` (optional, default: 10)

---

### GET /api/analytics/heatmap
Get trigger heatmap data.

**Auth Required:** Yes

**Query Parameters:**
- `days` (optional, default: 30)

---

### GET /api/analytics/daily-metrics
Get daily metrics.

**Auth Required:** Yes

**Query Parameters:**
- `days` (optional, default: 7)

---

### GET /api/analytics/export
Export user data.

**Auth Required:** Yes

**Query Parameters:**
- `format` (optional): "json" or "csv" (default: "json")

---

## AI Services

### GET /api/ai/health
Check AI service health.

**Auth Required:** No

---

### POST /api/ai/onboarding/start
Start onboarding (safety check + quiz generation).

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_input": "I doomscroll on social media before bed until 2am"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": null,
    "habit_description": "...",
    "safety": {
      "risk": "none",
      "action": "allow",
      "message": ""
    },
    "quiz_form": {
      "habit_name_guess": "doomscrolling",
      "questions": [
        {
          "id": "q1",
          "question": "How often do you engage in doomscrolling?",
          "helper_text": "Think about an average week.",
          "options": [
            { "id": "q1_a", "label": "Less than once a week" },
            { "id": "q1_b", "label": "1-3 times a week" },
            { "id": "q1_c", "label": "4-7 times a week" },
            { "id": "q1_d", "label": "Multiple times per day" }
          ]
        }
      ]
    }
  }
}
```

---

### POST /api/ai/canonicalize-habit
Classify/canonicalize a habit.

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_input": "I can't stop scrolling TikTok at night"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "habit_name": "TikTok scrolling",
    "habit_category": "social_media",
    "severity_guess": 0,
    "confidence": 0.9
  }
}
```

---

### POST /api/ai/safety
Run safety assessment.

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_input": "I want to stop smoking"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "risk": "none|self_harm|eating_disorder|severe_addiction|violence|other",
    "action": "allow|block_and_escalate",
    "message": ""
  }
}
```

---

### POST /api/ai/quiz-form
Generate quiz form.

**Auth Required:** Yes

**Request Body:**
```json
{
  "habit_category": "social_media",
  "user_context": "User struggles with late-night phone scrolling",  // optional
  "habit_description": "I doomscroll on social media before bed"  // optional, recommended
}
```

---

### POST /api/ai/quiz-summary
Get quiz summary (mechanistic profile).

**Auth Required:** Yes

**Request Body:**
```json
{
  "answers": {
    "q1": "q1_c",
    "q2": "q2_d",
    "q3": "q3_a"
  },
  "habit_category": "social_media",
  "habit_description": "I doomscroll on social media before bed",  // optional, recommended
  "quiz_form": { ... }  // optional, recommended - the quiz_form from onboarding
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_habit_raw": "...",
    "canonical_habit_name": "late-night doomscrolling",
    "habit_category": "social_media",
    "category_confidence": "high",
    "product_type": "TikTok",
    "severity_level": "moderate",
    "core_loop": "...",
    "primary_payoff": "...",
    "avoidance_target": "...",
    "identity_link": "...",
    "dopamine_profile": "relief",
    "collapse_condition": "...",
    "long_term_cost": "..."
  }
}
```

---

### POST /api/ai/plan-21d
Generate 21-day plan.

**Auth Required:** Yes

**Request Body:**
```json
{
  "habit_goal": "Stop doomscrolling on social media before bed",
  "quiz_summary": {
    "user_habit_raw": "...",
    "canonical_habit_name": "...",
    "habit_category": "social_media",
    ...
  },
  "user_context": "User wants to improve sleep quality"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan_summary": "This 21-day plan helps you reduce...",
    "day_tasks": {
      "day_1": "Write down when and why the habit occurs...",
      "day_2": "Before each urge, pause 30 seconds...",
      ...
      "day_21": "Review progress and choose one keystone rule."
    }
  }
}
```

**Note:** This returns `day_tasks` as an object. Use `POST /api/journeys/from-ai-plan` to automatically transform and create a journey.

---

### POST /api/ai/coach
AI coach chat.

**Auth Required:** Yes

**Request Body:**
```json
{
  "message": "I slipped yesterday and feel bad about it",
  "session_history": [  // optional
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "context": {  // optional
    "journey_day": 5,
    "current_streak": 3,
    "recent_slip": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coach_reply": "Slips are part of the process...",
    "chat_history": [...]
  }
}
```

---

### POST /api/ai/why-day
Get explanation for a specific day task.

**Auth Required:** Yes

**Request Body:**
```json
{
  "day_number": 5,
  "day_theme": "Building friction",
  "day_tasks": [
    { "title": "Disable notifications", "kind": "action" }
  ],
  "habit_goal": "Stop doomscrolling"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "day_number": 5,
    "explanation": "This task targets..."
  }
}
```

---

## AI Diagnostics Storage

These endpoints store AI-generated data (quiz forms, quiz summaries, safety assessments, 21-day plans) for later retrieval.

### POST /api/ai-diagnostics/quiz-form
Store quiz form data.

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_habit_id": "uuid",  // optional
  "raw_input": "I doomscroll on social media before bed",
  "quiz_form": {
    "habit_name_guess": "doomscrolling",
    "questions": [
      {
        "id": "q1",
        "question": "How often do you engage in doomscrolling?",
        "helper_text": "Think about an average week.",
        "options": [
          { "id": "q1_a", "label": "Less than once a week" },
          { "id": "q1_b", "label": "1-3 times a week" }
        ]
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "user_habit_id": "uuid",
    "raw_input": "...",
    "model": "gpt-4o",
    "parsed_summary": "{...}",
    "created_at": "..."
  }
}
```

---

### POST /api/ai-diagnostics/quiz-summary
Store quiz summary (mechanistic profile) data.

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_habit_id": "uuid",  // optional
  "raw_input": "I doomscroll on social media before bed",
  "quiz_summary": {
    "user_habit_raw": "...",
    "canonical_habit_name": "late-night doomscrolling",
    "habit_category": "social_media",
    "category_confidence": "high",
    "product_type": "TikTok",
    "severity_level": "moderate",
    "core_loop": "...",
    "primary_payoff": "...",
    "avoidance_target": "...",
    "identity_link": "...",
    "dopamine_profile": "relief",
    "collapse_condition": "...",
    "long_term_cost": "..."
  },
  "user_answers": {  // optional
    "q1": "q1_c",
    "q2": "q2_d"
  }
}
```

---

### POST /api/ai-diagnostics/safety
Store safety assessment data.

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_habit_id": "uuid",  // optional
  "raw_input": "I want to stop smoking",
  "safety": {
    "risk": "none",
    "action": "allow",
    "message": ""
  }
}
```

---

### POST /api/ai-diagnostics/plan-21d
Store 21-day plan data.

**Auth Required:** Yes

**Request Body:**
```json
{
  "user_habit_id": "uuid",  // optional
  "raw_input": "Stop doomscrolling on social media before bed",
  "plan": {
    "plan_summary": "This 21-day plan helps you reduce...",
    "day_tasks": {
      "day_1": "Write down when and why the habit occurs...",
      "day_2": "Before each urge, pause 30 seconds...",
      "day_21": "Review progress and choose one keystone rule."
    },
    "day_whys": {  // optional
      "day_1": "Understanding triggers is the first step..."
    }
  }
}
```

---

### GET /api/ai-diagnostics
Get user's AI diagnostics.

**Auth Required:** Yes

**Query Parameters:**
- `user_habit_id` (optional): Filter by habit
- `type` (optional): Filter by type (quiz_form|quiz_summary|safety_assessment|plan_21d)
- `limit` (optional, default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "user_habit_id": "uuid",
      "raw_input": "...",
      "model": "gpt-4o",
      "parsed_summary": "{\"type\":\"quiz_form\",\"data\":{...}}",
      "scores": {...},
      "created_at": "..."
    }
  ]
}
```

---

### GET /api/ai-diagnostics/:id
Get specific diagnostic by ID.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "raw_input": "...",
    "parsed_summary": "{...}",
    "parsed_data": {
      "type": "quiz_summary",
      "data": {...}
    }
  }
}
```

---

### GET /api/ai-diagnostics/habit/:habitId/latest/:type
Get the latest diagnostic of a specific type for a habit.

**Auth Required:** Yes

**Path Parameters:**
- `habitId`: The habit UUID
- `type`: One of quiz_form|quiz_summary|safety_assessment|plan_21d

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "user_habit_id": "uuid",
    "raw_input": "...",
    "parsed_data": {...}
  }
}
```

---

## Coach

### GET /api/coach/sessions
List coach sessions.

**Auth Required:** Yes

**Query Parameters:**
- `limit` (optional, default: 20)

---

### POST /api/coach/sessions
Start new coach session.

**Auth Required:** Yes

---

### GET /api/coach/sessions/:id
Get session with messages.

**Auth Required:** Yes

---

### POST /api/coach/sessions/:id/messages
Send message to coach.

**Auth Required:** Yes

**Request Body:**
```json
{
  "message": "I'm struggling today",
  "context": {  // optional
    "journey_day": 5,
    "current_streak": 3,
    "recent_slip": false
  }
}
```

---

### POST /api/coach/sessions/:id/end
End coach session.

**Auth Required:** Yes

---

## Notifications

### GET /api/notifications
Get notification feed (unified feed from nudge deliveries and buddy nudges).

**Auth Required:** Yes

**Query Parameters:**
- `status` (optional): Filter by status (`read` | `unread`)
- `type` (optional): Filter by notification type (e.g., `reminder`, `daily_motivation`, `daily_completion`, `badge_progress`, `buddy_nudge`)
- `limit` (optional, default: 50): Maximum number of notifications to return
- `offset` (optional, default: 0): Number of notifications to skip

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "reminder",
      "title": "Daily Reminder",
      "message": "Time for today's habit",
      "created_at": "2024-01-17T10:00:00Z",
      "is_read": false,
      "icon_name": "clock",
      "action_data": {
        "journey_id": "uuid",
        "task_id": "uuid"
      },
      "related_entity_id": "uuid"
    }
  ]
}
```

**Notification Types:**
- `reminder`: Standard task reminder
- `daily_motivation`: Streak at risk or motivation message
- `daily_completion`: Task completion notification
- `badge_progress`: Badge progress update
- `buddy_nudge`: Nudge received from a buddy

---

### POST /api/notifications/mark-all-read
Mark all notifications as read.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "message": "Marked 5 notifications as read"
}
```

---

### POST /api/notifications/:id/read
Mark a specific notification as read.

**Auth Required:** Yes

**Path Parameters:**
- `id`: Notification ID (UUID format)

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

**Error Responses:**
- `400`: Invalid notification ID format
- `404`: Notification not found

---

### DELETE /api/notifications/:id
Delete a notification.

**Auth Required:** Yes

**Path Parameters:**
- `id`: Notification ID (UUID format)

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

**Error Responses:**
- `400`: Invalid notification ID format
- `404`: Notification not found

---

### GET /api/notifications/preferences
Get notification preferences.

**Auth Required:** Yes

---

### PUT /api/notifications/preferences
Update preferences.

**Auth Required:** Yes

**Request Body:**
```json
{
  "enabled": true,  // optional
  "max_per_day": 5,  // optional, 0-20
  "escalate_to_buddy": false  // optional
}
```

---

### GET /api/notifications/scheduled
Get scheduled nudges.

**Auth Required:** Yes

**Query Parameters:**
- `limit` (optional, default: 20)

---

### POST /api/notifications/prime-time
Set prime time windows.

**Auth Required:** Yes

**Request Body:**
```json
{
  "windows": [
    {
      "dow": 1,  // 0-6, 0=Sunday
      "start_minute": 540,  // 9:00 AM (9*60)
      "end_minute": 1080  // 6:00 PM (18*60)
    }
  ]
}
```

---

### GET /api/notifications/prime-time
Get prime time windows.

**Auth Required:** Yes

---

### POST /api/notifications/quiet-hours
Set quiet hours.

**Auth Required:** Yes

**Request Body:**
```json
{
  "start_minute": 1320,  // 10:00 PM (22*60)
  "end_minute": 420  // 7:00 AM (7*60)
}
```

---

### GET /api/notifications/quiet-hours
Get quiet hours.

**Auth Required:** Yes

---

### GET /api/notifications/history
Get notification delivery history.

**Auth Required:** Yes

**Query Parameters:**
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

---

## Rewards

### GET /api/rewards/points
Get point balance.

**Auth Required:** Yes

---

### GET /api/rewards/points/history
Get points ledger.

**Auth Required:** Yes

**Query Parameters:**
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

---

### GET /api/rewards/badges
Get earned badges.

**Auth Required:** Yes

---

### GET /api/rewards/badges/available
Get all badges (earned and unearned).

**Auth Required:** Yes

---

### GET /api/rewards/available
Get available rewards.

**Auth Required:** Yes

---

### GET /api/rewards/earned
Get earned rewards.

**Auth Required:** Yes

---

## Settings

### GET /api/settings/privacy
Get privacy settings.

**Auth Required:** Yes

---

### PUT /api/settings/privacy
Update privacy settings.

**Auth Required:** Yes

**Request Body:**
```json
{
  "share_with_buddy": true,  // optional
  "allow_research": false  // optional
}
```

---

### GET /api/settings/share
Get share preferences.

**Auth Required:** Yes

---

### PUT /api/settings/share
Update share preferences.

**Auth Required:** Yes

**Request Body:**
```json
{
  "share_metrics": true,  // optional
  "share_streaks": true  // optional
}
```

---

### GET /api/settings/devices
Get registered devices.

**Auth Required:** Yes

---

### POST /api/settings/devices
Register device for push notifications.

**Auth Required:** Yes

**Request Body:**
```json
{
  "platform": "ios|android",
  "push_token": "...",  // optional
  "app_version": "1.0.0"  // optional
}
```

**Note:** `platform` must be `"ios"` or `"android"`. `"web"` is not supported by the database constraint.

---

### DELETE /api/settings/devices/:id
Unregister device.

**Auth Required:** Yes

---

### POST /api/settings/export-request
Request data export.

**Auth Required:** Yes

---

### POST /api/settings/delete-request
Request account deletion.

**Auth Required:** Yes

---

## Buddies

### GET /api/buddies
List buddies with enhanced status information.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "buddy_link_id": "uuid",
      "buddy_user_id": "uuid",
      "buddy_email": "buddy@example.com",
      "buddy_name": "John Doe",
      "buddy_avatar": "https://...",
      "status": "active",
      "started_at": "2024-01-01T00:00:00Z",
      "streak_days": 15,
      "daily_status": "COMPLETED"
    }
  ]
}
```

**Daily Status Values:**
- `COMPLETED`: Buddy completed all tasks today
- `PENDING`: Buddy has tasks for today but hasn't completed them yet
- `MISSED`: Buddy missed today's tasks (past end of day)

**Enhanced Fields:**
- `streak_days`: Current streak length for task completion
- `daily_status`: Today's completion status (COMPLETED, PENDING, or MISSED)

---

### GET /api/buddies/:id/profile
Get buddy profile with enhanced progress information.

**Auth Required:** Yes

**Path Parameters:**
- `id`: Buddy link ID (UUID format)

**Response:**
```json
{
  "success": true,
  "data": {
    "buddy_user_id": "uuid",
    "buddy_name": "John Doe",
    "buddy_avatar": "https://...",
    "level": 5,
    "xp": 450,
    "xp_for_current_level": 400,
    "xp_for_next_level": 500,
    "streak": {
      "current_length": 15,
      "best_length": 20,
      "is_frozen": false,
      "weekly_completion": {
        "monday": true,
        "tuesday": true,
        "wednesday": false,
        "thursday": true,
        "friday": true,
        "saturday": true,
        "sunday": false
      }
    },
    "habit_health": 85,
    "current_day": 12,
    "total_days": 21,
    "completed_today": true,
    "recent_checkins": [
      {
        "id": "uuid",
        "checkin_date": "2024-01-17",
        "note": "Feeling good today!"
      }
    ],
    "member_since": "2024-01-01T00:00:00Z"
  }
}
```

**Enhanced Fields:**
- `level`: Calculated from total XP (Level formula: Each level requires level * 100 XP)
- `xp`: Total XP earned
- `xp_for_current_level`: XP required for current level
- `xp_for_next_level`: XP required for next level
- `habit_health`: Percentage of tasks completed (0-100)
- `streak.weekly_completion`: Boolean status for each day of the week (Mon-Sun)
- `member_since`: When the buddy link was created

**Error Responses:**
- `400`: Invalid buddy link ID format
- `404`: Buddy not found or not linked

---

### POST /api/buddies/invite
Create invite link.

**Auth Required:** Yes

**Request Body:**
```json
{
  "target_contact": "friend@example.com",  // optional
  "expires_in_days": 7  // optional, 1-30, default: 7
}
```

---

### GET /api/buddies/invites
List sent invites.

**Auth Required:** Yes

---

### POST /api/buddies/accept/:inviteCode
Accept invite.

**Auth Required:** Yes

---

### POST /api/buddies/checkin
Submit daily check-in.

**Auth Required:** Yes

**Request Body:**
```json
{
  "buddy_link_id": "uuid",
  "note": "Feeling good today!"  // optional, max 500 chars
}
```

---

### GET /api/buddies/checkins
Get buddy check-ins.

**Auth Required:** Yes

**Query Parameters:**
- `buddy_link_id` (optional)
- `limit` (optional, default: 30)

---

### POST /api/buddies/messages
Send message to buddy.

**Auth Required:** Yes

**Request Body:**
```json
{
  "buddy_link_id": "uuid",
  "content": "How are you doing?"
}
```

---

### GET /api/buddies/messages
Get messages.

**Auth Required:** Yes

**Query Parameters:**
- `buddy_link_id` (required)
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

---

### POST /api/buddies/reactions
Add reaction to check-in.

**Auth Required:** Yes

**Request Body:**
```json
{
  "buddy_checkin_id": "uuid",
  "emoji": "👍"
}
```

---

### GET /api/buddies/summary
Get weekly summary.

**Auth Required:** Yes

---

### DELETE /api/buddies/:id
Remove buddy link.

**Auth Required:** Yes

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Optional additional details"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `500` - Internal Server Error
- `502` - Bad Gateway (AI service unavailable)

