# M9.4D.1 — DB / Repo Alignment

Date: 2026-10-06  
Base checkpoint: `b7fec0495518ecf54f745043135b529af94cec6f`  
Working branch: `fix/er-db-repo-alignment`  
Supabase staging project: `gnkjzinwvmrxcadwebhv` (`Eternal-Rave`)

## Scope

This alignment pass repairs database migration metadata and removes the unsafe implicit Eternal Rave production project reference from active ingestion/scheduler guards.

It does **not**:

- mutate event, venue, lineup, genre, ticket, or source rows,
- enable production writes,
- enable a production scheduler,
- merge anything into `main`,
- enable the Rausgegangen scheduler,
- start M9.4E.

## Database verification

The staging database was restored and verified `ACTIVE_HEALTHY`.

Post-repair row counts:

| Table | Rows |
| --- | ---: |
| `events` | 84 |
| `venues` | 51 |
| `event_sources` | 133 |
| `event_lineup` | 201 |
| `event_genres` | 138 |
| `event_tickets` | 47 |
| `ingestion_runs` | 209 |
| `ingestion_source_health` | 6 |

The M9.4D Rausgegangen cohort is present in staging. The database therefore matches the current Event Core / source-acquisition lineage rather than the old application database.

## Migration history repair

Repo migration files:

1. `20260813234500_event_core_baseline.sql`
2. `20260814001000_event_sources_private.sql`
3. `20260814143000_event_core_ingestion_identity.sql`
4. `20260826210000_ingestion_run_tracking.sql`

Before this pass, the fourth migration's schema objects were already present in the database, but the version was missing from `supabase_migrations.schema_migrations`.

Preconditions were verified before repair:

- `public.ingestion_runs` exists,
- `public.ingestion_source_health` exists,
- `ingestion_runs_connector_started_idx` exists,
- RLS is enabled,
- consumer roles have no grants on the internal ingestion tables.

Only migration-history metadata was repaired. The migration DDL was **not** replayed.

Remote migration history now contains all four versions.

## Production safety repair

The previous ingestion guard hard-coded a project ref as Eternal Rave production even though that ref belongs to another project.

That implicit production ref has been removed from active guard code.

Production is now fail-closed:

- Staging remains explicitly pinned to `gnkjzinwvmrxcadwebhv`.
- Scheduled apply accepts only that exact staging ref.
- Any unknown non-staging ref is rejected.
- A future Eternal Rave production ref must be explicitly provided through `ETERNAL_RAVE_PRODUCTION_PROJECT_REF`.
- Production target validation refuses missing configuration.
- Production target validation refuses using the staging ref as production.
- Production target validation requires the configured ref and an explicit production-style project name.
- Production scheduler remains disabled.

## Changed runtime files

- `app-v2/server/ingestion/sync/staging-guard.ts`
- `app-v2/server/ingestion/sync/scheduler-guard.ts`
- `app-v2/server/ingestion/sync/linked-db.ts`
- `app-v2/scripts/run-scheduled-staging-sync.ts`

Regression coverage:

- `app-v2/server/ingestion/sync/__tests__/m9-0-staging-scheduler.test.ts`
- `app-v2/server/ingestion/sync/__tests__/staging-guard.test.ts`

## Remaining scheduler issue

GitHub's repository default branch is still `main`.

The staging cron workflows currently exist on `rebuild/event-core-clean`, while `main` does not contain `.github/workflows`.

Therefore the scheduled Bootshaus / Affenkäfig jobs must **not** be assumed to be operational from the current default-branch topology.

This pass intentionally does not copy or merge the workflows into stale `main`. Branch integration must be resolved deliberately before scheduler activation.

## Next safe milestone

After this branch is reviewed/merged into `rebuild/event-core-clean`:

1. run the ingestion/typecheck regression suite in the normal repo environment,
2. re-run staging target + migration audit,
3. keep production unset,
4. proceed to M9.4E as a controlled scale-validation phase,
5. do not bulk-import the remaining Rausgegangen eligibility pool without the M9.4E gates.
