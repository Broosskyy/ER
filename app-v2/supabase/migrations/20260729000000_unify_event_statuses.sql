-- Eternal Rave — Unify event status values (ER-004)
-- Replace legacy `deleted` with `archived`; allow `rejected`.

update public.events
set status = 'archived'
where status = 'deleted';

alter table public.events
  drop constraint if exists events_status_check;

alter table public.events
  add constraint events_status_check
  check (status in ('draft', 'review', 'published', 'rejected', 'archived'));
