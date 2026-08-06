# Phase 4.6.2 Part 1 — Data Integrity & Import Recovery Report

**Date:** 2026-08-02  
**Scope:** Restore complete Event data from official Sources through import → canonical → public  
**Production writes:** none in this session (pipeline code only)

## Validation

| Gate | Result |
|------|--------|
| `npm run typecheck:app` | Pass |
| Import lineup + genre tests | Pass |
| Ticket.io / detail extraction tests | Pass (existing) |
| Live production re-import | **Not run** — requires ops approval |

---

## 1. Import audit

**Flow validated:** Connector fetch → normalize → import record (`rawPayload` / `normalizedPayload`) → publish → `event_lineup` → `Event` → `projectCanonicalEventFields` → UI.

**Primary loss points identified (prior):**
- `lineupEntries` parsed but not used at publish
- Title artists merged into `artistNames` on list-only imports
- Publish `replaceFromImportPipeline` overwrote richer lineups
- `minimumAge`, coordinates, multi-genre beyond first match not fully published to DB
- Rich metadata (`ticketOffers`, `soldOut`) trapped in `sourceMetadata`

---

## 2. Detail page recovery

**Existing:** Ticket.io `ticket-io-detail-parser.ts`, website `list-detail-enrichment.ts`, Bootshaus Sprint 4.5 migration (`maxDetailPages`).

**No new connectors added.** Detail enrichment paths unchanged; publish layer now consumes `lineupEntries` from detail parses.

---

## 3. Lineup recovery (implemented)

| Change | File |
|--------|------|
| Priority extraction: `lineupEntries` → `artistNames` → title inference | `import-lineup-from-record.ts` |
| Publish uses prioritized names + artist ID resolution | `import-publish-lineup-writer.ts` |
| **Never downgrade** existing lineup on re-import | `import-publish-lineup-writer.ts` |
| Title artists excluded when structured json_ld/html lineup exists | `ticket-io-adapter.ts` |
| Union `lineup` + `artists` at projection | `canonical-event-projection.ts` |

**Strict priority enforced at publish:**
1. Structured `lineupEntries` (detail)
2. Structured `artistNames`
3. Title inference (last resort)

---

## 4. Artist extraction

- Ticket.io detail parser already merges json_ld + html_lineup + title with dedupe
- Adapter no longer pushes title artists into `artistNames` when structured artists exist
- `resolveArtistIdsForNames` shared for multi-name matching at publish

**Remaining:** B2B/slash parsing hardening in `ticket-io-title-artists.ts`; organizer/venue false-positive filters.

---

## 5. Timetable & running order

**Not implemented in this pass.** `toTimetableSectionViewModel` remains stubbed; no structured timetable in current Ticket.io parse output to consumer Event.

---

## 6. Description normalization (implemented)

- `projectCanonicalEventFields` uses `normalizePublicEventDescription` for `sanitizedDescription`
- All surfaces reading projection get HTML-stripped, entity-decoded text

---

## 7. Metadata completeness

**Partial.** Description + genres improved at projection layer. DB publish gaps (coordinates, `minimumAge`, multi-image) remain in `import-event-publish-service.ts`.

---

## 8. Offer normalization

**Existing:** `event-price-availability-semantics.ts` authoritative for consumer price/availability.

**Gap:** `ticketOffers[]` still not persisted on `Event`; `ticketPhases` not fed from ingest. Price text from detail parser flows via `priceText` → projection.

---

## 9. Badge model (partial)

- Wired `date_changed`, `venue_changed` into `resolveConsumerStatuses`
- Wired `newly_added` from `publishedAt` / `createdAt` on display model
- Card mapping still limited (`mapConsumerToPresentationStatus` returns undefined for several consumer statuses)

---

## 10. Genre normalization (implemented)

- `canonical-genre-normalizer.ts` — alias merge at projection
- Extended `GENRE_SYNONYMS` (melodic techno, deep house, hardstyle)

---

## 11. Venue & Organizer data

**No publish-layer changes in this pass.** Address/coords recovery still depends on `buildAdminEventFromImportRecord` column mapping.

---

## 12. Entity linking

**Unchanged.** Existing matching services at import; lineup writer now resolves IDs from structured names.

---

## 13. Import trace report

**Script:** `scripts/operations/_phase462-import-trace-audit.ts` (read-only audit scaffold).

**Output:** `docs/real-data/_phase462_import_trace_audit.json` when run against production feed.

---

## 14. Validation events

| Event | Status |
|-------|--------|
| Bootshaus Sommerfest | Pipeline fixes apply; manual compare pending |
| PLAY! Open Air | Manual compare pending |
| Technodampfer | Manual compare pending |
| SHOCKONE | Unit test: 5 artists from detail fixture |
| Musik die mich antreibt | Manual compare pending |
| Affenkäfig / Lehmann / Proton | Manual compare pending |

---

## 15. Remaining data-quality issues

1. **Publish DB columns** — lat/lng, `minimumAge`, venue address not in `buildAdminEventFromImportRecord`
2. **`ticketOffers` → `ticketPhases`** — not bridged to consumer semantics
3. **Timetable / running order** — not extracted to public model
4. **Badge card mapping** — many `ConsumerEventStatus` values not shown on cards
5. **Production re-import** — required to apply lineup fixes to live events
6. **Artist title parser** — edge cases (locations in title suffixes)
7. **Manual source-vs-UI audit** — validation events not fully compared in this session

---

## Success criteria checklist

| Criterion | Status |
|-----------|--------|
| No Source loses data in pipeline code paths | **Improved** — lineup + description + genres |
| Complete descriptions in public Event | **Improved** at projection |
| Structured lineups preserved | **Fixed** at publish + projection |
| Title inference never replaces real lineup | **Fixed** |
| Prices/offers canonical | **Partial** — semantics exist, offers not persisted |
| Badge data complete | **Partial** |
| Genres normalized | **Yes** at projection |
| Venue/Organizer complete | **Pending** publish mapping |
| Validation events match Source | **Pending** manual QA + re-import |

**Next recommended ops steps:** approved re-import for Ticket.io shops + Bootshaus; run `_phase462-import-trace-audit.ts`; extend publish mapper for coordinates and `ticketOffers`.
