-- Phase 4.6.8 — service_role grants for structured lineup tables.
-- Required for import publish, ops repair scripts, and backend dual-write.

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'service_role does not exist — cannot apply structured lineup grants';
  end if;
end;
$$;

grant select, insert, update, delete on table public.event_lineup_entries to service_role;
grant select, insert, update, delete on table public.event_lineup_entry_artists to service_role;

-- Published read path for API roles (tables created after default privilege migration).
grant select on table public.event_lineup_entries to anon, authenticated;
grant select on table public.event_lineup_entry_artists to anon, authenticated;
