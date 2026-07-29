# Sprint 26.7 — Manual PostgreSQL Queue Claim Tests

Run against a database with migration `20260755000000_sprint26_7_production_hardening.sql` applied.

Use `service_role` connection or superuser.

## Setup

```sql
insert into public.platform_operations_state (id)
values ('default')
on conflict (id) do nothing;
```

## Test cases

### 1. Due job is claimed

```sql
select * from public.claim_import_job_queue_entries(1, now(), 'worker-test-1', 1800000);
```

Expected: rows with `status = 'processing'`, `worker_id = 'worker-test-1'`.

### 2. Future job not claimed

Queue row with `scheduled_for = now() + interval '1 hour'`.

Expected: not returned.

### 3. Job before next_retry_at not claimed

Set `next_retry_at = now() + interval '10 minutes'`.

Expected: not returned.

### 4. Dead-letter job not claimed

Set `dead_lettered_at = now()`.

Expected: not returned.

### 5. Exhausted attempts not claimed

Set `attempt_count = max_attempts`.

Expected: not returned.

### 6. worker_paused blocks claims

```sql
update public.platform_operations_state set worker_paused = true where id = 'default';
select count(*) from public.claim_import_job_queue_entries(10, now(), 'worker-test-3', 1800000);
update public.platform_operations_state set worker_paused = false where id = 'default';
```

Expected: `0` while paused.

### 7. global_maintenance_mode blocks claims

```sql
update public.platform_operations_state set global_maintenance_mode = true where id = 'default';
select count(*) from public.claim_import_job_queue_entries(10, now(), 'worker-test-4', 1800000);
update public.platform_operations_state set global_maintenance_mode = false where id = 'default';
```

Expected: `0` while maintenance active.

### 8. scheduler_paused does not block worker

```sql
update public.platform_operations_state set scheduler_paused = true where id = 'default';
select count(*) from public.claim_import_job_queue_entries(10, now(), 'worker-test-5', 1800000);
update public.platform_operations_state set scheduler_paused = false where id = 'default';
```

Expected: claims still possible when eligible rows exist.

### 9. Concurrent workers

Two sessions, different `p_worker_id`.

Expected: each row claimed once only.

### 10. Blank worker id error

```sql
select * from public.claim_import_job_queue_entries(1, now(), '   ', 1800000);
```

Expected: exception.

### 11. Invalid lease error

```sql
select * from public.claim_import_job_queue_entries(1, now(), 'worker-test-6', 1000);
```

Expected: exception.

### 12–14. Role permissions

`anon` / `authenticated`: EXECUTE denied.  
`service_role`: EXECUTE allowed.

```sql
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'claim_import_job_queue_entries';
```
