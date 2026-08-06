-- Phase 4.7.3.1 — Schema guarantees omitted from the initial phase473 deploy.
-- Additive only: column default + non-negative count checks.
-- Does not UPDATE existing rows (SET DEFAULT affects future INSERTs only).

alter table public.events
  alter column event_attributes set default '{}'::jsonb;

alter table public.events
  drop constraint if exists events_floor_count_check;

alter table public.events
  add constraint events_floor_count_check
  check (floor_count is null or floor_count >= 0);

alter table public.events
  drop constraint if exists events_stage_count_check;

alter table public.events
  add constraint events_stage_count_check
  check (stage_count is null or stage_count >= 0);

comment on column public.events.event_attributes is
  'Canonical event attribute records (type, label, provenance). Defaults to empty object on insert; existing NULL rows unchanged.';
