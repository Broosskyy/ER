-- Sprint 2.4 — duplicate warning on events for admin review persistence

alter table public.events
  add column if not exists duplicate_warning text;

comment on column public.events.duplicate_warning is
  'Human-readable duplicate match warning shown in admin review before publish';
