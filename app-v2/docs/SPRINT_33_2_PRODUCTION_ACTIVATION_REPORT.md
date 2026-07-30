# Sprint 33.2 — Final Production Activation Report

**Date:** 2026-07-30  
**Branch:** `feature/er-012-source-acquisition-foundation`  
**Verdict:** **SOURCE ONBOARDING FOUNDATION PRODUCTION READY**

Migration `20260766000000_sprint331_source_onboarding_rls.sql` is applied. Live validation, database integrity checks, SSRF regression tests, and the full unit suite pass. Persistent `source_onboarding_jobs` writes work after fixing FK-safe duplicate detection (`duplicate_source_id` now stores `sources.id`, not hostname).

---

## Phase 1 — Repository Audit

| Area | Status | Notes |
|------|--------|-------|
| `source_onboarding_jobs` (650) | ✅ | Table + status checks |
| RLS + service role (660) | ✅ | Applied in production |
| `SupabaseSourceOnboardingRepository` | ✅ | Active when `VITEST !== 'true'` |
| `SourceOnboardingService` | ✅ | Discovery, dry-run, retry, duplicate guard |
| `EventOriginService` | ✅ | Metadata on `event_source_references` |
| Admin wizard `/admin/sources/new` | ✅ | `SourceOnboardingWizard.tsx` |
| Ops scripts | ✅ | `_sprint331-*`, `_sprint332-production-validation.ts` |
| Scheduler | ✅ | No changes; Sprint 15/26 tests green |

**Fix in 33.2:** `duplicate_source_id` FK violation — registry now maps hostnames to `sources.id`; duplicate detection checks `baseUrl`, `website`, and `sourceUrl`.

---

## Phase 2 — Live Onboarding Validation

Script: `npx tsx scripts/operations/_sprint331-onboarding-validation.ts`  
Artifact: `docs/real-data/_sprint331_onboarding_validation.json`

| Case | URL | Expected | Result |
|------|-----|----------|--------|
| A — Bootshaus | `https://bootshaus.tv/events/` | Duplicate → `review_required` | ✅ `duplicateSourceId: source-bootshaus-koeln` |
| B — Affenkäfig | `https://affenkaefig.info/tickets/` | Duplicate → `review_required` | ✅ `duplicateSourceId: source-affenkaefig` |
| C — SSRF | `http://127.0.0.1/private-events` | Blocked | ✅ `Blocked private address: 127.0.0.1` |
| D — Retry | Bootshaus job id | Idempotent retry | ✅ Returns same persisted job |
| Persistence | `source_onboarding_jobs` | 2 rows | ✅ Bootshaus + Affenkäfig normalized URLs |

Normalized URLs: `https://bootshaus.tv/events`, `https://affenkaefig.info/tickets` — no duplicates.

---

## Phase 3 — Database Validation

Script: `npx tsx scripts/operations/_sprint332-production-validation.ts`  
Artifact: `docs/real-data/_sprint332_production_validation.json`

| Check | Result |
|-------|--------|
| Canonical events | 65 (unchanged) |
| Published events | 59 (unchanged) |
| Source references | 62 active |
| Origin backfill (`backfilledAt`) | 62 / 62 |
| Origin role+platform metadata | 44 / 62 (expected: staging refs without platform mapping) |
| Duplicate origin keys | 0 |
| Duplicate `normalized_url` in onboarding jobs | 0 |
| Invalid `duplicate_source_id` (non-FK) | 0 |

Backfill idempotency confirmed in Sprint 33.1; counts stable.

---

## Phase 4 — Security Validation

| Vector | Status |
|--------|--------|
| `file://`, `ftp://`, `data:`, `javascript:` | ✅ Blocked (unit + live SSRF case) |
| localhost / 127.0.0.1 / ::1 | ✅ Blocked |
| Private networks (10.x, 192.168.x) | ✅ Blocked (unit tests) |
| Metadata (169.254.169.254) | ✅ Blocked (unit tests) |
| Redirect re-validation | ✅ `sprint331-production-activation.test.ts` |

No SSRF regressions.

---

## Phase 5 — Admin Flow

| Step | Validated |
|------|-----------|
| URL submit + normalize | ✅ |
| Discovery (non-duplicate URLs) | ✅ Unit tests + engine |
| Dry run | ✅ Unit tests |
| Persistent job | ✅ Production writes |
| Status transitions | ✅ `status-transitions.ts` + unit tests |
| Retry | ✅ Live case D |
| Duplicate detection | ✅ Bootshaus + Affenkäfig |
| Origin creation on publish | ✅ `EventOriginService` + backfill |

Full discovery/dry-run path for **new** hostnames is covered by unit tests; production Bootshaus/Affenkäfig correctly short-circuit as registered sources.

---

## Phase 6 — Scheduler Validation

| Area | Status |
|------|--------|
| Schedule policies / intervals | ✅ `sprint15-production-scheduler.test.ts` |
| Queue claim / lease | ✅ `sprint26-6-queue-claim.test.ts` |
| Import retry policy | ✅ `import-retry-policy.test.ts` |

No scheduler regressions from Sprint 33 work.

---

## Phase 7 — Regression

| Suite | Result |
|-------|--------|
| Vitest | **1214 / 1214** |
| `validate:migrations` | 48 files PASS |

---

## Phase 8 — Documentation Updated

- `SPRINT_33_2_PRODUCTION_ACTIVATION_REPORT.md` (this file)
- `SPRINT_33_1_PRODUCTION_ACTIVATION_REPORT.md` (superseded note)
- `AUTOMATED_SOURCE_ONBOARDING.md`
- `MULTI_ORIGIN_EVENT_MODEL.md`
- `SOURCE_ONBOARDING_SECURITY.md`
- `go-live.md` (source onboarding checklist)

---

## Known Limitations

- Ticket.io / Ticket Kings: 0 source references until first import runs
- 18 source references have `backfilledAt` but no `role`+`platform` (legacy staging rows)
- Discovery wizard performs single-page probe; full crawl out of scope

---

## Ops Commands

```bash
npx tsx scripts/operations/_sprint331-onboarding-validation.ts
npx tsx scripts/operations/_sprint332-production-validation.ts
npx tsx scripts/operations/_sprint331-origin-metrics.ts
```

---

## Release Tag

`source-onboarding-foundation-ready`
