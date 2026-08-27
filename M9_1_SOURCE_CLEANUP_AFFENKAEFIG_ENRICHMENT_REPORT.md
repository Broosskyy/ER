# M9.1 Source Cleanup + Affenkäfig Enrichment Report

**Staging:** `gnkjzinwvmrxcadwebhv`  
**Production:** `irgsllewfrxvbtznqmxh` — not touched  
**Branch:** `rebuild/event-core-clean`  
**Commit base:** `6aff77d`

---

## 1. Preflight

| Item | Value |
|------|-------|
| Branch | `rebuild/event-core-clean` |
| Local HEAD | `6aff77d` (pre-change) |
| Remote HEAD | `6aff77d` (aligned) |
| Registry before | bootshaus, affenkaefig, nachtresidenz, stadtgarten, zakk |
| Future consumer events before | 66 published |
| Official bindings before cleanup | 65 official + ticket rows on future events |

---

## 2. Removed Sources

Unregistered from active pipeline (connector code retained in repo for future re-expansion, not default-registered):

- `nachtresidenz-official`
- `stadtgarten-official`
- `zakk-official`

Shared utilities (e.g. `shared/month-calendar-urls.ts`) **kept** — used by Stadtgarten connector tests and future re-enable.

---

## 3. Removed Source Bindings

Fail-closed cleanup (`scripts/cleanup-m9-1-source-scope.ts`):

- **34 canonical events deleted** (sole official binding to removed sources)
- **0 multi-source events** required binding-only removal
- **0 uncertain** events (no auto-delete on ambiguous ownership)

Breakdown of deleted events:

| Source | Events removed |
|--------|----------------|
| nachtresidenz-official | 12 |
| stadtgarten-official | 9 |
| zakk-official | 13 |

---

## 4. Removed Canonical Events

All 34 were **class A** (exclusive binding to removed source). No Bootshaus or Affenkäfig consumer events deleted.

---

## 5. Preserved Multi-Source Events

`multiSourceEventsPreserved = 0` (no cross-source official bindings existed for removed connectors beyond exclusive rows).

Bootshaus **AFFENKÄFIG RULES // BOOTSHAUS KÖLN** remains a single Bootshaus consumer event; Affenkäfig listing stayed `review_required` (not merged).

---

## 6. Consumer Cleanup

After cleanup: **31** future `published` consumer events (25 Bootshaus + 6 Affenkäfig).

Removed sources no longer appear in consumer read path (`event-core-read.ts`).

---

## 7. Affenkäfig Evidence Audit (Root Cause)

| Field | Underland @ source | Parser before | After enrichment |
|-------|-------------------|---------------|------------------|
| Description | Empty JSON-LD + empty content div | missing | **source_not_announced** (`description_missing` gap) |
| Line-up | No HTML lineup section; roster on flyer image | `lineup_not_announced` | **OCR from official flyer** (`UNDERLAND, ARLY, BIRD`) |
| Genres | Not published per-event on Affenkäfig | `genres_missing` | still **no explicit per-event genres** (correct) |
| Image | og:image + JSON-LD | persisted | present |
| Ticket URL | ticketkings + JSON-LD offers | parsed | present (M6 separate) |

**Root cause:** Most gaps were **source HTML empty** (description) or **lineup only on flyer image** (not HTML). Not reconciliation loss. Genres are not published per-event on Affenkäfig listings.

---

## 8. Enrichment Implementation

- Enabled **media enrichment** on `AffenkaefigOfficialConnector` (same pipeline as Bootshaus OCR).
- `parse-detail.ts`: `description_missing`, `lineup_media_required` when flyer exists without HTML lineup; JSON-LD ticket `offers.url` fallback.
- `build-affenkaefig-media-evidence.ts`: media context + noise terms.

---

## 9. Underland Golden Case

| Field | Status |
|-------|--------|
| Description at source | **not published** → `description_missing` |
| Line-up at source | **flyer image only** → OCR lineup persisted (3 acts) |
| Genres at source | **not published** → `genres_missing` |
| Consumer after apply | Image, venue, organizer, ticket link, partial lineup |

---

## 10. All Affenkäfig Events (post-apply readback)

| Event | Description | Line-up | Genres | Image | Venue | Organizer | Ticket |
|-------|-------------|---------|--------|-------|-------|-----------|--------|
| 14 Jahre Affenkäfig | present | present (13 HTML acts) | source_not_announced | present | present | present | linked |
| Affenkäfig xxx A8 | source_not_announced | `Folgt` (announced placeholder) | source_not_announced | present | present | present | linked |
| Affenkäfig XXX CAPITOL | source_not_announced | `Folgt` | source_not_announced | present | present | present | linked |
| Halloween Weekender | present (OCR) | present (OCR, noisy) | source_not_announced | present | present | present | linked |
| MDMA 10.10.26 | source_not_announced | present (OCR, noisy) | source_not_announced | present | present | present | linked |
| Underland 05.09. | source_not_announced | present (OCR) | source_not_announced | present | present | present | linked |

---

## 11. Cross-Source Behavior

- **AFFENKÄFIG RULES // BOOTSHAUS KÖLN:** Affenkäfig sync → `review_required` vs existing Bootshaus event (datetime drift ~23h). **Not merged** (per instruction).
- No duplicate consumer events created for other Affenkäfig rows.

---

## 12. AFFENKÄFIG RULES Review

Remains `identityDecision: review_required`, `same_calendar_day_outside_drift`, matched Bootshaus event `96dda961…`. No merge applied.

---

## 13. Ticket Freeze

| Metric | Value |
|--------|-------|
| ticketRowsChanged | 0 |
| ticketPricesChanged | 0 |
| ticketUrlsChanged | 0 |
| ticketStatusesChanged | 0 |

Surviving-event ticket rows unchanged after cleanup + Affenkäfig apply.

---

## 14. Bootshaus Regression

`bootshausDryRunAppliedWrites = 0` after Affenkäfig gate.

---

## 15. Test Seed

`Eternal Rave Core Test` → status set to **`draft`** (no longer on future published consumer feed). M2 test SQL fixtures unchanged.

---

## 16. Tests

- `npm run test:connectors` — 170 passed
- `npm run test:ingestion` — 74 passed
- New Underland golden fixture + registry scope tests updated

---

## 17–19. Staging / Consumer Readback

- Affenkäfig apply: `firstRunConsumerWrites = 3` (Underland, MDMA, Halloween Weekender safe updates)
- `secondRunConsumerWrites = 0`
- Consumer count: 31 future published events

---

## 20. Commit / Push

See git log after push to `origin/rebuild/event-core-clean`.

---

## Abschlusszähler

```
productionMutations = 0

sourcesBefore = 5
sourcesAfter = 2

nachtresidenzEventsRemoved = 12
stadtgartenEventsRemoved = 9
zakkEventsRemoved = 13

multiSourceEventsPreserved = 0
uncertainEventsNotDeleted = 0

consumerEventsBefore = 66
consumerEventsAfter = 31

affenkaefigEvents = 6
affenkaefigDescriptionsPresent = 2
affenkaefigLineupsPresent = 6
affenkaefigGenresPresent = 0
affenkaefigImagesPresent = 6

underlandDescriptionPresent = false
underlandLineupPresent = true
underlandGenresPresent = false

testSeedConsumerVisible = false

bootshausRegression = 0

ticketRowsChanged = 0
ticketPricesChanged = 0
ticketUrlsChanged = 0
ticketStatusesChanged = 0

secondAffenkäfigRunConsumerWrites = 0

scheduledSources = 2

finalStatus = M9_1_SOURCE_SCOPE_CLEANED_AND_AFFENKAEFIG_ENRICHED
```

**M9_1_SOURCE_SCOPE_CLEANED_AND_AFFENKAEFIG_ENRICHED**
