# M9.4A — Rausgegangen Germany Discovery + Source Qualification Dry Run

## Final status

**M9_4A_RAUSGEGANGEN_QUALIFIED_FOR_CONTROLLED_IMPORT**

Read-only qualification only. No Rausgegangen events imported. No staging canonical mutations. No production access.

| Item | Value |
|------|-------|
| Branch | `rebuild/event-core-clean` |
| Baseline commit | `59cfd93c68f9bc7f85479966cf15301ba2262e98` |
| Decision state | `M9_4A_RAUSGEGANGEN_QUALIFIED_FOR_CONTROLLED_IMPORT` |
| Artifacts | `artifacts/m9-4a-rausgegangen-germany-discovery/` |
| Orchestrator | `app-v2/scripts/run-m9-4a-rausgegangen-germany-discovery.ts` |

---

## 1. Source architecture

Rausgegangen (`rausgegangen.de`) is a **server-rendered HTML** discovery network (not Next/Nuxt SPA).

| Surface | Pattern | Role |
|---------|---------|------|
| City home | `/{city-slug}/` | Full SSR listing (~400–470 event links per major city) |
| Tag filter | `/{city}/tags/{tag}/` | Category-filtered subset (e.g. `/cologne/tags/techno/`) |
| Event detail | `/events/{slug}/` | Primary evidence via **schema.org Event JSON-LD** |
| Sitemap | `sitemap-events.xml` (+ 37 paginated files) | National event URL index (~370k+ historical URLs) |
| Ticketing | `t.rausgegangen.de`, `zentrale.events`, outbound providers | Redirect / affiliate ticket targets |
| Images | `imageflow.rausgegangen.de`, S3 `rausgegangen/` bucket | Event flyers |

City slugs are **English** (`cologne`, not `koeln`). Detail pages expose reliable `Event` JSON-LD: title, description, start/end, venue, address, image, offers (price + ticket URL), organizer.

---

## 2. Access & reliability

| Metric | Result |
|--------|--------|
| Listing fetch success | 40 / 45 priority regions |
| Listing fetch failed | 5 (unreachable slugs) |
| Detail fetch success | 2500 / 2500 (bounded sample) |
| Blocked requests | 0 |
| Timeouts | 0 |
| JSON-LD parse failures | 0 |

Conservative rate limiting: 250ms delay, concurrency 2 (listing) / 3 (detail), HTTP cache reuse.

---

## 3. Geographic coverage

**40 reachable priority metros** enumerated. Coverage spans **14 Bundesländer** with meaningful listing volume.

| Classification | Regions (approx.) |
|----------------|-------------------|
| STRONG (300+ listing events) | Cologne, Berlin, Hamburg, Munich, Leipzig, Dortmund, … |
| MODERATE (80–299) | Several secondary metros |
| WEAK / NONE | Some slugs unreachable or low volume |

NRW remains the densest cluster (9 regions, ~3000 listing entries in this run). Berlin, Hamburg, Bavaria, Baden-Württemberg, Saxony show **strong non-NRW coverage**.

**Not Germany-complete:** Rausgegangen also lists Austrian/locality pages in sitemap; this run focused on **German priority metros** only.

**Discovery mode:** `STRATIFIED_SAMPLE` for qualification — 45 priority city listings + 2500 detail enrichments. Full national enumeration would require sitemap-scale crawl (370k+ URLs); not claimed as exact totals.

---

## 4. Raw discovery

| Metric | Value |
|--------|-------|
| Raw listing entries | ~14,500 (with cross-city duplicates) |
| **Unique event URLs** | **11,095** |
| Duplicate listing entries | ~3,400 |
| Regions covered | 40 reachable |

---

## 5. Detail-enriched upcoming inventory (n=2500)

| Lifecycle | Count |
|-----------|-------|
| Upcoming / ongoing (detail-enriched) | 2500 |
| Past (not in detail priority sample) | remainder of 11,095 |

---

## 6. Electronic relevance (detail-enriched upcoming)

| State | Count |
|-------|-------|
| HIGH | 178 |
| LIKELY | 4 |
| AMBIGUOUS | 1,499 |
| IRRELEVANT | 819 |

Rausgegangen is **culture/nightlife-heavy**; electronic events are a minority of total inventory but still substantial in absolute terms. Relevance uses existing `relevance-classifier` / `classifyDetailRelevance` (not Rausgegangen-specific).

**Important parser fix during M9.4A:** global page navigation tag links were initially polluting genre/relevance evidence. Fixed by using breadcrumb categories + description only.

---

## 7. Genre distribution (relevant subset)

Top signals among relevant detail-enriched events include **Techno, House, Trance, Psytrance, Electronic** and mixed party labels. Many events carry only weak category breadcrumbs (`Party`); description hashtag / text parsing supplements explicit claims.

---

## 8. Unknown genre terms

Captured in `unknown-genre-candidates.json` via B.3.2 registry. No taxonomy expansion applied in M9.4A.

---

## 9. Description quality

JSON-LD descriptions are generally editorial. `separateStructuredEventContent()` applied; **structured description leakage = 0** on proposed READY batch.

---

## 10. Lineup quality

Lineup extraction from Rausgegangen descriptions is **partial** — many events list DJs in prose but not structured lineup blocks. Proposed batch tolerates missing lineup where contract allows (`REQUIRED_IF_EVIDENCE_EXISTS`).

---

## 11. Media quality

Event-specific S3 / imageflow flyers present for majority of detail-enriched electronic candidates. Venue/generic branding filtered via existing `media-classifier`.

---

## 12. Ticket quality

Ticket targets commonly route through `t.rausgegangen.de` or outbound providers (ticket.io, Humanitix, etc.). Redirect chains recorded; **no guessed URLs**. Proposed READY batch: `unsafeTicketTargets = 0`, `knownWrongEventTicketTargets = 0`.

---

## 13. Overlap with Eternal Rave

Staging catalog: **48 published events** at qualification time.

| Match state (detail-enriched) | Count |
|-----------------------------|-------|
| EXISTING_EXACT | 0 |
| EXISTING_STRONG | 1 |
| POSSIBLE_MATCH | 0 |
| NET_NEW | majority of relevant electronic |

Low overlap with current ~48-event inventory is expected — Rausgegangen adds broad city coverage beyond current ticket.io / official sources.

---

## 14. Enrichment value (existing matches)

~10 existing-match enrichment opportunities identified where Rausgegangen could supplement description, media, or ticket evidence (report-only, not applied).

---

## 15. Net-new relevant events

**Within 2500 detail-enriched upcoming sample:**

| Metric | Count |
|--------|-------|
| Net-new relevant (HIGH/LIKELY + NET_NEW) | **181** |
| Quality-ready (electronic domain + NET_NEW + contract pass) | **195** |

**Extrapolation (honest range, not exact):** if similar density holds nationally, Rausgegangen likely exposes **hundreds** of net-new electronic events — consistent with M9.3A order-of-magnitude (~120–180 NRW) but **re-measured** against current staging inventory and broader city set.

---

## 16. Quality-ready events

195 candidates in detail sample pass `NEW_EVENT_QUALITY_CONTRACT` dry-run with `qualityContractBypass = 0` for electronic NET_NEW events.

---

## 17. Source bias & limitations

- Culture/general nightlife skew
- NRW + major metros strongest
- Festival coverage lighter than club listings
- Lineup structure weaker than ticket.io
- Full national electronic total **not exactly enumerated** (bounded detail sample)
- Austrian/locality URLs exist in sitemap (excluded from German priority run)

---

## 18. Proposed M9.4B batch (15 events — NOT IMPORTED)

Diverse batch selected across cities/Bundesländer/genres/ticket providers. Examples:

| Title | City | Genres | Ticket |
|-------|------|--------|--------|
| Utopian Summer | Köln | Psytrance, Techno | outbound |
| … | … | … | … |

Full batch: `artifacts/m9-4a-rausgegangen-germany-discovery/proposed-m9-4b-batch.json`

All 15 pass quality contract dry-run with `qualityContractBypass = 0`.

---

## 19. Manual QA sample

`manual-qa-pack.json` — 15 candidates with title, date, venue, URL, relevance, genres, ticket, media, match state, quality state.

---

## 20. Staging mutation proof

| Table | Before | After | Δ |
|-------|--------|-------|---|
| events | 48 | 48 | 0 |
| event_tickets | 47 | 47 | 0 |
| event_lineup | 188 | 188 | 0 |
| event_genres | 84 | 84 | 0 |
| event_sources | 96 | 96 | 0 |

---

## 21. Production safety

`productionMutations = 0` — production project not linked.

---

## 22. Recommendation

**Proceed to M9.4B — Controlled Rausgegangen Staging Import** when explicitly authorized.

Rausgegangen is viable as a **high-coverage Germany-wide discovery layer** complementary to ticket.io network discovery. Use:

1. City listing discovery (generic `RausgegangenNetworkDiscovery`)
2. JSON-LD detail enrichment
3. Existing identity / relevance / quality contract pipeline
4. Controlled 15-event first batch with full recertification

**Do not** build per-city connectors — data-driven region config is sufficient.

---

## Baseline recertification (staging)

| Metric | Value |
|--------|-------|
| eligiblePublishedEvents | 48 |
| genrePresenceCoverage | 100% |
| explicitGenreEvidenceParity | 100% |
| recoverableExplicitGenreMissing | 0 |
| structuredDescriptionLeakage | 0 |
| recoverableLineups | 0 |
| duplicateGroups | 0 |

---

## Tests

| Suite | Result |
|-------|--------|
| `rausgegangen-discovery.test.ts` | 4/4 pass |
| structured-content-separation | 9/9 pass |
| genre-evidence-parity | 6/6 pass |
| ticket-io-first-batch-correction | 10/10 pass |
| **Total** | **29/29 pass** |

---

## STOP

M9.4A complete. **No import performed.** M9.4B requires explicit approval.
