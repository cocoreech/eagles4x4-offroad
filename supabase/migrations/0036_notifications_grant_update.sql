-- 0036 — Grant UPDATE on notifications to authenticated (fix mark-as-read)
--
-- Migration 0022 added the `notifications_update_own` RLS policy so a customer
-- could mark their own notifications read, but never granted the table-level
-- UPDATE privilege to the `authenticated` role. Postgres checks the GRANT
-- before RLS, so every mark-as-read failed with "permission denied for table
-- notifications" — the bell badge cleared optimistically client-side but the
-- write never landed, so it reappeared on the next page load.
--
-- The existing notifications_update_own policy still scopes the UPDATE to each
-- user's own rows (user_id = auth.uid()), so this grant is safe: it only lets a
-- customer flip is_read on notifications they already own. INSERT/DELETE remain
-- ungranted (rows are created only by the service-role client).

grant update on public.notifications to authenticated;
