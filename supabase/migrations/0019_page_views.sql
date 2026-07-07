-- ============================================================
-- 0019 — Page-view analytics (privacy-safe visitor counter)
-- ============================================================
-- Powers the Traffic tiles on /admin. Records one row per page view.
-- Privacy: we NEVER store IPs or user-agents. `visitor_hash` is a
-- daily-rotating SHA-256 of (ip + ua + date + server secret) computed in
-- the /api/track route — non-reversible and uncorrelatable across days.

create table if not exists public.page_views (
  id           uuid primary key default gen_random_uuid(),
  path         text not null,
  visitor_hash text not null,
  created_at   timestamptz not null default now()
);

create index if not exists page_views_created_at_idx
  on public.page_views (created_at desc);
create index if not exists page_views_visitor_created_idx
  on public.page_views (visitor_hash, created_at desc);

alter table public.page_views enable row level security;

-- Inserts happen via the service-role client (bypasses RLS) in /api/track.
-- Reads happen through get_traffic_stats() below. Admins may also read rows
-- directly if we ever build a detailed view.
drop policy if exists "admins read page_views" on public.page_views;
create policy "admins read page_views" on public.page_views
  for select using (public.is_admin());

-- ------------------------------------------------------------
-- Aggregated stats for the admin dashboard.
-- SECURITY DEFINER so it can count across all rows regardless of RLS,
-- but guarded: only admins may call it. Day boundaries use Manila time
-- so "today" matches the shop's local day.
-- ------------------------------------------------------------
create or replace function public.get_traffic_stats()
returns json
language plpgsql
stable security definer set search_path = ''
as $$
declare
  result     json;
  day_start  timestamptz := date_trunc('day', (now() at time zone 'Asia/Manila')) at time zone 'Asia/Manila';
  week_start timestamptz := now() - interval '7 days';
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'pageviews_today', count(*) filter (where created_at >= day_start),
    'pageviews_7d',    count(*) filter (where created_at >= week_start),
    'pageviews_total', count(*),
    'visitors_today',  count(distinct visitor_hash) filter (where created_at >= day_start),
    'visitors_7d',     count(distinct visitor_hash) filter (where created_at >= week_start),
    'visitors_total',  count(distinct visitor_hash)
  ) into result
  from public.page_views;

  return result;
end;
$$;

-- Signed-in only. Revoke the default PUBLIC grant so anon can't reach the
-- RPC endpoint at all (it's admin-guarded internally regardless).
revoke execute on function public.get_traffic_stats() from public, anon;
grant execute on function public.get_traffic_stats() to authenticated;
