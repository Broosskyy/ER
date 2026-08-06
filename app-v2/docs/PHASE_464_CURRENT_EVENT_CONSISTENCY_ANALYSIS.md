# Phase 4.6.4 — Current Event Consistency Root-Cause Analysis

Generated: 2026-08-02T18:36:04.315Z

**Mode:** Read-only analysis. No production data was modified.

---

## Executive answer: Why are published events so inconsistent?

Published events pass through the **same product pipeline**, but they do **not** pass through the **same effective extraction path**. Inconsistency is dominated by four structural factors:

1. **Detail enrichment is optional and unevenly configured** — Many Ticket Kings and Ticket.io production sources stored `maxDetailPages: 0` (or absent), so list JSON-LD-only imports never received lineups, prices, or descriptions that exist only on detail HTML.
2. **Parser coverage lags source HTML diversity** — Ticket Kings `<br />` lineups, Affenkäfig HTML grids, and description-embedded lineups were not parsed until recent fixes; **production import rows predate those fixes**.
3. **Publish/repair skips stale canonical rows** — Stable re-import with unchanged normalized hash skips full publish; lineup/price repair only runs when explicitly triggered. Many events retain **first-publish** canonical state.
4. **Schema and projection gaps** — Floor count, indoor/outdoor, ticket phases, and timetables are extracted into import metadata but **lack canonical event columns or UI projection**, appearing "missing" despite source evidence.

UI rendering is a **minor** contributor: when `event_artists` is populated, projection uses canonical relations. Most visible gaps trace to **stages 3–10**, not stage 12.

---

## 1. Event matrix summary (108 published events)

| Dimension | High (≥0.75) | Medium | Low (<0.5) | Average score |
| --- | ---: | ---: | ---: | ---: |
| Consistency | 5 | 102 | 1 | 0.6 |

### Field status totals

| Field | Complete | Partial | Missing | Invalid | Unavailable |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lineup | 9 | 33 | 51 | 0 | 15 |
| Description | 52 | 0 | 56 | — | 0 |
| Ticket URL | 81 | 24 | 0 | 0 | — |
| Ticket price | 63 | — | 0 | — | 45 |
| Street address | 27 | 15 | 66 | — | — |
| Coordinates | 17 | — | 91 | — | — |
| Ticket phases | 0 | — | 108 | — | — |
| Genres | 7 | — | 18 | — | 83 |

Full per-event matrix: `docs/real-data/_phase464_current_event_matrix.json`

---

## 2. Pipeline first-failure stages (cross-field)

| Stage | Meaning | Dominant fields |
| ---: | --- | --- |
| 1 | List page has no field | lineup, description (staging seeds) |
| 3 | Detail page not fetched | lineup, price, description, image |
| 4 | Fetch blocked (PoW) | Ticket.io detail |
| 5 | Parser did not recognize format | lineup, description in HTML |
| 6 | Invalid placeholder extracted | lineup (Organization, title fragments) |
| 8 | Multi-origin merge lost better value | ticket URL (shop root vs event URL) |
| 9 | Publish resolver partial write | lineup count |
| 10 | Publish skipped / DB column empty | price, phases, geo, attributes |
| 11 | Projection sanitization gap | description HTML entities |

---

## 3. Root-cause groups (top)

### schema_publish_gap (216 field-audits, 108 events)
- Fields: venueEnvironment, floorCount
- Stages: 10

### geocode_not_persisted (182 field-audits, 91 events)
- Fields: latitude, longitude
- Stages: 10

### publish_mapper_omission (108 field-audits, 108 events)
- Fields: ticketPhases
- Stages: 10

### feature_not_implemented (108 field-audits, 108 events)
- Fields: timetable
- Stages: 1

### publish_default (81 field-audits, 81 events)
- Fields: ticketStatus
- Stages: 10

### stale_or_parser (81 field-audits, 81 events)
- Fields: street
- Stages: 10, 5

### detail_fetch_disabled (74 field-audits, 74 events)
- Fields: description, image, lineup
- Stages: 3

### parser_format_unsupported (48 field-audits, 48 events)
- Fields: lineup
- Stages: 5

Full grouping: `docs/real-data/_phase464_root_cause_groups.json`

---

## 4. Connector / configuration drift

| Connector | Sources | Events linked | Detail fetch=0 w/ URL | maxDetailPages in config |
| --- | ---: | ---: | ---: | --- |
| manual | 1 | 0 | 0 | n/a |
| club_website | 1 | 34 | 34 | 50 |
| ticket_platform | 10 | 77 | 74 | 15 |
| organizer_website | 1 | 7 | 7 | 50 |

**Drift examples (production DB vs code defaults):**
- Ticket Kings organizer sources: code template now sets `maxDetailPages: 15`; DB rows historically had limits without this key → **detail fetch disabled at runtime**.
- Ticket.io sources: same pattern; list shop JSON-LD lacks lineup/price detail.
- Affenkäfig website: `maxDetailPages: 50` in DB but detail strategy `json_ld` ignored HTML lineup grid until parser fix.

---

## 5. Multi-origin behavior (16 events with 2+ origins)

Dual-origin pairs (Bootshaus website + Ticket.io, Affenkäfig + Ticket Kings) are **matched into one canonical event** correctly. Inconsistency arises when:

- Ticket platform origin has **empty import payload** (detail not fetched) while website origin has partial list data
- Merge picks **list JSON-LD** for ticket URL while enrichment source has **event-specific ticket.io URL** not yet republished
- Website origin lacks lineup; ticket origin would have lineup **after detail fetch** but stored import is stale

See `multiOriginSummary` in matrix JSON.

---

## 6. Stale data vs current code

| Class | Estimate | Explanation |
| --- | ---: | --- |
| **B — Stale production row** | ~40–55 events | Code/parser fixed; import or canonical not republished |
| **A — Current code path still lossy** | ~15–25 events | Schema gaps (phases, attributes), merge/trust edge cases |
| **C — Source absent** | ~14 events | Staging seeds, list-only pages |
| **D — Blocked/inaccessible** | PoW subset | Ticket.io challenge pages |
| **E — Publish policy** | ~5–10 events | Stable skip before repair hooks |
| **F — UI-only** | Minimal | Projection follows DB; no systematic UI drop |

---

## 7. Representative traces

### Sommerfest Elektroküche
- Event: evt-1785389055557-ux20897
- Lineup: complete
- Fetch: detail pages fetched in origin metadata

### MDMA — Musik Die Mich Antreibt
- Event: evt-1785389054496-ns9b6la
- Lineup: complete
- Fetch: detail URL known, fetch count 0 in stored metadata

### Bootshaus on a Ship
- Event: evt-1785339418526-dn9f7g0
- Lineup: missing
- Fetch: detail URL known, fetch count 0 in stored metadata

### NEONSPLASH Paint-Rave
- Event: evt-1785339385102-xocczqs
- Lineup: missing
- Fetch: detail URL known, fetch count 0 in stored metadata

### Vision Ekstase Open Air
- Event: evt-1785506404218-hgmd9nz
- Lineup: missing
- Fetch: detail URL known, fetch count 0 in stored metadata

### 100% SCHRANZ PER PLEKS
- Event: evt-1785506366010-1npnra9
- Lineup: partial
- Fetch: detail URL known, fetch count 0 in stored metadata

### Blacklist Festival 2026
- Event: evt-1785339398765-9lptzhg
- Lineup: missing
- Fetch: detail URL known, fetch count 0 in stored metadata

### PURE TECHNO
- Event: evt-1785506448834-4c5s8xl
- Lineup: missing
- Fetch: detail URL known, fetch count 0 in stored metadata

Full stage-by-stage values: `docs/real-data/_phase464_representative_traces.json`

---

## 8. Prioritized action plan (analysis only — not executed)

### P0 — Pipeline defects (valid source data lost)

| Action | Root cause | ~Events | Re-import? | Risk |
| --- | --- | ---: | --- | --- |
| Enable `maxDetailPages` on all ticket platform sources | detail_fetch_disabled | 48+ | Yes | Low |
| Generic detail parsers (br-lineup, affenkaefig grid, description lineup) | parser_format_unsupported | 32+ | Yes | Low |
| Lineup projection integrity repair on stable skip | publish skip / partial | 5–15 | Repair pass | Low |

### P1 — Stale production rows

| Action | Root cause | ~Events | Re-import? | Risk |
| --- | --- | ---: | --- | --- |
| Controlled pass1 + pass2 re-import | stale import payloads | 50+ | Yes | Medium |
| Targeted lineup/ticket URL repair | stale canonical | 5–10 | Repair only | Low |

### P2 — Connector/config gaps

| Action | Root cause | ~Events | Migration? |
| --- | --- | ---: | --- |
| Ticket URL trust merge (event-specific wins) | merge_or_trust_wrong_ticket_url | ~5–10 | No |
| Persist ticket phases from ticket.io offers | schema_publish_gap | 80+ | Maybe |
| Persist floor/environment attributes | schema_publish_gap | 20+ | Maybe |

### P3 — Source limitations

- Staging seed events (14): no real source lineup
- Timetable/running order: feature not in publish model

### P4 — UI-only

- Description HTML entity sanitization in projection (partial descriptions)
- No-headliner badge for full lineups (cosmetic)

---

## 9. Verification before any production writes

1. Read-only preflight audit (this analysis) ✓
2. Backup `event_artists` + ticket_url columns
3. Patch source config in DB (maxDetailPages) — **config only**
4. Pass1 re-import → audit-after matrix
5. Repair pass → idempotent pass2
6. Invalidate consumer caches
7. Mobile spot-check: Sommerfest, MDMA, Bootshaus on a Ship, Lehmann

---

## 10. Answers to required questions

1. **Why events differ:** Uneven detail fetch + parser coverage + stale publish state + schema gaps.
2. **From sources:** List-only JSON-LD; some venues lack structured lineup on list pages.
3. **From connector config:** `maxDetailPages` absent/zero on ticket sources.
4. **From parser behavior:** HTML format diversity not covered until recent fixes.
5. **From merge/publish:** Stable skip, partial lineup write, ticket URL class conflicts.
6. **From stale data:** Majority of missing lineups/prices — import rows predate fixes.
7. **UI-only:** Minor (description sanitization); lineup UI follows `event_artists`.
8. **Largest generic fixes:** Detail fetch enablement + re-import (48+ events).
9. **Implementation order:** P0 config → P0 parsers (done in code) → P1 re-import → P2 schema.
10. **Before production writes:** Backup, pass1 audit, no broad repair until pass1 completes.

---

*Artifacts: `_phase464_current_event_matrix.json`, `_phase464_root_cause_groups.json`, `_phase464_representative_traces.json`*
