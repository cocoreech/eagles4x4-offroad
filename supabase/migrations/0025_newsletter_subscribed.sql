-- Reconstructed from applied DB state (2026-07-11) — file was not saved when originally applied via MCP.
alter table public.profiles
  add column if not exists newsletter_subscribed boolean not null default true;
