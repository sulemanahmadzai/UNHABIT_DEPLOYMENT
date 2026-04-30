-- Performance indexes for hot query paths
-- Addresses the following slow queries identified in production profiling:
--   1. user_task_progress filtered by (user_id, status, completed_at) — dashboard, badge gallery, buddy completions
--   2. buddy_links filtered by (user_a|user_b, status) — all buddy queries
--
-- NOTE:
-- Supabase SQL Editor executes inside a transaction block, so
-- "CREATE INDEX CONCURRENTLY" fails there with:
--   ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
--
-- This file intentionally uses non-concurrent CREATE INDEX so it can run in
-- Supabase SQL Editor directly. For production zero-downtime, run the same
-- statements with CONCURRENTLY using psql or a migration runner that does not
-- wrap the whole script in one transaction.

-- Composite index: user_task_progress (user_id, status, completed_at)
-- Covers:  WHERE user_id = $1 AND status = 'completed' AND completed_at >= $today
CREATE INDEX IF NOT EXISTS idx_taskprog_user_status_completed
  ON public.user_task_progress (user_id, status, completed_at);

-- Partial index variant for completed-only scans (smaller, faster for count queries)
CREATE INDEX IF NOT EXISTS idx_taskprog_status_completed
  ON public.user_task_progress (status, completed_at);

-- buddy_links: queries always filter on (user_a OR user_b) AND status = 'active'
-- Two partial indexes cover both sides of the OR efficiently.
CREATE INDEX IF NOT EXISTS idx_buddylinks_user_a_status
  ON public.buddy_links (user_a, status);

CREATE INDEX IF NOT EXISTS idx_buddylinks_user_b_status
  ON public.buddy_links (user_b, status);
