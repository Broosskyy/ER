# QA Import Results

**Sprint:** FIRST REAL SOURCES + IMPORT VALIDATION  
**Date:** 2026-07-26  
**Environment:** Local / Vitest + fixture-driven connectors

## QA flow

```
Quelle → Import → Normalisierung → Review → Freigabe → Consumer → Update → Archivierung
```

---

### 1. Quelle (Source)

| Source | Connector | Result |
|--------|-----------|--------|
| Manual reference | `manual_reference` | ✅ Reference Night loaded |
| Club website | `club_website` | ✅ Club Night Berlin from JSON-LD |
| Organizer website | `organizer_website` | ✅ Organizer Showcase loaded |
| ICS/iCal | `ical_feed` | ✅ iCal Party loaded |
| Open data API | `open_data_api` | ✅ Open Data Festival loaded |

**Test:** `source-connectors.test.ts` (5 tests)

---

### 2. Import

| Check | Result |
|-------|--------|
| `ImportAggregationService.runFromSourceRecord()` creates job | ✅ |
| Job status `completed` / `completed_with_warnings` | ✅ |
| Records persisted via `createMany` | ✅ |
| `ImportOperationsService` routes to aggregation for supported types | ✅ |
| Legacy orchestrator unchanged for other paths | ✅ |

**Test:** `import-aggregation-service.test.ts`, `import-acceptance.test.ts`

---

### 3. Normalisierung

| Field | Mapped | Result |
|-------|--------|--------|
| Title | ✅ | Present on canonical event |
| Subtitle | ✅ | Extended normalizer |
| Description | ✅ | |
| Start / End | ✅ | ISO dates |
| Venue / City / Country | ✅ | |
| Genres / Artists | ✅ | |
| Organizer | ✅ | |
| Tickets / Images | ✅ | |
| Source / Import-ID / Original link | ✅ | |

**Test:** `normalize-step.test.ts`, `canonical-event-mapper.test.ts`, `aggregation-pipeline.test.ts`

---

### 4. Review (Admin)

| Check | Result |
|-------|--------|
| Valid events → `needs_review` status | ✅ |
| Invalid events → `invalid` status | ✅ |
| Review queue lists source + status | ✅ |
| Detail shows source provenance section | ✅ |
| Edit preserves raw payload | ✅ |

**Test:** `import-review.test.ts`, `import-acceptance.test.ts`

---

### 5. Freigabe (Approve)

| Check | Result |
|-------|--------|
| Approve creates event | ✅ |
| Event status `published` | ✅ |
| `resultingEventId` linked on record | ✅ |
| Audit log `record_approved` | ✅ |
| Consumer repository refreshed | ✅ |

**Test:** `import-aggregation-service.test.ts` (approve + refresh), `import-review.test.ts`

---

### 6. Consumer

| Screen | Mechanism | Result |
|--------|-----------|--------|
| Home | `EventRepository` published events | ✅ No UI changes |
| Events | Same repository | ✅ |
| Search | Same repository | ✅ |
| Saved | Same repository | ✅ |
| Map | Same repository | ✅ |
| Event Detail | Same repository | ✅ |

Consumer screens use existing `EventRepository.refresh()` after approve — no special import handling.

---

### 7. Update

| Scenario | Result |
|----------|--------|
| Description change detected | ✅ `ImportUpdateService` |
| Date change detected | ✅ |
| Ticket URL change detected | ✅ |
| Re-import marks `updatedCount` in metrics | ✅ |
| No duplicate event created | ✅ |

**Test:** `import-update-service.test.ts`

---

### 8. Archivierung

| Scenario | Result |
|----------|--------|
| Event removed from source feed | ✅ Archived (not deleted) |
| `AGGREGATION_EVENT_ARCHIVED` logged | ✅ |
| Cancelled iCal event flagged | ✅ `cancelled` change type |
| Published event status → `archived` | ✅ |

**Test:** `import-aggregation-service.test.ts` (archive scenario), `import-update-service.test.ts`

---

## Automated test summary

```
Typecheck:  pass
Tests:      735+ pass (143 files)
New tests:  source-connectors, import-update-service, import-aggregation-service
```

## Manual QA checklist (admin)

- [ ] `/admin/sources` — source list shows last import
- [ ] `/admin/imports` — job appears after manual import
- [ ] `/admin/imports/review` — pending records visible
- [ ] `/admin/imports/review/[id]` — provenance section populated
- [ ] Approve record — event visible in consumer app after refresh

## Out of scope (not tested)

- Live HTTP fetching to external URLs (fixtures used)
- Instagram / Facebook / social connectors
- Scheduled/cron imports
- Image HTTP reachability checks
