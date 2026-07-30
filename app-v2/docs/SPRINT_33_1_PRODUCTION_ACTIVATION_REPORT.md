# Sprint 33.1 — Production Activation Report

> **Superseded by** [`SPRINT_33_2_PRODUCTION_ACTIVATION_REPORT.md`](SPRINT_33_2_PRODUCTION_ACTIVATION_REPORT.md) — **SOURCE ONBOARDING FOUNDATION PRODUCTION READY** (2026-07-30).

**Date:** 2026-07-30  
**Branch:** `feature/er-012-source-acquisition-foundation`  
**Prior commit:** `b5ffe3b`  
**Prior verdict:** BLOCKED — PRODUCTION ACTIVATION INCOMPLETE (migration 660 pending)

## Repository Audit

| Item | Status |
|------|--------|
| Branch | `feature/er-012-source-acquisition-foundation` |
| Untracked Affenkäfig JSON | Moved to `.gitignore` (`_affenkaefig_*.json`) |
| Working tree | Clean after commit |

## Migration

| Migration | Status |
|-----------|--------|
| `20260765000000` (source_onboarding_jobs) | Already applied (drift audit: Likely Applied) |
| `20260766000000` (RLS, grants, event_origins backfill type) | ✅ Applied (Sprint 33.2) |

## Metrics (production)

| Metric | Before | After |
|--------|--------|-------|
| Canonical events | 65 | 65 |
| Published events | 59 | 59 |
| Source references | 44 | 62 |
| Origins with role metadata | 0 | 62 |
| Origins backfilled | 0 | 62 |
| Bootshaus refs | 37 | 37 |
| Affenkäfig refs | 7 | 7 |
| Ticket.io refs | 0 | 0 |
| Ticket Kings refs | 0 | 0 |

**Backfill:** 62 inserts, 0 updates, 0 errors. Second pass idempotent (counts unchanged).

## Persistent Onboarding Repository

- `SupabaseSourceOnboardingRepository` active when `VITEST !== 'true'`
- In-memory only in unit tests
- Status transition validation via `status-transitions.ts`
- Service-role grants added in migration `20260766000000`

## Live Onboarding Validation

| Case | Expected | Result |
|------|----------|--------|
| A — Bootshaus URL | Duplicate / review | Pending migration `660` grants for persistent job writes |
| B — Affenkäfig URL | Strategy detected | Same |
| C — SSRF localhost | Blocked | Verified in unit tests |

## Security

- SSRF: blocked schemes, private IPs, metadata hosts, redirect re-validation
- 6 automated tests in `sprint331-production-activation.test.ts`

## Regression

- **1214 / 1214 tests passing**

## Known Limitations

- Ticket.io / Ticket Kings origins: no import records in production DB yet (0 refs)
- Migration `660` must be applied for PostgREST writes to `source_onboarding_jobs`
- Staging-seed events lack canonical URLs (documented in dry-run report)

## Scripts

- `_sprint331-origin-metrics.ts`
- `_sprint331-origin-backfill-dry-run.ts`
- `_sprint331-origin-backfill-run.ts`
- `_sprint331-onboarding-validation.ts`
- `_sprint331-apply-migration.ts`
