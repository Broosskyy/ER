# Source Domain — Architecture Notes

**Epic:** ER-012 / ER-012.1  
**Scope:** Metadata registry for future acquisition. No connectors, parsers, or schedulers.

## Write path

All source mutations must flow through `SourceService`:

```
UI / ImportOperationsService
  → SourceService (validation, duplicates, lifecycle rules)
  → AdminSourceRepository (persistence)
  → SourceDatasource
```

`ImportSourceRepository.save()` remains for read adapters and legacy interfaces but is **not** the business entry point. `ImportOperationsService` delegates creates, updates, enable/disable, and import-run metadata to `SourceService`.

Import-specific adapter configuration validation (`validateSourceConfig`) stays in `ImportOperationsService` because it concerns import adapters, not the Source registry itself.

## Type vocabulary strategy

Source enums are **not** PostgreSQL enums and **not** TypeScript `enum` keywords.

Pattern (consistent with `features/import/models/statuses.ts`):

- `as const` string arrays in `features/sources/domain/source-types.ts`
- Derived union types: `export type SourceType = (typeof SOURCE_TYPES)[number]`
- Runtime guards: `isSourceType()`, `isParserType()`, etc.

Database columns (`source_type`, `parser_type`, `polling_strategy`) use plain `text` so new vocabulary can be added without enum migrations. `acquisition_strategy` additionally has a CHECK constraint for the current known set.

On read, `source-mapper.ts` coerces unknown DB values to safe defaults (`unknown`, `manual`).

`ImportSource.type` and `adapterKey` remain free `string` fields for backward compatibility; they are normalized when bridged into `SourceRecord`.

## Trust score

- **Canonical default:** `SOURCE_DEFAULT_TRUST_SCORE = 50` (neutral, not untrusted)
- **Range:** 0–100 (validated in `SourceService`, CHECK constraint in DB)
- **Storage:** PostgreSQL `numeric`, TypeScript `number`
- Applied consistently in validation, mapper read fallback, factory defaults, CMS forms, and DB default (migration `20260739000000_er012_1`)

Explicit `0` remains valid when an administrator marks a source as untrusted.

## Base URL duplicate strategy

- **No** `UNIQUE(base_url)` database constraint
- Duplicate detection lives in `SourceService` via `findStrongSourceDuplicate()` in `source-duplicate.ts`
- Comparison normalizes `protocol + host + pathname` (trailing slash stripped)

**Why not a DB unique constraint?**

A `Source` represents a **provider**, not a single endpoint. Future epics may attach multiple acquisition endpoints (feeds, API paths, calendars) to one source or register several sources under the same domain with different paths or parser strategies. Service-level duplicate detection can evolve into warnings or scoped rules; a UNIQUE constraint would block that modeling prematurely.

Slug uniqueness **is** enforced at the database layer (`sources_slug_idx`) because slugs are stable identity keys.

## Deferred (out of scope)

Connector provider implementations (Website, RSS, API, etc.), endpoint Admin CMS, health/sync history, confidence engine, and automatic acquisition belong to future epics. The **connector framework** (ER-013) is implemented; the **endpoint domain** (ER-014 Part 1) is defined — see `app-v2/docs/endpoints-domain.md` and `app-v2/docs/connector-framework.md`.
