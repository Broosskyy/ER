# Bootshaus Data Quality & Pre-Publish Idempotency Report

**Sprint:** 26.8  
**Date:** 2026-07-28  
**Source:** `source-bootshaus-koeln`  
**Target:** `gnkjzinwvmrxcadwebhv.supabase.co`

---

## Executive Summary

Sprint 26.8 implements **config-driven normalization defaults** and **pre-publish idempotency** for Bootshaus without lowering global trust thresholds or adding Bootshaus-specific pipeline exceptions.

**Code status:** implemented and covered by 13 targeted tests (all green).  
**Live status (2026-07-29):** canonical entity repair applied (`venue-bootshaus-koeln`); dedupe cleanup **COMMIT successful** (72→36 records/reviews).

**Verdict: CONDITIONAL GO** — canonical entities + dedupe complete; **final E2E validation NO GO** (trust hold blocks publish).

See **`BOOTSHAUS_FINAL_GO_LIVE_VALIDATION_REPORT.md`** (2026-07-29).

---

## Phase 1 — Root cause analysis (verified data flow)

### Connector → Normalize gap

| Stage | Finding |
|-------|---------|
| HTML extractor (`html-strategies.ts`) | Extracts title, date parts, image, detail URL. **No city/organizer** from markup. |
| Previous `venueSelector: '.upcoming-subtitle'` | Mapped **promoter labels** (e.g. `CHROME COLOGNE`, `LOONYLAND`) — not venue. |
| `mapper.ts` / `normalize-step.ts` (before fix) | Only backfilled `countryCode` from source metadata — **not** city/organizer/venue. |
| Trust rules `missing_city`, `missing_organizer` | Fired on empty `cityName` / `organizerName` → decision `hold` + score penalty. |
| Live sample (pre-fix) | `cityName: null`, `organizerName: null`, `venueName: "CHROME COLOGNE"`, `ticketUrl: null` |

### Stable external identity

Bootshaus detail URLs are stable `source_event_id` / `external_id`, e.g. `https://bootshaus.tv/events/<slug>`.

---

## Phase 2 — Canonical metadata

Migration `20260757000000_sprint268_bootshaus_data_quality_idempotency.sql`:

- Ensures city `koeln` (Köln), venue `venue-bootshaus-koeln`, organizer `organizer-bootshaus` (idempotent inserts, no overwrites).
- Updates `sources.source_config.defaults` for Bootshaus.
- Removes misleading `venueSelector` from DB `source_config`.

**Live probe (2026-07-28T22:12Z):** `sourceDefaultsPresent: false` — migration pending.

---

## Phase 3 — Normalization correction

### Implementation

| Component | Change |
|-----------|--------|
| `SourceFieldDefaults` + `source_config.defaults` | Config-driven backfill for city, venue, organizer, address, ticket fallback |
| `resolveSourceFieldDefaults()` / `applySourceFieldDefaults()` | Website values win; defaults fill gaps only |
| `normalize-step.ts` | Applies defaults after `eventNormalizer.normalize()` |
| `production-source-records.ts` | Bootshaus factory defaults; removed `venueSelector` |
| `aggregation-source.ts` | Exposes `fieldDefaults` on pipeline context |

### Expected normalized output (post-fix)

- `cityName`: Köln (`cityId`: koeln)
- `venueName`: Bootshaus (`venueId`: venue-bootshaus-koeln)
- `organizerName`: Bootshaus (`organizerId`: organizer-bootshaus)
- `ticketUrl`: falls back to `eventUrl` when absent

---

## Phase 4 — Trust quality (unit validation)

Representative Bootshaus record **after defaults** (fixture-based unit test):

| Metric | Before (live sample) | After (unit test) |
|--------|----------------------|-------------------|
| Quality score | **34** | **≥ 68** |
| City is missing | yes | **no** |
| Organizer is missing | yes | **no** |
| Publish decision | `hold` | **`auto_publish`** |

Penalty model unchanged (threshold **65**). Score improvement comes from real field completeness, not threshold changes.

---

## Phase 5 — Pre-publish idempotency audit

### Why 72 review entries existed

| Question | Answer |
|----------|--------|
| Stable external ID? | **Yes** — Bootshaus event detail URL |
| Pre-create dedup against import/review? | **No** (before Sprint 26.8) |
| Uniqueness only on published events? | **Effectively yes** — `detectChanges` compared against `resultingEventId` / published events only |
| `import_records` constraint | Unique on `(import_job_id, external_id)` only → **new job = new row** |
| Review queue constraint | Unique on `import_record_id` only → **one review per record**, not per source event |
| Race risk | Parallel workers could insert duplicate rows without DB-level `(source_id, external_id)` guard |

### Root cause summary

Two identical imports each called `createMany` → 36 + 36 import records and 36 + 36 review entries. Matching did not dedupe because nothing was published.

---

## Phase 6 — Idempotency implementation

| Layer | Mechanism |
|-------|-----------|
| Import records | `upsertManyBySourceExternal()` — find latest by `source_id + external_id`, update in place |
| Change detection | `detectChanges()` treats equivalent existing import record as `unchanged` |
| Review queue | `findActiveBySourceAndExternalEventId()` — update existing `pending`/`on_hold` entry |
| Identity helpers | `import-record-identity.ts` — external ID + fallback composite key |

**DB hardening (post-cleanup):** unique indexes documented in `BOOTSHAUS_REVIEW_DEDUP_CLEANUP.sql` COMMIT section:

- `import_records(source_id, external_id)`
- `import_review_queue(source_id, external_event_id) WHERE status IN ('pending','on_hold')`

---

## Phase 7 — Cleanup script

**File:** `docs/real-data/BOOTSHAUS_REVIEW_DEDUP_CLEANUP.sql`  
**Commit variant:** `docs/real-data/BOOTSHAUS_REVIEW_DEDUP_CLEANUP_COMMIT.sql`  
**Apply script:** `scripts/operations/_bootshaus-dedup-cleanup-commit.ts`

| Property | Value |
|----------|-------|
| Scope | Bootshaus only (`source-bootshaus-koeln`) |
| Keeper strategy | Newest per `source_id + external_id` (`updated_at DESC, created_at DESC`) |
| Unique indexes | **Not applied** (deferred) |

### Live dedupe COMMIT (2026-07-29T14:12Z)

| Metric | Before | After |
|--------|--------|-------|
| `import_records` | 72 | **36** |
| Active reviews | 72 | **36** |
| Distinct identities | 36 | **36** |
| Duplicate surplus | 36 | **0** |
| Published events | 0 | **0** |
| Other sources affected | 0 | **0** |

**Deleted:** 36 duplicate import records + 36 duplicate reviews (IDs in `_bootshaus_dedup_cleanup_commit_result.json`).  
**Kept:** 36 keeper records + 36 keeper reviews (newest per external identity).  
**Relinks:** 0 (keepers already pointed to keeper records).

### `event_match_evaluations` impact

| Metric | Value |
|--------|-------|
| Total for Bootshaus source | 72 |
| `import_record_id` NULL after delete | **36** (ON DELETE SET NULL on duplicate records) |
| Evaluations deleted | **0** |

**Artifact:** `docs/real-data/_bootshaus_dedup_cleanup_commit_result.json`

---

## Phase 8 — Tests

### New tests (10/10 pass)

- `sprint268-bootshaus-data-quality.test.ts` — defaults, normalize, trust score, upsert
- `sprint268-pre-publish-idempotency.test.ts` — review queue dedup
- `sprint268-bootshaus-data-quality-migration.test.ts` — migration content

### Full suite

| Metric | Value |
|--------|-------|
| Total tests | 1087 |
| Passed | 1043 |
| Failed | **44** (pre-existing, unchanged scope) |
| Failed files | 9 (entity alias store, admin events, contributor create, production integration) |

Representative pre-existing failure: `Entity alias store is not initialized` in production integration tests.

### Lint / typecheck

- **Lint:** 0 errors (warnings only)
- **Typecheck:** Sprint 26.8 files clean; pre-existing errors in `scripts/operations/_bootshaus-go-live-run.ts`

---

## Phase 9 — Controlled live retry

| Step | Status |
|------|--------|
| Canonical entity repair `20260758000000` | **Applied** (2026-07-29) |
| Cleanup SQL preview (ROLLBACK) | **Passed** |
| Cleanup SQL COMMIT | **Executed** (2026-07-29) — 72→36 |
| Import run 1 (post-fix) | **Not executed** |
| Import run 2 (idempotency test) | **Not executed** |
| Idempotency on live | **Not validated** |

---

## Phase 10 — Discovery

| Check | Status |
|-------|--------|
| Bootshaus events public | **No** (0 `event_source_references`) |
| Backend Discovery API | Not re-tested post-fix |
| UI Discovery | Not re-tested post-fix |

---

## Phase 11 — Remaining risks

| Risk | Severity |
|------|----------|
| Live idempotency unproven until re-import | Hoch |
| Unique indexes not yet created | Mittel |
| 36 `event_match_evaluations` with NULL `import_record_id` | Niedrig (expected, non-blocking) |
| No cron deployment | Hoch (out of sprint scope) |
| 44 pre-existing test failures | Mittel (unrelated) |
| Publish/Discovery not validated post-fix | **Kritisch** |

---

## Final answers

1. **Ist die Bootshaus-Datenqualität ausreichend?**  
   **Code: ja** (defaults + normalize). **Live: teilweise** — canonical venue + defaults live; bestehende 36 Records noch mit alter Normalisierung.

2. **Ist der Import vor und nach dem Publish idempotent?**  
   **Code: ja** (upsert + review dedup). **Live: unbewiesen** bis kontrollierter Re-Import.

3. **Sind exakt die erwarteten Bootshaus-Events öffentlich?**  
   **Nein** — 0 veröffentlicht.

4. **Ist Bootshaus technisch für den automatischen Cron bereit?**  
   **Teilweise** — Dedupe + Canonical Repair done; Publish-Pfad noch nicht live validiert, Cron **nicht aktiv**.

5. **Kann danach AFFENKÄFIG GO-LIVE beginnen?**  
   **Nein** — Bootshaus End-to-End Publish/Discovery zuerst abschließen.

### Verdict: **CONDITIONAL GO**
