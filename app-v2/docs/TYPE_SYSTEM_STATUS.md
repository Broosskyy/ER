# Type System Status — Phase 4.5.4

**Date:** 2026-08-01  
**Gate:** Engineering-quality baseline before Phase 5 source expansion.

---

## Summary

| Check | Before 4.5.4 | After 4.5.4 |
|-------|----------------|---------------|
| `typecheck:app` | 88 errors | **0** |
| `typecheck:operations` (active scripts) | 225+ errors (relaxed config) | **0** (strict) |
| `@ts-ignore` / `@ts-expect-error` in `src/` | 0 | **0** |
| Explicit `: any` in `src/` | 0 | **0** |
| Vitest | 1380 passing | **1380 passing** |
| ESLint (`--quiet`) | 15 errors | **0 errors** (2374 import/order warnings remain) |
| Expo Web export | passing | **passing** |

---

## Errors fixed (application)

**Root causes addressed:**

1. **Missing Supabase `Database` types** — `Record<string, unknown>` caused `never` on `.from()` queries (`registry.ts`, import review, datasources).
2. **Missing `@types/node`** — `Buffer`, `node:crypto`, `node:fs` unresolved in server/repair modules.
3. **Stale connector imports** — `adapter-registry.ts` imported ticket types from `../types` instead of `./types`.
4. **Incomplete `EventDisplayModel` stubs** — wizard preview, favorites unavailable state.
5. **Theme token drift** — admin onboarding/discovery panels used removed `headingSm`, `colorRoles.textMuted`, etc.
6. **Nullable guards** — price parsing, JWT decode, operational metrics, repair planners.
7. **Domain type gaps** — `ReviewerEdits.subtitle`, `RawSourceType` on backfill candidates, `PlatformCapability.html_cards`.

---

## Generated Database types

| Item | Status |
|------|--------|
| Authoritative schema file | `src/services/supabase/database.types.ts` |
| Wired in client | `src/services/supabase/client.ts` |
| Regeneration command | `npm run gen:supabase-types` |
| Prerequisite | Docker + `supabase start` (local) |

**Workflow:** When migrations change, run `npm run gen:supabase-types`, diff against `database.types.ts`, and replace mapper-derived table definitions with generated output. Until CI has Docker, `database.types.ts` is maintained from mapper row contracts (`EventRow`, `SourceRow`, `ImportRecordRow`, etc.) and validated by `typecheck:app`.

**Do not** hand-edit a file named `database.generated.ts` without running the CLI.

---

## Typecheck configuration

| Config | Scope | Strict |
|--------|-------|--------|
| `tsconfig.json` | Base (`strict`, `noUncheckedIndexedAccess`) | yes |
| `tsconfig.app.json` | `src/`, `app/` (excludes `scripts/**`, `**/__tests__/**`) | yes |
| `tsconfig.operations.json` | Active operations scripts only | yes |

Commands:

```bash
npm run typecheck        # app + operations
npm run typecheck:app
npm run typecheck:operations
```

---

## Operations scripts classification

### Active (typechecked — `tsconfig.operations.json`)

| Class | Scripts |
|-------|---------|
| **Bootstrap** | `bootstrap-ops-supabase.ts`, `load-ops-env.ts` |
| **Production workers** | `run-queue-worker.ts`, `run-scheduler-tick.ts`, `run-worker-recovery.ts`, `run-persist-connector-health.ts` |
| **Maintenance** | `repair-events.ts` |
| **Audits (read-only)** | `_audit-admin-ui-gaps.ts`, `_audit-review-queue-state.ts`, `_audit-ticket-io-*` |
| **Sprint 4.5.x** | `_sprint42-*` through `_sprint453-*` (field trust, ticket URL, provenance, detail extraction) |

Shared typing helpers: `scripts/operations/ops-supabase-rows.ts` (`Pick<Row,…>` snippets, typed updates).

### Historical (excluded from typecheck)

Documented in `scripts/operations/HISTORICAL_SCRIPTS.md`:

- `_bootshaus-*` (pre-4.5 one-offs)
- `_affenkaefig-*`
- `_sprint33*` / `_sprint334*` / `_sprint335*`
- `_migration-drift-audit-readonly.ts`, `_live-schema-audit-readonly.ts`

Run historical scripts with `npx tsx scripts/operations/<script>.ts` — not part of CI typecheck.

---

## Connector typing rules

| Rule | Module |
|------|--------|
| Ticket platform types | `connectors/ticket-platform/types.ts` only |
| Import from `./types` inside ticket-platform | never `../types` (framework types) |
| `TicketPlatformConnectorConfig` | alias of `TicketPlatformSourceConfig` |
| `CanonicalImportEvent` | requires `rawSourceType: RawSourceType` |
| `RawImportedEvent` | `connectors/types.ts` |

---

## Strictness audit

| Pattern | `src/` count | Notes |
|---------|--------------|-------|
| `@ts-ignore` | 0 | — |
| `@ts-expect-error` | 0 | — |
| `: any` | 0 | — |
| `as unknown as` | ~65 total (~25 production, ~26 tests) | Supabase JSON bridges, scheduler payloads, test mocks |
| Non-null `!` | minimal | Only after explicit guards |

**Policy:** No new suppressions. Prefer `Pick<Row,…>`, mapper exports, and domain guards over casts.

---

## Maintenance guidelines

1. Add new tables to `database.types.ts` when migrations introduce them (or regenerate).
2. Export new row shapes from `src/data/mappers/*` and reference in `Database['public']['Tables']`.
3. Operations scripts must use `ops-supabase-rows.ts` or `Pick<Row,…>` casts — never untyped `.from()` results.
4. New admin UI must use `useTheme()` / `darkColors` / `textRoles` — not removed legacy tokens.
5. Consumer surfaces must build `EventDisplayModel` via `toEventDisplayModel()`, not partial stubs.
6. Run `npm run typecheck` before merge; full gate: `npm run release:check`.

---

## Phase 5 readiness

**No engineering blockers** from the type system:

- Application compiles clean under strict mode
- Active operations tooling compiles clean
- Database client is typed end-to-end for production tables
- Connector contracts are unified
- Historical scripts are isolated and documented

**Operational note:** `npm run gen:supabase-types` requires Docker locally; production CI should add this step when container runtime is available.

Phase 5 may proceed with source expansion without revisiting core Event pipeline typing.
