-- Eternal Rave — Sprint 26.6: Go-Live Readiness
-- Atomic queue claim, Bootshaus auto-schedule activation.

-- Queue claim metadata for multi-worker safety.
alter table public.import_job_queue
  add column if not exists worker_id text,
  add column if not exists processing_started_at timestamptz;

create index if not exists import_job_queue_worker_id_idx
  on public.import_job_queue(worker_id)
  where worker_id is not null;

-- Atomically claim queued jobs (FOR UPDATE SKIP LOCKED).
create or replace function public.claim_import_job_queue_entries(
  p_limit integer,
  p_now timestamptz,
  p_worker_id text,
  p_lease_ms integer default 1800000
)
returns setof public.import_job_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select q.id
    from public.import_job_queue q
    where q.status = 'queued'
      and q.scheduled_for <= p_now
    order by q.priority desc, q.scheduled_for asc
    limit greatest(p_limit, 0)
    for update skip locked
  )
  update public.import_job_queue q
  set
    status = 'processing',
    started_at = p_now,
    processing_started_at = p_now,
    processing_lease_expires_at = p_now + make_interval(secs => p_lease_ms / 1000.0),
    worker_id = p_worker_id
  from candidates c
  where q.id = c.id
    and q.status = 'queued'
  returning q.*;
end;
$$;

grant execute on function public.claim_import_job_queue_entries(integer, timestamptz, text, integer)
  to service_role;

-- Bootshaus: enable automatic interval scheduling after deployment.
update public.sources
set
  schedule_policy = 'interval',
  schedule_enabled = true,
  schedule_interval_preset = 'every_6_hours',
  polling_interval_minutes = 360,
  next_scheduled_at = coalesce(next_scheduled_at, now())
where id = 'source-bootshaus-koeln';
