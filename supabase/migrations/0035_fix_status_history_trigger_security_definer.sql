-- Fix: logged-in customer bookings failed because the status-history trigger
-- ran as the invoking user (SECURITY INVOKER). booking_status_history's INSERT
-- RLS is admin-only, so a customer's booking insert fired the trigger under
-- their role, the history write was rejected, and the whole booking rolled back
-- ("Could not create the booking"). Guests were unaffected — they write via the
-- service-role client, bypassing RLS.
--
-- Make the logging function SECURITY DEFINER so the internal history write runs
-- with the owner's privileges regardless of who created the booking. It writes
-- to a DIFFERENT table (booking_status_history), not bookings, so there is no
-- RLS recursion risk. search_path is locked and all names are schema-qualified.

create or replace function public.log_booking_status_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.booking_status_history (booking_id, status, title)
    values (new.id, new.status, 'Booking created · ' || new.status);
  elsif (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into public.booking_status_history (booking_id, status, title)
    values (new.id, new.status, 'Status changed to ' || new.status);
  end if;
  return new;
end;
$$;
