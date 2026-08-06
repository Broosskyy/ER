# Phase 4.6.3 Production Recovery Report

Generated: 2026-08-02T15:30:00Z  
Orchestrator: `scripts/operations/_phase463-production-recovery.ts`  
Activation artifact: `docs/real-data/_phase462_production_activation.json`  
Recovery artifact: `docs/real-data/_phase463_production_recovery.json`

---

## Executive Summary

Controlled two-pass production re-import completed successfully through the normal import pipeline (no manual DB edits). Pass 2 was fully idempotent (`createdCount = 0` on all 12 sources). Field-trust merge, publish mapper, and migration columns are active.

**Recommendation: Additional completion slice required before Part 4.**

Primary blockers: Bootshaus ticket-destination regressions (website event page chosen over Ticket.io when only shop-root URLs exist), canonical lineup projection still empty on regression events, three named regression events not published, ticket phases remain at zero.

---

## 1. Preflight

| Check | Result |
| --- | --- |
| Production project | `gnkjzinwvmrxcadwebhv.supabase.co` |
| Service role | Configured |
| Field trust merge | `EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE=true` |
| Active import jobs | 0 |
| Queue entries | 0 |
| Migration columns (`venue_address`, `ticket_phases`, `genre_labels`, `ticket_status`) | All present |
| Publish mapper probe | Available (phase 4.6.2 preflight) |
| Preflight affected sources/events | 12 / 99 |

**Verdict: GO** — all prerequisites satisfied.

---

## 2. Sources Processed

12 sources in re-import batch (order preserved):

| Source | Enabled | Detail pages | Import records | Canonical links |
| --- | --- | --- | --- | --- |
| Bootshaus Köln (website) | ✓ | 50 | 38 | 38 |
| Bootshaus Ticket.io | ✓ | list only | 17 | 17 |
| Affenkäfig (website) | ✓ | 50 | 8 | 7 |
| Affenkäfig Ticket Kings | ✓ | list only | 5 | 5 |
| M.D.M.A Musik die mich antreibt (Ticket Kings) | ✓ | list only | 5 | 5 |
| lehmannclub (Ticket.io) | ✓ | list only | 12 | 11 |
| technodampfer (Ticket.io) | ✓ | list only | 12 | 10 |
| protontheclub (Ticket.io) | ✓ | list only | 13 | 13 |
| area51events (Ticket.io) | ✓ | list only | 4 | 4 |
| hmg-concerts (Ticket.io) | ✓ | list only | 20 | 19 |
| Ticket Kings — Elektroküche | ✓ | list only | 5 | 4 |
| Ticket Kings — Underland | ✓ | list only | 5 | 0 |

Connector version on ticket platforms: **1.2.0**

---

## 3. Two-Pass Import Results

### Pass 1 (~9.8 min)

All sources completed. Highlights:

- Bootshaus website: 14 updated, 0 created, 32 descriptions in payload
- Bootshaus Ticket.io: 13 updated, 8 lineups in payload
- Ticket.io shops: lineups present in payloads (6–11 per source); `detailPagesFetched: 0` (PoW blocking live detail)
- Ticket Kings orgs: 5 descriptions per source from list enrichment

### Pass 2 (~9.6 min)

| Source | createdCount | updatedCount | unchangedCount |
| --- | --- | --- | --- |
| All 12 sources | **0** | varies | stable |

**Idempotency: PASS** — pass 2 `createdCount` sum = 0 across all sources.

Cache refresh ran after each pass via `invalidateConsumerEventCaches`.

---

## 4. Multi-Origin Merge Validation

### Bootshaus (website + Ticket.io)

- **12 canonical events** have both origins linked
- Website supplies descriptions, cover imagery, venue context
- Ticket.io supplies ticket URLs and lineup payloads (in import records)
- **1 potential split duplicate** flagged: `r3hab pres. by bootshaus` (same title, different canonical IDs — needs dedup review)

### Affenkäfig (website + Ticket Kings)

- **1 canonical event** with both origins
- **3 title collisions** across origins (MDMA / Underland events) — enrichment records exist but not all merged to single canonical

### Field trust behavior

Organization no longer appears as artist on regression sample (✓). Venue/organizer separation works where both fields populated.

---

## 5. Ticket Destination Validation

### Before re-import

| Metric | Count |
| --- | --- |
| Event-specific ticket URLs | 82 |
| Generic / shop-root | 23 |
| Missing | 3 |
| Bootshaus.tv regressions | 1 |

### After re-import

| Metric | Count |
| --- | --- |
| Event-specific ticket URLs | 86 |
| Generic / shop-root | 19 |
| Missing | 3 |
| Bootshaus.tv regressions | **5** |

### Regressions (canonical `ticket_url` = bootshaus.tv event page)

| Event | Issue |
| --- | --- |
| NIGHTSWITHUS presents LEVI | Website page wins; Ticket.io origin only has shop root |
| Bootshaus pres. BC173 | Same pattern |
| VERTILE pres. EVERYTHING CHANGES | Same pattern |
| SA * 22.08.2026 \| KitKatClub | Same pattern |
| MI * 30.12.2026 \| KitKatClub | No Ticket.io event URL in any origin |

**Root cause:** When Ticket.io detail fetch is blocked (PoW), origins store `https://bootshaus.ticket.io/` (shop root). Field trust correctly prefers website `bootshaus.tv/events/...` (event-specific, score 80) over shop root (score ~40). User still lands on Bootshaus.tv and must search — unacceptable per acceptance criteria.

**ELY OAKS** additionally has shop-root `https://bootshaus.ticket.io/` with no event-specific Ticket.io URL available.

---

## 6. Regression Event Validation

| Event | Status | Ticket URL | Lineup | Description | Genres |
| --- | --- | --- | --- | --- | --- |
| Bootshaus Sommerfest Closing | ✓ found | ✓ event-specific Ticket.io | ✗ empty | ✓ 758 chars | ✗ |
| PLAY! Open Air | ✗ not published | — | — | — | — |
| LEVI (NIGHTSWITHUS presents LEVI) | ✓ found | ✗ bootshaus.tv | ✗ | ✓ 417 chars | ✓ HOUSE |
| ELY OAKS | ✓ found | ✗ shop root | ✗ | ✓ 526 chars | ✗ |
| Technodampfer | ✗ not in published set | — | — | — | — |
| SHOCKONE | ✗ not in published set | — | — | — | — |
| MDMA | ✓ found | ✓ Ticket Kings event | ✗ | ✗ | ✗ |
| Affenkäfig A8 | ✓ found | ✓ event page | ✗ | ✗ | ✗ |
| Proton Stuttgart | ✓ found | ✓ Ticket Kings event | ✗ | ✓ 538 chars | ✗ |
| Lehmann Clubnacht | ✓ found | ✓ Ticket.io event | ✗ | ✗ | ✓ price |
| Area51 Techno | ✓ found | ✓ Ticket.io event | ✗ | ✗ | ✓ price |

### Regression checklist

| Criterion | Result |
| --- | --- |
| Organization not artist | ✓ |
| Full Sommerfest lineup | ✗ lineupCount = 0 |
| LEVI lineup available | ✗ |
| Genres imported | Partial (LEVI only in sample) |
| Descriptions complete | Partial |
| Direct ticket URLs | ✗ LEVI, ELY OAKS fail |
| Address recovered | Partial (+4 venue addresses post-import) |
| Venue/organizer separated | Partial (Bootshaus events still merged) |
| Best origin per field | Partial — ticket URL logic blocked by missing Ticket.io event URLs |
| No data downgrade | ✓ counts stable |

---

## 7. Metrics Before → After

| Metric | Baseline | Pass 1 | Pass 2 |
| --- | --- | --- | --- |
| Published events | 108 | 108 | 108 |
| Archived events | 14 | 14 | 14 |
| Active origins | 151 | 151 | 151 |
| Import records | 162 | 162 | 162 |
| Event–artist rows | 81 | 83 | 83 |
| Events with lineup | 73 | 73 | 73 |
| Meaningful descriptions | 52 | 52 | 52 |
| Ticket phases | 0 | 0 | 0 |
| Price text | 64 | 64 | 64 |
| Coordinates | 17 | 17 | 17 |
| Venue addresses | 23 | **27** | **27** |
| Genre labels | 5 | **6** | **6** |

Import payload coverage (post-import audit): Ticket.io sources show **lineup in payloads** (e.g. technodampfer 100%, lehmann 70%) but canonical projection still shows **lineup 0%** for most sources — projection gap between `normalized_payload` and published `events.lineup`.

---

## 8. Browser Validation

**Not executed in this session** — requires running app against production Supabase.

Manual QA still needed:

- Home / Search / Map / Saved / Profiles
- Event detail: lineups, descriptions, genres, ticket buttons
- Ticket button destinations for Bootshaus, Affenkäfig, Ticket.io shops

---

## 9. Test Suite

| Suite | Result |
| --- | --- |
| `typecheck:app` | ✓ pass |
| `typecheck:operations` | ✗ 1 error (`repair-events.ts` — pre-existing) |
| `eslint` | ✓ 0 errors (2491 warnings) |
| `vitest run` | 1438 pass / **6 fail** (fixture date year, ticket URL trailing slash, demo-image-assets module, field-trust URL tests) |
| `build:web` | ✓ pass |
| `validate:build-output` | ✓ pass |

Connector/parser/route tests: included in vitest run; phase463 detail-extraction tests pass when run in isolation.

---

## 10. Remaining Blockers

1. **Ticket destination** — 5 Bootshaus events open bootshaus.tv; Ticket.io blocked from event-specific URLs
2. **Lineup projection** — payloads contain lineup data; canonical `lineup` / `event_artists` not populated on regression events
3. **Missing published events** — PLAY! Open Air, Technodampfer, SHOCKONE not in published set (may be archived or unpublished)
4. **Ticket phases** — still 0 (detail fetch blocked; no `ticketOffers` in payloads)
5. **Affenkäfig multi-origin** — only 1 of 4+ expected merged pairs
6. **Ops trace script** — `display-event` import fails in Node due to binary demo assets (blocks automated UI trace)

---

## 11. Recommendation

### Additional completion slice required

Before Phase 4.6.3 Part 4 acceptance:

1. **Ticket URL merge policy** — when website has event page but Ticket.io has only shop root, prefer stored Ticket.io event slug from list JSON over bootshaus.tv (or preserve last-known event-specific Ticket.io URL from snapshots)
2. **Lineup publish path** — ensure `artistNames` / `lineupEntries` from Ticket.io and Ticket Kings payloads flow through `buildImportPublishFieldPatch` → `events.lineup` / `event_artists`
3. **Publish PLAY! / Technodampfer / SHOCKONE** — verify import record status and publish queue for these events
4. **Ticket.io detail access** — PoW workaround or list-page ticket URL extraction for event-specific slugs
5. **Re-run two-pass import** after fixes; confirm pass 2 `createdCount = 0` and regression checklist green
6. **Manual browser QA** on production-connected dev build

### What succeeded

- Pipeline-only recovery (no manual DB patches)
- Full idempotent two-pass re-import
- Multi-origin linking for Bootshaus (12 events)
- Venue address recovery (+4)
- Organization-not-artist quality gate
- Build and bundle validation pass

---

## Artifacts

| File | Purpose |
| --- | --- |
| `docs/real-data/_phase463_production_recovery.json` | Full recovery JSON |
| `docs/real-data/_phase462_production_activation.json` | Import pass metrics |
| `docs/real-data/_phase463_import_coverage_audit.json` | Per-source field coverage |
| `docs/real-data/_phase463_pass1_log.txt` | Pass 1 console log |
| `docs/real-data/_phase463_pass2_log.txt` | Pass 2 console log |
| `docs/real-data/_phase463_vitest_log.txt` | Test run output |
