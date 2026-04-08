-- Push Notification Scenarios: notification_category_prefs, notification_settings, notification_daily_log

CREATE TABLE IF NOT EXISTS public.notification_category_prefs (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(user_id, category)
);
CREATE INDEX IF NOT EXISTS idx_notif_cat_prefs_user ON public.notification_category_prefs(user_id);

CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  intensity                     TEXT NOT NULL DEFAULT 'standard',
  show_habit_details_lockscreen BOOLEAN NOT NULL DEFAULT FALSE,
  promotional_opt_in            BOOLEAN NOT NULL DEFAULT FALSE,
  weekend_support               BOOLEAN NOT NULL DEFAULT FALSE,
  high_risk_reminders           BOOLEAN NOT NULL DEFAULT FALSE,
  morning_checkin_minute        INT NOT NULL DEFAULT 480,
  evening_lastcall_minute       INT NOT NULL DEFAULT 1260,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_intensity CHECK (intensity IN ('light', 'standard', 'high_support'))
);

CREATE TABLE IF NOT EXISTS public.notification_daily_log (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  kind     TEXT NOT NULL,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_daily_log_user_time ON public.notification_daily_log(user_id, sent_at);

ALTER TABLE public.notification_category_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_daily_log ENABLE ROW LEVEL SECURITY;
