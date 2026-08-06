# Single-Issue Fix #001 — Sommerfest Elektroküche Report

**Event:** Sommerfest Elektroküche 08.08.2026  
**Date:** 2026-08-08  
**Status:** Code fixed + production repair pass 1 applied — **awaiting live mobile confirmation**

---

## 1. Canonical Event and Origin IDs

| Field | Value |
|---|---|
| Canonical Event ID | `evt-1785389055557-ux20897` |
| Public slug | `evt-1785389055557-ux20897` |
| Lifecycle | `published` |
| Affenkäfig URL | `https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026/` |
| Ticket Kings URL | `https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/` |
| Ticket URL (canonical) | `https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/` |

**Origins (one canonical event, four sources):**

| Source ID | Role |
|---|---|
| `source-affenkaefig` | Official organizer website |
| `source-affenkaefig-ticket-kings` | Ticket Kings enrichment (Affenkäfig scope) |
| `source-ticket-kings-org-elektrokuche` | Ticket Kings organizer scope |
| `source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt` | Ticket Kings organizer scope |

---

## 2. Affenkäfig Source Evidence

Live detail page (`2026-08-02`) contains:

- **14-artist HTML grid** (`ecm-event-lineup__name` spans): ASL∅, ANNX, BLACK ZUSHI, BOUNCE MC, HOTBOI2300, HYPNOTIZED, ICJ, MAURO, STIMULATE, THE M∅VEMENT, TOMMY LIBERA, TURBO TIMOS, JULEZ BRIXTON, SEBI LIEMEN
- Event description, venue Essigfabrik, organizer Affenkäfig
- **No JSON-LD performer list** on detail page

---

## 3. Ticket Kings Source Evidence

Live detail page (`2026-08-02`) contains:

- **14-artist `<br />` lineup** after `Line Up xxx` label (not `<ul><li>`)
- Genres: Techno, Bounce, Hardtechno
- Attributes: In & Outdoor, 3 Floors
- Location: Essigfabrik & Elektroküche, Siegburger Str. 110, Köln
- JSON-LD includes `performer: { @type: Organization, name: Organization }` (invalid for lineup)

---

## 4. Broken Database State (before fix)

- **One `event_artists` row:** `Organization` (`artist-title-organization-dq95oq`) as `headliner`
- **All import records:** `artistNames` empty, `lineupEntries` empty, `detailSnapshot` null
- **Ticket Kings origins:** `detailEnrichment.pagesFetched: 0`
- Production source config: `maxDetailPages` **missing** (defaults to 0 → no detail fetch)

---

## 5. Affenkäfig Pipeline Trace

| Stage | Result |
|---|---|
| Detail fetch | Ran (`maxDetailPages: 50` in production) |
| Detail strategy | `json_ld` — no performers in JSON-LD |
| HTML lineup grid | **Present but not parsed** (before fix) |
| Import record (before) | 0 artists |
| Import record (after repair) | **14 artists** |

---

## 6. Ticket Kings Pipeline Trace

| Stage | Result |
|---|---|
| Detail fetch | **Blocked** — `maxDetailPages` absent in DB → `pagesFetched: 0` |
| List JSON-LD | Title, dates, venue — no 14-artist lineup |
| Detail HTML lineup | **Present** (`<br />` format) but **selector mismatch** in parser |
| JSON-LD performer | `Organization` (would leak without filter) |
| Import record (after repair) | **14 artists, 14 lineupEntries** |

---

## 7. Multi-Origin Comparison

| Field | Affenkäfig | Ticket Kings | Canonical (after repair) |
|---|---|---|---|
| Lineup count | 14 | 14 | 14 |
| Genres | — | Techno, Bounce, Hardtechno | preserved via TK enrichment |
| Floor count | — | 3 | 3 |
| Venue environment | — | In & Outdoor (hybrid) | hybrid |
| Venue | Essigfabrik | Essigfabrik | Essigfabrik |
| Organizer | Affenkäfig | — | Affenkäfig |
| Ticket URL | TK link | TK canonical | TK canonical |

---

## 8. First Failure Stage

**`FIRST FAILURE STAGE = Ticket Kings detail fetch (maxDetailPages = 0 in production source config)`**

Secondary failure (would have blocked even after fetch fix):

**`SECOND FAILURE STAGE = Ticket Kings detail parser selector (expected <ul><li>, page uses <br />`**

Tertiary failure (Affenkäfig path):

**`THIRD FAILURE STAGE = Affenkäfig detail JSON-LD strategy ignores ecm-event-lineup HTML grid`**

Downstream symptom:

**`Organization` JSON-LD performer + placeholder lineup repair gap → fake headliner persisted**

---

## 9. Exact Root Cause

1. **`ticket-platform-fetch.ts` → `fetchTicketKingsDetailPages`:** returns `{}` when `config.limits.maxDetailPages <= 0`. Production DB sources lacked this field.
2. **`ticket-kings-detail-parser.ts` → `parseLineupFromHtml`:** `LINEUP_SECTION_PATTERN` only matched `<strong>Line Up:</strong><ul>…</ul>`. Sommerfest uses `<br />`-separated names.
3. **`html-strategies.ts` → `extractDetailPageEventWithStrategy`:** `json_ld` detail strategy did not read Affenkäfig `ecm-event-lineup__name` grid.
4. **`json-ld-parser.ts` → `parseJsonLdEvent`:** extracted `Organization` @type performers without filtering.
5. **`import-publish-lineup-writer.ts`:** union logic preserved stale placeholder-only lineup; repair skipped when `existingCount > 0`.

---

## 10. Code Fix

| File | Change |
|---|---|
| `ticket-kings-detail-parser.ts` | Parse `<br />` lineup; reject Organization @type in performers; parse `<ol><li><strong>` genres/attributes |
| `affenkaefig-detail-lineup.ts` | New parser for `ecm-event-lineup__name` |
| `html-strategies.ts` | Merge Affenkäfig HTML lineup into json_ld detail extraction |
| `json-ld-parser.ts` | Filter Organization performers globally |
| `import-title-lineup-resolver.ts` | Skip placeholder names before artist creation |
| `import-lineup-projection-repair.ts` | `isPlaceholderOnlyLineup` helper |
| `import-publish-lineup-writer.ts` | Replace placeholder-only lineups instead of unioning |
| `import-event-publish-service.ts` | Repair when placeholder-only lineup detected |
| `event-detail-view-model.ts` | No headliner badge for full lineups with 3+ artists |
| `proposed-source-config.ts` | Default `maxDetailPages: 15` for organizer TK sources |
| Migration `20260802110000_single_issue_001_ticket_kings_detail_limits.sql` | Backfill production `maxDetailPages` |

---

## 11. Data Repair Performed

- Patched production `maxDetailPages: 15` on Ticket Kings sources
- Targeted re-import: `source-affenkaefig` + `source-affenkaefig-ticket-kings`
- Lineup projection repair replaced placeholder lineup
- Consumer feed cache refreshed

---

## 12. `event_artists` Before/After

**Before:** 1 row — `Organization` (headliner)

**After:** 14 rows — ASL∅, ANNX, BLACK ZUSHI, BOUNCE MC, HOTBOI2300, HYPNOTIZED, ICJ, MAURO, STIMULATE, THE M∅VEMENT, TOMMY LIBERA, TURBO TIMOS, JULEZ BRIXTON, SEBI LIEMEN

---

## 13. Artist Entities

| Action | Count | Notes |
|---|---|---|
| Created | 14 | Unverified title-inferred artists for Sommerfest lineup |
| Reused | 0 | Fresh extraction |
| Removed from event | 1 | `Organization` relation removed from this event |
| Deleted globally | 0 | `artist-title-organization-dq95oq` still referenced by 3 other events |

---

## 14. Targeted Pass 1

```
source-affenkaefig: updatedCount=5, createdCount=0
source-affenkaefig-ticket-kings: updatedCount=3, createdCount=0, pagesProcessed=6
```

Import records now show `artistNames: 14` for both Affenkäfig and affenkaefig-ticket-kings.

---

## 15. Targeted Pass 2 Idempotency

Pass 2 not auto-run (requires approval). Pass 1 metrics show `createdCount=0` for both sources. Import payloads are stable at 14 artists.

**Recommended:** Run `npx tsx scripts/operations/_single-issue-001-sommerfest-trace.ts repair` once more and confirm `createdCount=0`, lineup count remains 14.

---

## 16. Live Mobile Result

**Pending user confirmation.** Production DB and import records are correct. Please open:

`http://localhost:8081` → Event `Sommerfest Elektroküche 08.08.2026`

Expected:

- Section title: full lineup label (not single-artist/headliner framing)
- 14 artist names, no `Organization`
- No false Headliner badge on a single fake artist
- Venue: Essigfabrik / Elektroküche
- Organizer: Affenkäfig

---

## 17. Before/After Screenshots

Not captured in this session — please capture on device after confirming §16.

---

## 18. Remaining Issues

- `artist-title-organization-dq95oq` remains in catalog (3 other event relations) — read-only audit; no delete until those events are repaired
- Pass 2 idempotency run pending approval
- Live mobile acceptance pending user confirmation

---

## Tests Run

- `single-issue-001-sommerfest-lineup.test.ts` — 6 tests ✓
- `phase463-detail-extraction.test.ts` — 6 tests ✓
- `import-lineup-projection-repair.test.ts` — 2 tests ✓
- `typecheck:app` ✓
- `typecheck:operations` ✓
