# ER-012 — Source & Acquisition Foundation — Completion Report

**Epic:** ER-012 Source & Acquisition Foundation  
**Branch:** `feature/er-012-source-acquisition-foundation`  
**Date:** 22 July 2026  
**Repository:** `C:/ER`

---

## Repository Analysis

Eternal Rave already contained a `sources` table and import-layer `ImportSource` model from earlier import epics. ER-012 evolved this into a canonical **Source domain** — a provider-independent metadata registry for future acquisition — without implementing connectors, parsers, schedulers, or crawlers.

Key findings:
- Existing `sources` table had legacy columns (`name`, `type`, `active`, `adapter_key`, `source_url`) referenced by import jobs and events
- `ImportSource` remains the import adapter contract; bridged via `mapSourceRecordToImportSource`
- ER-010 Organizer pattern used as template for domain → service → datasource → mapper → Admin CMS
- RLS from ER-011 already scopes sources (admin read; `source_manager|admin|owner` write)

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Evolve existing `sources` table | FKs from `events`, `import_jobs`, `import_records`; no parallel table |
| Source = metadata registry only | Execution data (health, jobs, logs) deferred to future domains |
| `SourceRecord` canonical domain model | `ImportSource` preserved for backward-compatible adapters |
| Dedicated `source-mapper.ts` | Single mapper; `reference-mapper` re-exports for compatibility |
| `/admin/sources` top-level CMS | Replaces `/admin/imports/sources` (redirects preserve old URLs) |
| Import provenance on `import_records` | `source_type`, `original_url`, `retrieved_at` columns + domain fields |

---

## Source Domain

**Responsibilities:** identify, describe, validate, activate/deactivate, archive, trust, priority, polling/parser/acquisition configuration metadata.

**Not responsible for:** crawling, parsing, downloading, scheduling, duplicate detection, publishing.

**Types:** `website`, `api`, `rss`, `ical`, `ticket_platform`, `social`, `manual`, `unknown`  
**Parser strategies (config only):** `html`, `rss`, `json`, `ical`, `api`, `csv`, `json-ld`, `unknown`  
**Acquisition strategies (config only):** `manual`, `scheduled`, `webhook`, `future`

---

## Database Changes

Migration: `20260738000000_er012_source_acquisition_foundation.sql`

- Extended `sources` with canonical columns: `slug`, `display_name`, `source_type`, `base_url`, `parser_type`, `acquisition_strategy`, `polling_strategy`, `polling_interval_minutes`, `rate_limit_per_hour`, `priority`, `requires_authentication`, `enabled`, `archived`, `notes`
- Backfilled from legacy columns; resolved duplicate slugs
- Constraints: trust 0–100, priority 0–100, polling interval ≥ 5 min, rate limit ≥ 1
- Indexes: `slug` (unique), `enabled`, `archived`, `priority`, `source_type`
- Extended `import_records`: `source_type`, `original_url`, `retrieved_at`

---

## Migration

- Additive only — no destructive changes, no table rewrites
- `npm run validate:migrations` — **PASS** (20 migrations)

---

## RLS

No new RLS migration required. ER-011 policies remain authoritative:
- SELECT: `is_admin()`
- INSERT/UPDATE/DELETE: `source_manager`, `admin`, `owner`

---

## Domain Models

- `SourceRecord` — canonical domain record in `data/types/records.ts`
- `SourceListParams` — search, filter, sort, pagination
- `ImportSource` — unchanged import adapter contract

---

## Validation

`SourceService` + `validateSourceInput`:
- Display name, slug, priority, trust score, URLs, enums
- Archived sources cannot be enabled
- Duplicate slug and base URL detection

---

## Repositories

- `SourceRepository` — read/active/save
- `AdminSourceRepository` — full CRUD, list, archive, restore, import job count

---

## Datasources

- `LocalSourceDatasource` — local parity with list/archive/restore
- `SupabaseSourceDatasource` — Supabase parity
- Repository consumers remain datasource-agnostic

---

## Services

`SourceService`:
- `listForAdmin`, `getByIdForAdmin`, `create`, `update`
- `setEnabled`, `archive`, `restore`
- Permission checks via `canViewSources` / `canManageSources`

---

## Admin CMS

| Route | Purpose |
|-------|---------|
| `/admin/sources` | List with search, filters, sorting |
| `/admin/sources/new` | Create source |
| `/admin/sources/[id]` | Edit, archive, restore, enable/disable |

- Navigation: Sources alongside Events, Artists, Venues, Organizers
- Legacy `/admin/imports/sources/*` redirects to new routes
- Confirmation modal for archive/restore/enable/disable

---

## Import Integration

- `ImportRecord` extended: `sourceType`, `sourceName`, `originalUrl`, `retrievedAt`
- `ImportOrchestrator` populates provenance on record creation
- Import Review UI shows source name, type, original URL, retrieved timestamp, current source status

---

## Tests Added

`src/features/sources/__tests__/source-foundation.test.ts` (11 tests):
- Migration SQL assertions
- Slug generation and collision resolution
- Validation rules
- Duplicate detection
- Mapper round-trip
- SourceService create/duplicate/archive rules

Updated: `reference-mapper.test.ts`, `admin-guard.test.ts`

**Total:** 462 tests — **PASS**

---

## Documentation Updated

- `docs/ER-012_SOURCE_ACQUISITION_FOUNDATION_COMPLETION_REPORT.md` (this file)
- `docs/PROJECT_STATE.md` — sources module
- `AI_CONTEXT.md` — admin sources CMS, test count

---

## Technical Debt Removed

- Consolidated source mapping into `source-mapper.ts`
- Removed duplicate source logic from `reference-mapper.ts`
- Dedicated source datasources replace generic reference-table handling for sources

---

## Deferred Work

Explicitly **not** implemented (future epics):

- Connector framework, crawler, scraper, parser execution
- Scheduling, webhooks, workers, retry/backoff
- Duplicate resolution engine, confidence engine, publishing automation
- AI extraction, media processing
- Source health monitoring, sync history, execution logs, connector diagnostics
- Source ↔ Organizer/Venue/Artist relationships

---

## Validation Results

| Gate | Result |
|------|--------|
| Typecheck | PASS |
| Tests | 462/462 PASS |
| Migration validation | PASS (20) |
| Release pipeline | See git delivery section |

---

## Files Changed

**New:**
- `app-v2/supabase/migrations/20260738000000_er012_source_acquisition_foundation.sql`
- `app-v2/src/features/sources/` (domain, service, admin labels, tests)
- `app-v2/src/data/mappers/source-mapper.ts`
- `app-v2/src/data/datasources/local/local-source-datasource.ts`
- `app-v2/src/data/datasources/supabase/supabase-source-datasource.ts`
- `app-v2/app/admin/sources/index.tsx`
- `app-v2/app/admin/sources/[id].tsx`

**Modified:**
- Import models, mappers, orchestrator, review UI
- Repositories, registry, datasources, AdminShell, admin-route-utils
- Legacy import source routes (redirects)

---

## Git Delivery

| Item | Value |
|------|-------|
| Branch | `feature/er-012-source-acquisition-foundation` |
| Commit | Pending user request |
| Pull Request | Pending |
| Migration | `20260738000000_er012_source_acquisition_foundation.sql` |
| Documentation | Updated |
| Generated types | Regenerate after migration apply to remote |
| Test count | 462 |
| Typecheck | PASS |
| Migration validation | PASS |

---

## Final Assessment

ER-012 establishes the canonical Source Foundation for Eternal Rave.

The repository is now prepared for provider-independent acquisition.

Future epics may implement connectors without redesigning the Source domain.
