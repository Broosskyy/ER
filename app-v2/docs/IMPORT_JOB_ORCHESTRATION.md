# Import Job Orchestration

## Current state

| Component | Status |
|-----------|--------|
| `ImportOrchestrator` | Production for manual/adapter imports |
| `ImportAggregationService` | Production pipeline to `import_records` |
| `resolveImportRetry` | Implemented — exponential backoff + jitter |
| `InMemorySourceImportLock` | Local concurrency guard |
| Job metrics fields | Prepared on registry model |
| Distributed scheduler | Not implemented |

## Retry policy

`src/features/import/services/import-retry-policy.ts`

- Categories: network, rate_limit, validation, auth, unknown
- Retryable: network, rate_limit (configurable)
- Backoff: `baseMs * 2^attempt` with jitter cap

## Locking

`InMemorySourceImportLock` prevents concurrent imports per `sourceId` in local runtime. Supabase-level locking prepared for future worker deployment.

## Next steps (out of sprint)

- Persist job metrics to `import_jobs`
- Wire automatic `nextSyncAt` from registry sync interval
- Replace in-memory lock with DB advisory lock
