-- Reconstructed from applied DB state (2026-07-11) — file was not saved when originally applied via MCP.
alter table public.bookings
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
