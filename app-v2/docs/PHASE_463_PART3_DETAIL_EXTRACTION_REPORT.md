# Phase 4.6.3 Part 3 — Detail Extraction, Ticket Phases & Event Data Completeness

**Date:** 2026-08-02  
**Scope:** Import pipeline detail extraction only (no new sources, no public UI redesign)

---

## Executive summary

Part 3 implements **Ticket Kings detail-page extraction**, **Ticket.io blocked-detail preservation**, **structured lineup/snapshot domain models**, and **detail fetch in the ticket platform connector** for `ticket_king` sources. Production re-import remains **read-only planned** until explicit approval.

---

## 1. Detail-page inventory

Artifact: `docs/real-data/_phase463_detail_page_inventory.json`  
Script: `scripts/operations/_phase463-detail-page-inventory.ts`

Active production connectors documented: Bootshaus website, Bootshaus Ticket.io, Affenkäfig website, Proton/Lehmann/Area51/Technodampfer/HMG Ticket.io.

---

## 2. Ticket.io Info-tab results

| Area | Status |
|------|--------|
| Detail HTML parser | Existing `ticket-io-detail-parser.ts` |
| PoW guard | Blocks parse; adapter **no longer applies empty blocked enrichment** over list data |
| Snapshot preservation | `mergeDetailWithPreviousSnapshot()` retains prior lineup when fetch blocked |
| Live production | PoW still limits live detail — historical snapshots required |

---

## 3. Ticket Kings extraction

| Area | Status |
|------|--------|
| Detail parser | **New** `ticket-kings-detail-parser.ts` |
| HTML lineup (`<ul>` after Line Up) | **Implemented** — B2B/F2F role detection |
| Organization performer filter | **Implemented** — JSON-LD `performer: Organization` rejected |
| Genre / floor / labeled fields | **Implemented** from `<strong>` labels |
| Detail fetch in pipeline | **Implemented** in `ticket-platform-fetch.ts` |
| Regression (MDMA fixture) | 9+ lineup entries, checkout id `24` |

**Sommerfest:** List JSON-LD still has `performer: Organization`; detail fetch + HTML parser required for full lineup/genres (3 floors mentioned in description text — floor regex extracts from detail HTML).

---

## 4. Lineup model

| File | Purpose |
|------|---------|
| `structured-lineup.ts` | Completeness states, `StructuredLineupEntry` |
| `lineup-artist-quality.ts` | Extended placeholders (Location, Organization, Floors, Genre, …) |
| `import-lineup-from-record.ts` | `ticket_kings_html` as structured source |

Completeness states: `complete`, `partial`, `title_inferred_only`, `blocked_detail_fetch`, `unavailable`.

---

## 5–6. Timetable & running order

Domain types in `event-structured-detail.ts` (`TimetableSlotEntry`, `RunningOrderEntry`).  
**Extraction parsers not wired** — no structured timetable evidence in current fixtures beyond future website work.

---

## 7–8. Ticket phases & availability

Existing `canonical-ticket-phase.ts` pipeline unchanged; multi-offer JSON-LD from accessible Ticket.io detail pages maps to phases via `normalizeTicketOffersFromCandidate`.  
`deriveTicketStatusFromPhases` derives event-level status from phase availability (not URL-only boolean).

---

## 9–10. Structured event details & attributes

`event-structured-detail.ts` — `SourcedEventAttribute`, `StructuredEventDetailSections`.  
Ticket Kings parser emits `minimumAge`, `doorsOpenAt`, `floorCount`, `venueEnvironment`, `eventAttributes`.

---

## 11. Genre recovery

Ticket Kings labeled `<strong>Genre</strong>` fields merged with JSON-LD/list genres in adapter.

---

## 12–13. Venue/Organizer enrichment & multi-origin merge

No new entity DB writes in this pass; detail fields flow through `sourceMetadata` → publish mapper / field-trust merge (existing path).  
Ticket.io blocked detail no longer downgrades list-derived fields.

---

## 14. Detail snapshot versioning

`detail-snapshot.ts` — `buildDetailSnapshot`, `mergeDetailWithPreviousSnapshot`, content hash.  
Stored in import metadata via existing `detailEnrichment` + future `detailSnapshot` extension.

---

## 15–17. Health metrics, admin review, regressions

| Case | Status |
|------|--------|
| TK MDMA detail fixture | **Pass** — full lineup |
| Organization artist | **Blocked** |
| PoW preservation | **Tested** |
| Sommerfest | **Pending** detail HTML fixture / live fetch |
| LEVI, ELY OAKS, PLAY!, Technodampfer | **Pending** production re-import |

Admin detail review UI — not expanded in this pass (ops scripts + metadata).

---

## 18–19. Production reimport

Read-only plan: `docs/real-data/_phase463_detail_reimport_plan.json`  
**Not executed** — requires explicit approval per project rules.

---

## 20. Tests & build

| Check | Result |
|-------|--------|
| `typecheck:app` | Pass |
| `phase463-detail-extraction.test.ts` | 6 pass |
| `ticket-kings-adapter.test.ts` | 4 pass |

---

## Remaining limitations

1. Ticket.io PoW in production — legitimate access blocker  
2. Timetable/running order — domain only, no parsers  
3. Sommerfest full regression — needs detail page fetch or fixture  
4. Admin per-field review UI — future sprint  
5. Controlled production re-import — **not run**

---

## Go / no-go

**Implementation GO** for code merge.  
**Production data GO** only after approved two-pass re-import (`_phase462-production-activation.ts` or Phase 4.6.3 detail refetch).
