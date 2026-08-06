# Phase 4.6.3 Pass 2 Validation Report

Generated: 2026-08-02  
Orchestrator: `scripts/operations/_phase463-pass2-validation.ts`  
Artifacts: `docs/real-data/_phase463_pass2_validation.json`, `docs/real-data/_phase462_production_activation.json`

---

## Recommendation

# **ADDITIONAL_COMPLETION_SLICE_REQUIRED**

Pass 2 idempotency is proven (`createdCount = 0`, all metric deltas stable). However lineup projection gaps, Bootshaus.tv ticket routing on LEVI, and missing published regression events block Part 4 acceptance.

---

## 1. Pass-1 Baseline

Captured from activation artifact (`metrics.pass1`, 2026-08-02T15:08:26Z):

| Metric | Value |
| --- | --- |
| Published events | 108 |
| Archived events | 14 |
| Active origins | 151 |
| Import records | 162 |
| Event–artist rows | 83 |
| Events with lineup | 73 |
| Meaningful descriptions | 52 |
| Direct ticket URLs (extended audit) | 86 |
| Price text | 64 |
| Ticket phases | 0 |
| Coordinates | 17 |
| Venue addresses | 27 |
| Genre labels | 6 |
| Canonical events (total) | 127 |

Extended post-pass-2 snapshot also recorded in validation JSON under `postPass2Extended`.

---

## 2. Pass-2 Results by Source

Runtime ~9.6 min. All sources completed through shared pipeline.

| Source | created | updated | unchanged | runtime |
| --- | --- | --- | --- | --- |
| source-bootshaus-koeln | 0 | 14 | 20 | 178.8s |
| source-affenkaefig | 0 | 5 | 3 | 55.6s |
| source-ticket-kings-org-m-d-m-a | 0 | 5 | 0 | 41.9s |
| source-ticket-io-lehmannclub | 0 | 1 | 9 | 18.1s |
| source-ticket-io-technodampfer | 0 | 2 | 9 | 18.2s |
| source-ticket-io-protontheclub | 0 | 0 | 7 | 13.5s |
| source-ticket-io-area51events | 0 | 0 | 4 | 12.5s |
| source-ticket-io-hmg-concerts | 0 | 1 | 19 | 35.8s |
| source-bootshaus-ticket-io | 0 | 13 | 2 | 113.9s |
| source-affenkaefig-ticket-kings | 0 | 5 | 0 | 40.8s |
| source-ticket-kings-org-elektrokuche | 0 | 5 | 0 | 34.6s |
| source-ticket-kings-org-underland | 0 | 5 | 0 | 9.0s |

Detail extraction: `detailPagesFetched: 0` on all sources (Ticket.io PoW blocks live detail). List-page payloads still carry lineup arrays for Ticket.io shops.

---

## 3. Idempotency Analysis

**Verdict: PASS**

- Pass 2 `createdCount = 0` for all 12 sources
- All metric deltas pass1 → pass2 = **0** (published, origins, import records, artists, lineups, descriptions, tickets, coordinates, addresses, genres)
- No unexplained deltas
- `updatedCount` on pass 2 reflects freshness metadata republish only — no new canonical events or origins

---

## 4. No-Downgrade Audit

**13 potential blockers** detected (lineup and ticket URL projection gaps):

| Type | Example |
| --- | --- |
| `lineup_shrink` | Ticket.io payload has 2–4 lineup entries; canonical has 0 artists |
| `ticket_url_downgrade` | Better Ticket.io event URL in origin payload not selected |

Notable: Sommerfest Closing correctly keeps Ticket.io event URL (`ycDXwvrm`) over website shop root — **no downgrade** on that event.

LEVI: canonical uses `bootshaus.tv/events/...` because Ticket.io origin only has shop root — field trust correctly scores website event page higher, but user experience regresses.

---

## 5. Multi-Origin Field-Selection Audit

### A. Bootshaus (website + Ticket.io) — 12 merged events

Sample: **Bootshaus Sommerfest Closing**

| Field | Website origin | Ticket.io origin | Canonical |
| --- | --- | --- | --- |
| Description | 758 chars | 0 | 758 (website) ✓ |
| Ticket URL | shop root | event-specific | Ticket.io ✓ |
| Lineup | 0 | 0 | 0 |
| Venue | Bootshaus | Bootshaus | Bootshaus |
| Organizer | Bootshaus | Bootshaus Cologne GmbH | Bootshaus |

### B. Affenkäfig (website + Ticket Kings) — 1 merged event

Most Affenkäfig/MDMA events remain split across origins (3 title collisions).

### C. Additional multi-origin

Lehmann Clubnacht: Ticket.io-only with event-specific URL — no merge conflict.

**Finding:** Per-field selection works where data exists. Lineup and ticket URL fail when Ticket.io detail blocked and list page lacks event slug.

---

## 6. Ticket-Destination Audit

| Validation event | Canonical ticket URL | Classification | Blocker |
| --- | --- | --- | --- |
| Sommerfest Closing | bootshaus-club.ticket.io/ycDXwvrm/ | direct_event | ✓ |
| LEVI | bootshaus.tv/events/nightswithus-presents-levi | event_specific_official_page | **bootshaus.tv regression** |
| ELY OAKS | bootshaus.ticket.io/ | shop_root | needs event slug |
| MDMA | ticketkings.de/event/... | direct_event | ✓ |
| Lehmann | lehmannclub.ticket.io/VqX0G8j6/ | direct_event | ✓ |
| Area51 | area51events.ticket.io/YSQcd9gq/ | direct_event | ✓ |
| Mallorca | bootshaus.ticket.io/ | shop_root | no event-specific URL in origins |
| PLAY! / Technodampfer / SHOCKONE | not published | — | missing |

---

## 7. Source-to-Public Traces

Full traces in `_phase463_pass2_validation.json` → `sourceToPublicTraces`.

**Loss stages identified:**

- **Lineup:** `publish_projection` — Ticket.io `artistNames` in normalized payload never reach `event_artists` or `events.lineup`
- **Description:** generally preserved (Sommerfest 758 chars end-to-end)
- **Ticket URL:** merge stage selects best available; blocked when only shop roots exist

---

## 8. Lineup Regression

| Event | Artists | Organization as artist | Empty lineup |
| --- | --- | --- | --- |
| Sommerfest Closing | 0 | ✗ | **yes** |
| LEVI | 0 | ✗ | **yes** (shows "Kein Line-up") |
| ELY OAKS | 0 | ✗ | **yes** |
| PLAY! Open Air | not found | — | — |
| MDMA | 0 | ✗ | yes |
| Technodampfer / SHOCKONE | not found | — | — |

✓ Organization not imported as artist  
✗ Recoverable lineups from Ticket.io payloads not reaching production

---

## 9. Description Regression

| Event | Source max | Canonical | Issues |
| --- | --- | --- | --- |
| Sommerfest Closing | 758 | 758 | `broken_merge` pattern flagged (review text) |
| ELY OAKS | 526 | 526 | none |
| LEVI | 417 | 417 | none |
| PLAY! Open Air | not published | — | — |
| Affenkäfig A8 | 0 | 0 | missing |
| MDMA | 0 | 0 | missing |

No visible `\n` escapes on sampled events. No duplicate Place:/Date: metadata detected.

---

## 10. Genre and Event-Attribute Validation

- LEVI: `HOUSE` genre present on canonical ✓
- Sommerfest: no genres on canonical ✗
- Ticket Kings Sommerfest genres (Techno/Bounce/Hardtechno) — **not verified on published Sommerfest event** (lineup/genre detail not projected)
- Indoor/Outdoor, floors — not present on canonical samples

---

## 11. Venue and Organizer Validation

| Event | Venue | Organizer | Separated |
| --- | --- | --- | --- |
| LEVI | Bootshaus | Bootshaus | ✗ (same) |
| MDMA | Essigfabrik / Elektroküche | Affenkäfig | ✓ |
| Mallorca | external venue | — | ✓ (no Bootshaus default) |
| Proton | Proton Stuttgart | M.D.M.A | ✓ |

Bootshaus events still collapse venue = organizer where website provides both as "Bootshaus".

---

## 12. Cache Refresh

Completed 2026-08-02T15:48:06Z via `invalidateConsumerEventCaches`:

- Event detail cache
- Home feed cache
- Discovery search cache
- Consumer event repository refresh

---

## 13. Automated Validation

| Suite | Result |
| --- | --- |
| `typecheck:app` | ✓ pass |
| `typecheck:operations` | ✓ pass |
| ESLint | ✓ 0 errors (warnings only) |
| Targeted vitest (connectors, parsers, lineup, ticket URL, phase46) | 120 pass / **2 fail** |
| Full vitest (prior run) | 1438 pass / 6 fail |
| `build:web` | ✓ pass |
| `validate:build-output` | ✓ pass |
| Production trace (`phase462 trace`) | ✗ blocked by demo-image-assets in Node |

**Failing tests (classified):**

| Test | Classification |
| --- | --- |
| `sprint342-generic-source-foundations` (ticket URL) | **required_before_part4** — merge prefers shop root over event slug |
| `bootshaus-source` (PLAY date year) | fixture drift, non-blocking |
| `demo-images` module resolution | ops/test env, non-blocking |
| `sprint335-ticket-platform-e2e` trailing slash | normalization policy, review |

---

## 14. Manual Browser Validation

**Not executed in this session.** Cache refresh completed server-side; manual QA still required on Home, Search, Map, Saved, Event Detail, Profiles for the named regression events against production-connected dev build.

---

## 15. Production Metrics Before/After

| Metric | Pass 1 | Pass 2 | Δ |
| --- | --- | --- | --- |
| Published | 108 | 108 | 0 |
| Origins | 151 | 151 | 0 |
| Event artists | 83 | 83 | 0 |
| Venue addresses | 27 | 27 | 0 |
| Genres | 6 | 6 | 0 |
| Ticket phases | 0 | 0 | 0 |
| Meaningful descriptions | 52 | 52 | 0 |

---

## 16. Remaining Blockers

1. **Lineup projection** — Ticket.io/Ticket Kings payloads → canonical artists (13 events with payload > canonical)
2. **LEVI ticket URL** — bootshaus.tv selected over unavailable Ticket.io event slug
3. **PLAY!, Technodampfer, SHOCKONE** — not in published set
4. **Ticket phases** — 0 (Ticket.io detail/PoW blocked)
5. **Affenkäfig multi-origin** — only 1/4+ expected merges
6. **Automated trace script** — demo asset import breaks Node trace path

---

## 17. Open Requirements Status

| Requirement | Status |
| --- | --- |
| Ticket.io Info-tab access | `blocked_by_external_dependency` |
| Ticket phases | `blocked_by_source` |
| Timetable parser | `deferred_non_blocking_design` |
| Running-order parser | `deferred_non_blocking_design` |
| Server-backed Follow | `blocked_by_migration` |
| `entity_follows` migration | `partially_completed` |
| ZIP/address geocoding | `deferred_non_blocking_design` |
| Shared filter provider | `partially_completed` |
| Complete Profile content | `partially_completed` |
| Admin detail review | `deferred_non_blocking_design` |
| Theme polish | `deferred_non_blocking_design` |

---

## Conclusion

Pass 2 recovery mechanics are sound: idempotent, no count drift, caches refreshed, pipeline-only changes. Data quality gaps (lineup projection, ticket URL policy when detail blocked, unpublished regression events) require a **completion slice** before Part 4.

**Do not begin Phase 4.6.3 Part 4.**
