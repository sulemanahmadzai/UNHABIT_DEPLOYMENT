# Push notifications — backend implementation & frontend integration

This document describes how push notifications are implemented in the UnHabit backend, which **HTTP APIs** the React Native (iOS + Android) app should use for **registration and preferences**, and how each **notification scenario** is triggered (API vs scheduled job vs internal service). Base path for all routes: **`/api`** (e.g. `https://your-host/api/...`).

**Auth:** Endpoints marked *Authenticated* require a Supabase JWT: `Authorization: Bearer <access_token>`.

---

## 1. Architecture overview

| Layer | Responsibility |
|--------|----------------|
| **Expo Push** | Delivery uses `expo-server-sdk` (`push-notifications.service.ts`). Tokens must be valid **Expo push tokens** from the device. |
| **Scenarios** | `notification-scenarios.service.ts` defines one function per scenario; each send goes through governance + templates + `sendPushToUser`. |
| **Governance** | `notification-governance.service.ts`: per-user **intensity** (daily cap), **quiet hours**, **category toggles**, **promotional opt-in**, frequency logging (`notification_daily_log`). |
| **Templates** | `notification-templates.service.ts`: **privacy-safe** copy by default; detailed habit text only if `show_habit_details_lockscreen` is enabled (Apple guideline–friendly). |
| **Categories** | `notification-categories.service.ts`: nine logical categories; each maps to an **Android channel id** (`unhabit_*`) for `expo-notifications` channel setup. |
| **Scheduling** | `cron.service.ts`: timezone-aware ticks (user `profiles.timezone` + `notification_settings`). `notification-cron.service.ts`: separate legacy nudges/receipts. |

**Important for frontend:** There is **no** public “send scenario X” REST endpoint for each push. Pushes are fired when the user performs actions (progress, buddies, coach, etc.) or when the **server cron** runs. The frontend integrates by (1) **registering the device token**, (2) **syncing preferences** via the notification settings APIs, and (3) **handling incoming payloads** (`data.kind`, `data.screen`, etc.).

---

## 2. Push payload shape (Expo / React Native)

Each push is built with `data` similar to:

| Field | Purpose |
|--------|---------|
| `kind` | Scenario identifier — same as **Scenario key** in the matrix below (e.g. `daily_checkin_ready`, `xp_earned`). Use for analytics and routing. |
| `category` | One of the nine category ids (e.g. `daily_reminders`, `rewards_xp`). |
| `channelId` | Android: maps to your notification channel id (e.g. `unhabit_daily_reminders`). Omit or ignore on iOS if not used. |
| `screen` | Suggested screen name for deep linking (e.g. `JourneyToday`, `Notifications`). |
| `params` | JSON **string** (not an object) for navigation params, often `"{}"`. Parse with `JSON.parse` on the client. |

The Expo message may also set `categoryId` (passed through to Expo) for iOS notification categories when applicable.

---

## 3. Device registration (required for any push)

The backend loads tokens from the **`devices`** table. Register/update the Expo token after login.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/settings/devices` | Yes | List devices |
| `POST` | `/api/settings/devices` | Yes | Body: `{ "platform": "ios" \| "android", "push_token": "<ExponentPushToken[...]>" }` (see `settings` route for exact schema) |
| `DELETE` | `/api/settings/devices/:id` | Yes | Remove a device |

**Test:** `POST /api/notifications/test-push` — optional title/body; sends a test push to all registered tokens for the user.

---

## 4. Notification preferences & governance (frontend must call on startup / settings)

These endpoints control toggles, caps, and copy behavior. Align with **Android channels** using `GET /notifications/categories`.

### 4.1 Categories (Android channels + in-app toggles)

| Method | Endpoint | Auth | Body / notes |
|--------|----------|------|----------------|
| `GET` | `/api/notifications/categories` | Yes | Returns `categories` (per-category `enabled`) and `android_channels` (use to create channels on Android). |
| `PUT` | `/api/notifications/categories/:category` | Yes | `{ "enabled": boolean }`. `account_billing` cannot be disabled. |
| `PUT` | `/api/notifications/categories` | Yes | Bulk: `{ "categories": [ { "category": "...", "enabled": true }, ... ] }` |

**Category ids:** `daily_reminders`, `streak_protection`, `coach_nudge`, `buddy_social`, `rewards_xp`, `weekly_review`, `account_billing`, `product_updates`, `promotions`.

### 4.2 Enhanced settings (intensity, privacy, marketing)

| Method | Endpoint | Auth | Body (all optional unless noted) |
|--------|----------|------|-----------------------------------|
| `GET` | `/api/notifications/settings` | Yes | — |
| `PUT` | `/api/notifications/settings` | Yes | `intensity`: `light` \| `standard` \| `high_support` (maps to daily caps 1 / 2 / 3 for governed pushes). `show_habit_details_lockscreen`, `promotional_opt_in`, `weekend_support`, `high_risk_reminders`, `morning_checkin_minute`, `evening_lastcall_minute` (0–1439). |

### 4.3 Governance snapshot

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/notifications/governance` | Yes | Returns intensity, `daily_cap`, `sent_today`, `remaining_today`. |

### 4.4 Legacy & scheduling helpers (existing APIs)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` / `PUT` | `/api/notifications/preferences` | Yes | Legacy nudge prefs |
| `GET` | `/api/notifications/scheduled` | Yes | Scheduled nudges |
| `POST` / `GET` | `/api/notifications/prime-time` | Yes | Prime-time windows |
| `POST` / `GET` | `/api/notifications/quiet-hours` | Yes | Quiet hours (also used by older cron gate) |
| `GET` | `/api/notifications/history` | Yes | Delivery history |
| `GET` | `/api/notifications` | Yes | In-app notification feed |
| `POST` | `/api/notifications/mark-all-read` | Yes | — |
| `POST` | `/api/notifications/:id/read` | Yes | — |
| `DELETE` | `/api/notifications/:id` | Yes | — |
| `POST` | `/api/notifications/reminders` | Yes | Task reminders (`journey_task_id`, `remind_at`) |

---

## 5. Scenario matrix: trigger → endpoint / job

**Legend**

- **HTTP** — call this API as the user; the backend may enqueue a push asynchronously.
- **Cron** — server-side scheduler (`cron.service.ts`); no frontend call.
- **Service** — internal (e.g. badge engine); not a dedicated REST route.
- **Not wired** — scenario function exists; integrate later (e.g. webhook or admin).

| # | Scenario key (`data.kind`) | Category | How it is triggered |
|---|----------------------------|----------|----------------------|
| 1 | `daily_checkin_ready` | `daily_reminders` | **Cron** — timezone-aware morning window (`notification_settings.morning_checkin_minute`). |
| 2 | `task_reminder` | `daily_reminders` | **Cron** — ~1h after morning minute if day not complete. |
| 3 | `midday_rescue` | `daily_reminders` | **Cron** — ~local midday. |
| 4 | `evening_last_call` | `daily_reminders` | **Cron** — `evening_lastcall_minute`. |
| 5 | `completion_reinforcement` | `daily_reminders` | **HTTP** `POST /api/progress/complete-day` (async). |
| 6 | `micro_streak` | `daily_reminders` | **HTTP** `POST /api/progress/tasks/:taskId/complete` when streak length is 2–6 (not 7/14/21). |
| 7 | `day_reset_clean_slate` | `daily_reminders` | **Cron** — missed-day recovery batch. |
| 8 | `open_app_nudge` | `daily_reminders` | **Cron** — paired with midday flow. |
| 9 | `habit_health_change` | `daily_reminders` | **HTTP** `POST /api/progress/complete-day`. |
| 10 | `calendar_plan_prompt` | `weekly_review` | **Cron** — daily 06:00 UTC batch (eligible users). |
| 11 | `streak_at_risk` | `streak_protection` | **Cron** — streak-at-risk processor (every 5 min). |
| 12 | `missed_day_recovery` | `streak_protection` | **Cron** — missed-day recovery. |
| 13 | `two_miss_risk` | `streak_protection` | **Cron** — two-miss risk batch. |
| 14 | `relapse_logged` | `streak_protection` | **HTTP** `POST /api/progress/slips`. |
| 15 | `high_risk_window` | `streak_protection` | **Cron** — evening window. |
| 16 | `weekend_support` | `daily_reminders` | **Cron** — weekend + `weekend_support` setting. |
| 17 | `streak_freeze_offered` | `streak_protection` | **Cron** — daily 06:00 UTC (eligible streaks, no tokens). |
| 18 | `streak_freeze_used` | `streak_protection` | **HTTP** `POST /api/streaks/freeze`. |
| 19 | `streak_milestone` | `rewards_xp` | **HTTP** `POST /api/progress/tasks/:taskId/complete` or `POST /api/progress/complete-day` at 7/14/21 days. |
| 20 | `post_21_maintenance` | `weekly_review` | **HTTP** `POST /api/progress/complete-day` when 21-day journey completes. |
| 21 | `coach_reply` | `coach_nudge` | **HTTP** `POST /api/coach/sessions/:id/messages` after successful AI reply. |
| 22 | `coach_daily_checkin` | `coach_nudge` | **Cron** — every 5 min (coach daily check-in batch). |
| 23 | `coach_stuck_detection` | `coach_nudge` | **Cron** — every 5 min. |
| 24 | `coach_phase_transition` | `coach_nudge` | **Cron** — daily 06:00 UTC (phase transition batch). |
| 25 | `coach_skill_suggestion` | `coach_nudge` | **HTTP** `POST /api/progress/slips`. |
| 26 | `coach_reflection_prompt` | `coach_nudge` | **Cron** — every 5 min. |
| 27 | `buddy_invite_received` | `buddy_social` | **Not wired** to an HTTP route (function exists for future server-side invite flow). |
| 28 | `buddy_invite_accepted` | `buddy_social` | **HTTP** `POST /api/buddies/accept/:inviteCode`. |
| 29 | `buddy_completed_today` | `buddy_social` | **HTTP** `POST /api/progress/complete-day` (notifies linked buddies). |
| 30 | `buddy_streak_milestone` | `buddy_social` | **HTTP** `POST /api/progress/complete-day` at buddy milestone days. |
| 31 | `nudge_your_buddy` | `buddy_social` | **Cron** — buddy nudge prompts. |
| 32 | `leaderboard_weekly_start` | `weekly_review` | **Cron** — Monday 09:00 UTC. |
| 33 | `leaderboard_rank_change` | `weekly_review` | **Cron** — Sunday 18:00 UTC. |
| 34 | `buddy_inactivity` | `buddy_social` | **Cron** — daily 06:00 UTC. |
| 35 | `xp_earned` | `rewards_xp` | **HTTP** `POST /api/progress/tasks/:taskId/complete` (may suppress small XP). |
| 36 | `level_up` | `rewards_xp` | **HTTP** `POST /api/progress/tasks/:taskId/complete` when level increases. |
| 37 | `badge_unlocked` | `rewards_xp` | **Service** — `badge-awarding.service.ts` on task completion / badge rules. |
| 38 | `next_badge_progress` | `rewards_xp` | **Cron** — daily 06:00 UTC. |
| 39 | `weekly_reward_summary` | `rewards_xp` | **Cron** — Sunday 18:00 UTC. |
| 40 | `share_prompt` | `rewards_xp` | **HTTP** `POST /api/progress/tasks/:taskId/complete` at 7/14/21 streak. |
| 41 | `trial_started` | `account_billing` | **HTTP** `POST /api/stripe/create-checkout-session` (after session created). |
| 42 | `trial_ending_soon` | `account_billing` | **Cron** — daily 06:00 UTC (subscription/trial queries). |
| 43 | `subscription_renewed` | `account_billing` | **Not wired** in Express — call from **Stripe webhook** (e.g. Supabase Edge Function) using the same scenario function or a secure internal API. |
| 44 | `billing_failure` | `account_billing` | **Not wired** in Express — same as above. |
| 45 | `plan_expiration` | `account_billing` | **Cron** — daily 06:00 UTC. |
| 46 | `promotional_offer` | `promotions` | **Not wired** to cron — intended for **manual / marketing** or future admin endpoint; requires category + `promotional_opt_in`. |

---

## 6. HTTP routes that indirectly cause pushes (quick reference)

| Endpoint | Scenarios (typical) |
|----------|---------------------|
| `POST /api/progress/tasks/:taskId/complete` | `xp_earned`, `level_up`, `streak_milestone`, `share_prompt`, `micro_streak`, `badge_unlocked` (via badges) |
| `POST /api/progress/complete-day` | `completion_reinforcement`, `habit_health_change`, `streak_milestone`, `post_21_maintenance`, `buddy_completed_today`, `buddy_streak_milestone` |
| `POST /api/progress/slips` | `relapse_logged`, `coach_skill_suggestion` |
| `POST /api/streaks/freeze` | `streak_freeze_used` |
| `POST /api/buddies/accept/:inviteCode` | `buddy_invite_accepted` |
| `POST /api/coach/sessions/:id/messages` | `coach_reply` |
| `POST /api/stripe/create-checkout-session` | `trial_started` |

---

## 7. Cron schedule (server operator / PM reference)

All times below are **server cron expressions** in `cron.service.ts` (timezone **UTC** for the cron tick; per-user delivery uses **profile timezone** where applicable).

| Schedule | Jobs |
|----------|------|
| Every 5 minutes | Timezone-aware: morning check-in, task reminder, midday, evening, high-risk, weekend support; streak at risk; missed day + clean slate; two-miss risk; coach daily check-in, reflection, stuck detection; buddy nudge prompts |
| Monday 09:00 UTC | Leaderboard weekly start |
| Sunday 18:00 UTC | Weekly reward summary, leaderboard rank change |
| Daily 06:00 UTC | Trial ending soon, plan expiration, buddy inactivity, phase transition, next badge progress, calendar plan prompt, streak freeze offered |

Disable cron globally if needed: `NOTIFICATION_CRON_DISABLED` (see `server.ts` / env docs).

---

## 8. Database tables (migrations)

- `notification_category_prefs` — per-user category toggles  
- `notification_settings` — intensity, lockscreen detail flag, promotional opt-in, timing minutes  
- `notification_daily_log` — rows per sent notification for frequency caps  

Apply migrations in your environment before relying on governance endpoints.

---

## 9. Testing

From the backend package:

```bash
npm run test:push
```

Runs integration checks against a live API (requires env + DB). See `tests/test-push-notifications.ts`.

---

## 10. Frontend checklist

1. Obtain Expo push token (`expo-notifications`) and `POST /api/settings/devices` with platform `ios` or `android`.  
2. On launch / settings: `GET /api/notifications/categories` → create **Android notification channels** from `android_channels`.  
3. Sync `GET`/`PUT /api/notifications/settings` with your UI (intensity, lock screen detail, promotional opt-in).  
4. Handle notification response: read `data.kind`, `data.screen`, `data.params` (parse JSON string), `data.channelId`.  
5. Do not expect a separate REST endpoint per push scenario — behavior is tied to **user actions** and **server cron** as in section 5.

---

*Document generated for UnHabit backend; aligns with `notification-scenarios.service.ts`, `notifications.ts`, `progress.ts`, `buddies.ts`, `coach.ts`, `streaks.ts`, `stripe.ts`, and `cron.service.ts`.*
