# Import Foundation (Sprint 12A)

Technical foundation for the Eternal Rave Import Engine. Sprint 12A delivers persistence, repositories, adapter registration, orchestration skeleton, logging, and admin-only security — without parsing, duplicate detection, or admin UI.

## Architecture

```
ImportOrchestrator
  → ImportSourceRepository
  → ImportAdapterRegistry → ImportSourceAdapter (per format, Sprint 12B+)
  → ImportJobRepository
  → ImportRecordRepository
  → ImportLoggingService → ImportLogRepository
        ↓
  DatasourceBundle (Local | Supabase)
```

The import layer follows the existing Sprint 11 pattern: **orchestrator → repository → datasource → database**. No direct Supabase calls outside repository/datasource implementations.

## Data Flow

1. **Load source** — `ImportSourceRepository.getById(sourceId)` returns an `ImportSource` with `adapterKey`.
2. **Resolve adapter** — `ImportAdapterRegistry.get(adapterKey)` returns the registered `ImportSourceAdapter`.
3. **Create job** — `ImportJobRepository.create()` with status `pending`, then update to `running`.
4. **Execute adapter** — `adapter.fetchRecords(source)` returns raw `ImportFetchedRecord[]` (no parsing in 12A).
5. **Save records** — `ImportRecordRepository.createMany()` stores records with status `fetched`.
6. **Complete job** — job status set to `completed` or `failed`; logs written via `ImportLoggingService`.

## Database Tables

Migration: `supabase/migrations/20260720000000_import_foundation.sql`

| Table | Purpose |
|---|---|
| `import_jobs` | One import run per source (`status`, `trigger_type`, timestamps) |
| `import_records` | Staged raw/normalized payloads per external ID |
| `import_logs` | Structured job/record log entries |

`sources` gains optional `adapter_key` for adapter routing.

### Status Values

**Import jobs:** `pending` | `running` | `completed` | `failed` | `cancelled`

**Import records:** `fetched` | `parsed` | `needs_review` | `invalid`

## Domain Models

Located in `src/features/import/models/`:

- `ImportSource`, `ImportJob`, `ImportRecord`, `ImportLog`
- `ImportJobStatus`, `ImportRecordStatus`, `ImportTriggerType`, `ImportLogLevel`

Mappers in `src/data/mappers/import-mapper.ts` convert between snake_case DB rows and camelCase domain types.

## Repositories

Interfaces: `src/data/repositories/import-repositories.ts`

| Repository | Methods |
|---|---|
| `ImportSourceRepository` | `getAll`, `getActive`, `getById`, `save` |
| `ImportJobRepository` | `create`, `update`, `getById`, `listBySourceId` |
| `ImportRecordRepository` | `create`, `createMany`, `update`, `getById`, `listByJobId` |
| `ImportLogRepository` | `create`, `listByJobId` |

`SourceRepository` (existing) is extended with `getActive`, `getById`, and `save`.

Implementations: `src/data/repositories/import-repository-impl.ts`

Registry exports: `src/data/repositories/registry.ts`

## Adapter Registry

```typescript
interface ImportSourceAdapter {
  readonly adapterKey: string;
  fetchRecords(source: ImportSource): Promise<ImportFetchedRecord[]>;
}
```

`ImportAdapterRegistry` (`src/features/import/adapters/import-adapter-registry.ts`):

- `register(adapter)` — rejects duplicate keys
- `get(adapterKey)` — rejects unknown keys
- `has(adapterKey)`, `listKeys()`

No concrete format adapters in 12A (JSON-LD, RSS, iCal, CSV, API follow in 12B+).

## Configuration

`src/features/import/config/import-config.ts`:

| Setting | Default | Purpose |
|---|---|---|
| `timeoutMs` | 60000 | Adapter execution timeout |
| `retryCount` | 2 | Reserved for 12B retry logic |
| `maxRecordsPerJob` | 500 | Cap records per run |
| `loggingEnabled` | true | Toggle structured import logs |

## Errors

`src/features/import/errors/import-errors.ts`:

- `ImportError` (base)
- `ImportRepositoryError`
- `ImportAdapterError`
- `ImportExecutionError`

Each uses a unique `ImportErrorCode` (e.g. `IMPORT_ADAPTER_NOT_FOUND`, `IMPORT_RECORD_LIMIT_EXCEEDED`).

## Logging

`ImportLoggingService` supports `debug`, `info`, `warning`, `error`. Messages are sanitized to avoid logging secrets (api keys, tokens, passwords).

## Security (RLS)

Migration adds `public.is_admin()` (JWT `app_metadata.role = 'admin'`).

Admin-only policies on:

- `sources` (replaces Sprint 11 open read/manage policies)
- `import_jobs`
- `import_records`
- `import_logs`

No service role keys in client code.

## Extension Points (Sprint 12B+)

| Area | Next step |
|---|---|
| Adapters | Implement `ImportSourceAdapter` per format; register in `importAdapterRegistry` |
| Parsing | Transition records from `fetched` → `parsed` / `invalid` |
| Review queue | Use `needs_review` status + admin screens |
| Duplicate detection | Compare normalized payloads before event creation |
| Entity matching | Link records to venues, artists, genres |
| Event publishing | Pipeline integration after validation |
| Scheduling | Wire `trigger_type: scheduled` to cron/edge functions |
| Retries | Use `importConfig.retryCount` in orchestrator |

## Tests

`src/features/import/__tests__/import-foundation.test.ts` covers:

- Status type guards
- Adapter registry (register, duplicate, unknown)
- Local import repositories
- Orchestrator with mock adapter (success + failure)
- Datasource bundle wiring

Run: `npm test`

## Validation

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
npm run validate:migrations
```
