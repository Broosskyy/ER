-- Eternal Rave — Sprint 33.1: Source onboarding RLS policies and hostname uniqueness.
-- Additive only.

drop policy if exists admin_read_source_onboarding_jobs on public.source_onboarding_jobs;
drop policy if exists admin_write_source_onboarding_jobs on public.source_onboarding_jobs;

create policy admin_read_source_onboarding_jobs on public.source_onboarding_jobs
  for select using (public.is_admin());

create policy admin_write_source_onboarding_jobs on public.source_onboarding_jobs
  for all using (public.is_admin()) with check (public.is_admin());

create unique index if not exists source_onboarding_jobs_hostname_active_idx
  on public.source_onboarding_jobs(hostname)
  where status not in ('rejected', 'enabled');

create index if not exists source_onboarding_jobs_normalized_url_idx
  on public.source_onboarding_jobs(normalized_url);

alter table public.operations_backfill_jobs
  drop constraint if exists operations_backfill_jobs_backfill_type_check;

alter table public.operations_backfill_jobs
  add constraint operations_backfill_jobs_backfill_type_check
    check (backfill_type in (
      'blocking_keys',
      'lifecycle_history',
      'provenance',
      'event_origins',
      'source_intelligence'
    ));

drop policy if exists service_role_source_onboarding_jobs on public.source_onboarding_jobs;
create policy service_role_source_onboarding_jobs on public.source_onboarding_jobs
  for all to service_role using (true) with check (true);

grant select, insert, update, delete on public.source_onboarding_jobs to service_role;
