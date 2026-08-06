# Root Cause Evidence Audit

**Generated:** 2026-08-03  
**Mode:** READ-ONLY forensic investigation — no repairs, no code changes, no production writes  
**Corpus:** 108 published events (`_phase469_global_event_trace_matrix.json`, audit run 2026-08-03T09:08:50Z)

## Evidence sources

| Artifact | Role |
|----------|------|
| `docs/real-data/_phase469_global_event_trace_matrix.json` | Per-event pipeline trace (raw → normalized → DB → API) |
| `docs/real-data/_phase469_representative_traces.json` | 8-stage pipeline dumps for reference events |
| `docs/real-data/_phase4693_api_consistency.json` | API vs UI projection parity |
| `docs/real-data/root_cause_matrix.json` | Field-level classification for 66 incorrect events |
| `docs/real-data/event_pipeline_traces.json` | Reference event bundles |
| `docs/real-data/lineup_trace.json` | Lineup presence/absence per stage (all 108 events) |
| `docs/real-data/ticket_url_trace.json` | Shop-root / missing per-event ticket URLs (41 flagged) |
| `docs/real-data/source_isolation_matrix.json` | Progressive origin simulations |

---

## Global metrics (fresh audit)

| Metric | Value |
|--------|-------|
| Published events | 108 |
| Pipeline healthy | 42 |
| Incorrect / flagged | 66 |
| Structured lineup present | 72 |
| Structured lineup absent | 36 |
| Structured/legacy mismatch | 20 |
| Detail-blocked origins | 54 events |
| Contamination suspects | **0** (post P0 repair) |
| API projection mismatches | 18 |
| Prose primary_artist fallbacks | **0** (post 4.6.9.3) |

### Internal audit class → user taxonomy mapping

| Internal (`_phase469`) | Count | User taxonomy |
|------------------------|-------|---------------|
| `H_TITLE_INFERENCE_PROMOTED` | 21 | `IMPORT` |
| `C_DETAIL_SOURCE_INACCESSIBLE` | 21 | `EXTERNAL_BLOCKER` |
| `D_RAW_SOURCE_INSUFFICIENT` | 13 | `RAW_SOURCE_MISSING` |
| `G_DESCRIPTION_AS_LINEUP` | 6 | `CONNECTOR_EXTRACTION` |
| `R_SOURCE_NO_LINEUP` | 5 | `RAW_SOURCE_MISSING` |
| Collapsed HTML rejected at normalization | 6 events | `CONNECTOR_EXTRACTION` → `NORMALIZATION` |
| Shop-root ticket URL in source | 11 events | `CONNECTOR_EXTRACTION` (ticket field) |

---

## Reference event evidence chains

Each chain lists **actual stored values** at each stage. Stages with no failure are marked ✓.

---

### MDMA — `evt-1785389054496-ns9b6la`

**Verdict:** ✓ No remaining failure. Pipeline fully aligned.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `sourceId`: `source-affenkaefig`, connector: `organizer_website`, URL: `https://affenkaefig.info/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/`, `rawArtistNames`: `["DYSTOPIA F2F VALKYRIE","IAN CRANK F2F EASYPYSI",…,"PLEA5URE B2B PUL5E"]` (9 lines), `ticketUrl` in import: `https://ticketkings.de/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/` |
| **2 CONNECTOR OUTPUT** | `normalizedArtistNames`: 18 names after F2F/B2B split; `simulatedLineupEntriesCount`: 9 |
| **3 IMPORT RECORD** | `importRecordId`: `6e3a8a57-7544-401f-a047-3b9c0f6000d2`, status published |
| **4 MERGE** | Single origin; no conflicting candidates |
| **5 DATABASE** | `structuredEntryCount`: 9, billing: 5×F2F + 4×B2B, `legacyArtistNames`: 18, aligned |
| **6 PROJECTION** | `apiLineupEntryCount`: 9, `apiArtistNames` = structured names |
| **7 API** | `classification`: structured, `projectionMismatch`: false, 18 `apiArtists` |
| **8 UI** | `uiArtists` identical to `apiArtists` |

**Field classification:** none incorrect.

---

### Sommerfest — `evt-1785389055557-ux20897`

**Verdict:** Lineup content correct; **sort order differs** between structured and legacy (`STRUCTURED_STORAGE` ordering).

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | Origins: Affenkäfig website + 3 Ticket Kings sources. `rawArtistNames`: `["ASL∅","ANNX",…,"SEBI LIEMEN"]` (14). `ticketUrl`: `https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/` |
| **2 CONNECTOR** | `normalizedArtistNames`: same 14 names |
| **3 IMPORT** | 4 import records; `bestImportSourceId`: `source-affenkaefig-ticket-kings`, `detailPagesFetched`: 5 |
| **4 MERGE** | Multi-origin; winning lineup from Ticket Kings enriched import |
| **5 DATABASE** | `structuredEntryCount`: 14 (SOLO), `structuredArtistNames` order: `JULEZ BRIXTON, SEBI LIEMEN, ASL∅, …` vs `legacyArtistNames` order: `ASL∅, ANNX, …, SEBI LIEMEN` |
| **6–7 API** | 14 artists; names match legacy set |
| **8 UI** | Matches API |

**Field classification:**
- `lineup` (ordering): `STRUCTURED_STORAGE` — `modelConsistency`: `structured_wrong_legacy_correct`
- `lineup` (metadata): `firstFailureStage`: `7_normalized_candidate`, internal `D_RAW_SOURCE_INSUFFICIENT` (candidate metadata nuance; **not** missing artists)

---

### LEVI — `evt-1785339383539-0lxvjlp`

**Verdict:** Single artist `LEVI` is **title-inferred**, not from source lineup.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `source-bootshaus-koeln`, URL: `https://bootshaus.tv/events/nightswithus-presents-levi`, `rawArtistNames`: `[]`, `ticketUrl` in sourceUrls: `https://bootshaus.ticket.io/` (shop root) |
| **2 CONNECTOR** | `normalizedArtistNames`: `[]` |
| **3 IMPORT** | No lineup in candidate |
| **4 MERGE** | Title inference promoted |
| **5 DATABASE** | `structuredEntryCount`: 1, `structuredArtistNames`: `["LEVI"]`, `titleInferenceArtists`: `["LEVI"]`, `titleInferenceClass`: `series_name_mistaken` |
| **6–8** | API/UI show `LEVI` |

**Field classification:**
- `lineup`: `IMPORT` (`H_TITLE_INFERENCE_PROMOTED`, stage `18_title_inference_fallback`)
- `ticketUrl`: `CONNECTOR_EXTRACTION` — canonical source provides `https://bootshaus.ticket.io/` not per-event slug

---

### Into The Madness — `evt-1785339386612-rjr91mv`

**Verdict:** ✓ Empty lineup is **correct** post P0 decontamination. Raw source has collapsed names that never persisted.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | Origins: Bootshaus website + ticket.io + stale MDMA Ticket Kings URLs in `sourceUrls` history. `rawArtistNames`: `["Kili b2b Complex","RAN-DDEVIN WILDAVERSIONKILI b2b COMPLEXZELECTERRESTRICTLESS"]` |
| **2 CONNECTOR** | `normalizedArtistNames`: `["Kili","Complex","RAN-DDEVIN WILDAVERSIONKILI","COMPLEXZELECTERRESTRICTLESS"]` — collapsed, not written |
| **3 IMPORT** | 2 import records; MDMA URLs present in URL history but **not** in active `sourceExternalIds` |
| **5 DATABASE** | `structuredEntryCount`: 0, `legacyArtistNames`: `[]`, `contaminationSuspect`: false |
| **7 API** | `apiArtists`: `[]` |

**Field classification:** none incorrect (empty lineup matches unparsed collapsed raw). Historical contamination class `B_CROSS_EVENT_STATE_LEAKAGE` **repaired** — trace shows 0 structured artists, 0 overlap with MDMA canonical.

---

### Bootshaus on a Ship III — `evt-1785339420043-obhyeev`

**Verdict:** ✓ Lineup correct via flyer evidence despite detail-blocked ticket.io.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `rawArtistNames`: `[]` (list page), ticket.io: `https://bootshaus-club.ticket.io/wUc3uQrR/` |
| **2 CONNECTOR** | `normalizedArtistNames`: 8 names (from flyer/detail enrichment) |
| **5 DATABASE** | 4×B2B structured entries: BRANDON/SAM COLLINS, OLIVER MAGENTA/LOST IDENTITY, DAVE REPLAY/EMIN, ALUKES/MAKLA |
| **6–8** | API/UI aligned, `flyerEvidenceReviewState`: `accepted`, `detailBlocked`: true |

**Field classification:** none incorrect.

---

### Bootshaus on a Ship IV — `evt-1785339418526-dn9f7g0`

**Verdict:** **Empty lineup is incorrect** — artists exist in raw but collapsed blob rejected.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `rawArtistNames`: `["NIKLAS DEEFABIAN FARELLOLIVER MAGENTATEKNOCLASHDANTH▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔Einlass ab 18 Jahren / Age for admission 18 years"]` |
| **2 CONNECTOR** | `normalizedArtistNames`: `[]` — quality gate rejected collapsed string |
| **5 DATABASE** | `structuredEntryCount`: 0, `legacyArtistNames`: `[]` |
| **7 API** | `apiArtists`: `[]` (post 4.6.9.3: no prose `primary_artist` fallback) |

**Field classification:**
- `lineup`: `CONNECTOR_EXTRACTION` at stage 6 (HTML whitespace collapse before billing segmentation); failure propagates through `NORMALIZATION` (empty output)

**Stop condition:** Root cause proven at connector — collapsed single-token lineup in raw.

---

### Vision Ekstase — `evt-1785506404218-hgmd9nz`

**Verdict:** Empty lineup — **detail page inaccessible**.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `source-ticket-io-lehmannclub`, URL: `https://lehmannclub.ticket.io/FdFEFNxU/`, `rawArtistNames`: `[]` |
| **2 CONNECTOR** | No list-page lineup |
| **3 IMPORT** | `detailBlocked`: true |
| **5–8** | All lineup counts: 0 |

**Field classification:**
- `lineup`: `EXTERNAL_BLOCKER` (`C_DETAIL_SOURCE_INACCESSIBLE`, stage `4_detail_page_fetch`)

---

### PURE TECHNO — `evt-1785506448834-4c5s8xl`

**Verdict:** Same as Vision Ekstase — title lists 13 DJs but source fetch blocked.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `https://hmg-concerts.ticket.io/0orkxNqw/`, `rawArtistNames`: `[]`, title contains `ALEX STEIN, MARK REEVE, PETER PAHN, MARTIN BOOKS - 13 DJs` |
| **2 CONNECTOR** | Empty — detail blocked |
| **5–8** | 0 lineup |

**Field classification:**
- `lineup`: `EXTERNAL_BLOCKER` (`C_DETAIL_SOURCE_INACCESSIBLE`, stage `4_detail_page_fetch`)

---

### Blacklist Festival — `evt-1785339398765-9lptzhg`

**Verdict:** **Lineup severely wrong** — description A–Z block parsed as 44 SOLO entries.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `rawArtistNames`: `["ECRAZE B2B BIZO","KARA B2B YOUPHORIA","MADCORE B2B ELLIE RICH","VDV B2B MISCALL"]` (4 B2B lines only) |
| **2 CONNECTOR** | `normalizedArtistNames`: 8 from B2B split |
| **5 DATABASE** | `structuredEntryCount`: **44** SOLO entries including `(A–Z):A.M.C`, `Ricky West)`, `&AElig`, `ON:MODE....MORE TBASAVE THE DATE: OCTOBER 09-10`, `2026` |
| **7 API** | 43 `apiArtists` — same garbage names propagated |
| **Ticket** | `ticketUrl`: `https://bootshaus.ticket.io/` (shop root) |

**Field classification:**
- `lineup`: `CONNECTOR_EXTRACTION` (`G_DESCRIPTION_AS_LINEUP`, stage `6_connector_parser_description_fallback`) → persisted in `STRUCTURED_STORAGE`
- `ticketUrl`: `CONNECTOR_EXTRACTION` — shop root from Bootshaus website connector

**Stop condition:** Proven at connector description-fallback — 4 correct B2B lines vs 44 description tokens in DB.

---

### BC173 — `evt-1785339392687-tbdwup4`

**Verdict:** ✓ Empty lineup correct — source explicitly TBA.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `rawDescriptionSnippet`: `"Lineup and event details will be announced soon."`, `rawArtistNames`: prose fragments from transport boilerplate (3 entries), not artist names |
| **2 CONNECTOR** | `normalizedArtistNames`: `[]` |
| **5–8** | 0 lineup everywhere |

**Field classification:** none incorrect (empty is correct for TBA event).

*Related:* `evt-1785339410908-9691748` (BC173 let's get loco, Aug 15) has wrong title-inferred lineup `BC173 (let's get loco` — classified `IMPORT` / `H_TITLE_INFERENCE_PROMOTED`.

---

### KitKatClub — `evt-1785339389636-v1tq3hw`

**Verdict:** ✓ Empty lineup correct post P0 repair. Raw source still contains description-as-artist garbage that was **not persisted**.

| Stage | Evidence |
|-------|----------|
| **1 RAW SOURCE** | `rawArtistNames`: 45 prose/HTML fragments e.g. `"Clark Kent Lucien Foort Don Basti AL:PAY STYLE: mainly energetic Techno…"`, `"KitKatClub&rdquo;"`, `"öffnet sich das BOOTSHAUS…"` |
| **2 CONNECTOR** | `normalizedArtistNames`: 45 fragments (in import candidate only) |
| **5 DATABASE** | `structuredEntryCount`: **0** (repaired) |
| **7 API** | `apiArtists`: `[]` |

**Field classification:** none incorrect in DB/API. Raw import candidate still shows `G_DESCRIPTION_AS_LINEUP` pattern at stage 1–2; failure **stopped** before structured write.

---

## Ticket URL audit summary

41 events flagged in `ticket_url_trace.json`. Pattern:

| Pattern | Count | Root cause |
|---------|-------|------------|
| `https://bootshaus.ticket.io/` shop root in source | 11+ | `CONNECTOR_EXTRACTION` — Bootshaus `club_website` connector emits shop root when no per-event ticket slug |
| Per-event ticket.io slug present | majority | Correct e.g. `https://bootshaus-club.ticket.io/wUc3uQrR/` |
| Ticket Kings per-event | Affenkäfig events | Correct e.g. `https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/` |

**Blacklist example:**  
- Official page: `https://bootshaus.tv/events/10-2026-blacklist-festival-2026`  
- Chosen canonical `ticket_url`: `https://bootshaus.ticket.io/`  
- Rejected: no per-event slug in source  
- Why shop root won: only ticket URL present in normalized import from Bootshaus website connector

---

## Lineup audit summary

See `lineup_trace.json` for all 108 events. Key `lostAt` transitions:

| Transition | Example events | Root cause |
|------------|----------------|------------|
| raw → empty at normalization | Bootshaus Vol IV, Polyamor | `CONNECTOR_EXTRACTION` + `NORMALIZATION` |
| raw → empty at structured write | KitKatClub (intentional block) | Quality gate / repair |
| never in raw, empty throughout | Vision Ekstase, PURE TECHNO, BC173 TBA | `EXTERNAL_BLOCKER` or `RAW_SOURCE_MISSING` |
| raw 4 B2B → DB 44 SOLO | Blacklist | `CONNECTOR_EXTRACTION` |
| title only → DB 1 SOLO | LEVI, Technodampfer events | `IMPORT` |

---

## Source isolation (simulated from stored imports)

See `source_isolation_matrix.json`. Examples:

**Bootshaus Vol III** (`obhyeev`):
- Website only: `rawArtistNames: []`
- + ticket.io: separate import with event slug `wUc3uQrR`
- All origins: 4 structured B2B entries from flyer enrichment path

**Into The Madness** (`rjr91mv`):
- Bootshaus only: collapsed raw names, 0 DB lineup
- + Ticket Kings (historical): MDMA URLs in URL history — **not active in current DB lineup**
- All origins: 0 lineup (correct)

**Sommerfest** (`ux20897`):
- Affenkäfig website: 14 artists
- + Ticket Kings: same 14 via enriched import
- All origins: 14 SOLO (ordering differs in structured vs legacy)

---

## Final report

### 1. How many distinct root causes actually remain?

**5 distinct root causes** in the user taxonomy (plus 1 ticket-url-specific variant of connector extraction):

1. `EXTERNAL_BLOCKER` — 21 events  
2. `IMPORT` (title inference promoted) — 21 events  
3. `RAW_SOURCE_MISSING` — 18 events (13 insufficient + 5 no lineup)  
4. `CONNECTOR_EXTRACTION` — 6+ events (description-as-lineup, collapsed HTML, shop-root tickets)  
5. `STRUCTURED_STORAGE` — ordering/metadata drift (subset of 20 structured/legacy mismatches)

Not observed as active failure classes: `OWNERSHIP`, `MULTI_ORIGIN_MATCH` (0 contamination), `MERGE`, `CANONICAL_STORAGE`, `COMPATIBILITY_PROJECTION`, `CACHE`, `UI_RENDER`, `MANUAL_DATA`.

### 2. Which root cause affects the largest number of Events?

**Tie: `EXTERNAL_BLOCKER` and `IMPORT` — each 21 events** (detail-page fetch blocked vs title-inference lineup).

### 3. Which fixes would eliminate the largest number of remaining bugs?

Evidence from `_phase469_minimum_fix_plan.json` generic classes (not implementation proposals):

| Generic fix class | Events affected | Would address |
|-------------------|-----------------|---------------|
| `P1_demote_title_inference` | 21 | `IMPORT` |
| `P3_flyer_reconciliation_when_blocked` | 21 | `EXTERNAL_BLOCKER` |
| `P0_block_prose_artist_creation` | 6 | `CONNECTOR_EXTRACTION` (description-as-lineup) |
| `P1_candidate_only_secondary_paths` | 13 | `RAW_SOURCE_MISSING` |
| Per-event ticket URL extraction | 11 | shop-root `CONNECTOR_EXTRACTION` |

### 4. Which remaining issues are external blockers?

**21 events** with `C_DETAIL_SOURCE_INACCESSIBLE` / `firstFailureStage: 4_detail_page_fetch`, including Vision Ekstase, PURE TECHNO, and majority of Lehmann/ticket.io list-only events where `detailBlocked: true` and `rawArtistNames: []`.

### 5. Which issues are data-quality problems?

- Source HTML: collapsed lineup tokens (Bootshaus Vol IV, Polyamor), description prose ingested as artists (Blacklist raw candidate, KitKat import candidate)  
- Source metadata: shop-root ticket URLs from Bootshaus website  
- Source TBA: legitimately empty lineups (BC173 Sept, many festival placeholders)  
- Title-as-lineup: events where only event title contains artist names (LEVI, Technodampfer)

### 6. Which issues are architectural?

- Description-fallback parser path writing unbounded SOLO entries from `description` HTML (`G_DESCRIPTION_AS_LINEUP`)  
- Title inference as publishable lineup when `rawArtistNames` empty (`H_TITLE_INFERENCE_PROMOTED`)  
- Structured lineup sort order diverging from legacy (`structured_wrong_legacy_correct`)  
- Bootshaus website connector defaulting ticket URL to shop root when event page lacks slug

### 7. Could every remaining bug be explained by ≤5 root causes?

**Yes.**

| # | Root cause | Mechanism |
|---|------------|-----------|
| 1 | `EXTERNAL_BLOCKER` | Ticket.io/Lehmann detail fetch blocked; list page has no lineup |
| 2 | `IMPORT` | Title inference promoted to canonical SOLO lineup when source empty |
| 3 | `CONNECTOR_EXTRACTION` | HTML collapse, description-as-lineup, shop-root ticket URLs |
| 4 | `RAW_SOURCE_MISSING` | Source genuinely has no structured lineup (TBA, list-only) |
| 5 | `STRUCTURED_STORAGE` | Persisted structured ordering/segmentation differs from legacy truth |

---

## Deliverables index

- `docs/ROOT_CAUSE_EVIDENCE_AUDIT.md` (this file)
- `docs/real-data/root_cause_matrix.json`
- `docs/real-data/event_pipeline_traces.json`
- `docs/real-data/ticket_url_trace.json`
- `docs/real-data/lineup_trace.json`
- `docs/real-data/source_isolation_matrix.json`
