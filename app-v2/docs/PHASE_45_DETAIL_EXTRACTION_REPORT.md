# Phase 4.5 — Generic Connector Detail Extraction & Data Completeness

**Date:** 2026-08-01  
**Scope:** Connector quality, generic detail lifecycle, Bootshaus restore, Ticket.io detail strategy, admin metrics, tests. No new platforms, no UI redesign.

---

## 1. Connector Capability Matrix

| Source | Type | Level | maxDetailPages | List fields | Detail fields | Lost fields |
|--------|------|-------|----------------|-------------|---------------|-------------|
| Bootshaus Köln | website / html_selector | 2 | **50** (restored) | title, date, image, detailUrl | description (og:), ticket links | structured artists/genres |
| Affenkäfig | website / event_detail_page | 3 | 50 | title, date, image | description, lineup (JSON-LD) | genres |
| Bootshaus Ticket.io | ticket_platform / enrichment | 3 | 15 | title, date, venue, price, ticket | description, lineup (detail HTML) | genres |
| Ticket.io shops (Proton, Lehmann, Area51, …) | ticket_platform | 2–3 | 15 | JSON-LD list | Info tab via detail fetch | genres on list |
| Ticket Kings | ticket_platform | 1 | 0 | list JSON | — | description, lineup |
| Musik die mich antreibt | website | 1–2 | per config | varies | detail when enabled | per connector config |

Capability profiles are computed by `buildConnectorCapabilityProfile()` in `connector-field-coverage.ts`.

---

## 2. Bootshaus Investigation

| Question | Answer |
|----------|--------|
| **When was maxDetailPages set to 0?** | `20260744000000_sprint13_production_integration.sql` (Sprint 13 production seed) |
| **Why?** | Initial Bootshaus integration shipped as stable list-only `html_selector`; detail enrichment was deferred |
| **Was it ever changed?** | No subsequent Bootshaus migration modified `maxDetailPages` until Sprint 4.5 |
| **Can detail be restored?** | **Yes** — detail pages expose full `og:description` (verified in `bootshaus-fixture-snippets.json` PLAY! fixture) |
| **Restore action** | `maxDetailPages: 50`, `eventDetailPage.allowedDomains`, post-list enrichment in `list-detail-enrichment.ts` |

---

## 3. Ticket.io Detail Investigation (Info Tab)

| Field | List JSON-LD | Detail HTML | Detail JSON-LD | Notes |
|-------|-------------|-------------|----------------|-------|
| Description | `N/A` placeholder | Info tab text | Available in fixtures (SHOCKONE) | Detail fetch is best-effort |
| Lineup | Partial in title | Info tab / structured | Parser: `ticket-io-detail-parser.ts` | |
| Ticket phases | Price on list | Info tab | Embedded in HTML | |
| Genres | Overview text only | Rare | Not structured | Low coverage |

**Constraints:** Public shop pages only. PoW challenge pages skip detail fetch. No XHR bypass. `maxDetailPages: 15` added to production Ticket.io source factory.

---

## 4. Generic Detail Lifecycle

```
LEVEL 1 — list_only
LEVEL 2 — list_plus_detail (og/meta HTML)
LEVEL 3 — list_detail_structured (JSON-LD, embedded JSON)
LEVEL 4 — official_api
```

**Website flow (all connectors):**

```
discover list → extract event URLs → fetch detail pages → extract fields → merge (never downgrade) → CanonicalImportEvent
```

**Implementation:**

- `detail-extraction-lifecycle.ts` — levels, `mergeListDetailFields`, capability resolver
- `website/list-detail-enrichment.ts` — reusable post-list detail pass
- `website/processor.ts` — hooks enrichment when `html_selector` + `maxDetailPages > 0`
- `extractDetailPageEventWithStrategy` — shared detail parser (og:meta + JSON-LD)

---

## 5. Connector Quality Scores

`calculateConnectorQualityScore()` combines:

- Field coverage ratings (35%)
- Detail extraction level (25%)
- Operational health (20%)
- Average event completeness (20%)

Displayed in Admin source detail via `formatConnectorCapabilitySummaryDe()`.

---

## 6. Event Completeness Metrics

`calculateEventDataCompleteness()` tracks 13 fields (title, date, venue, organizer, description, artists, genres, ticket, price, image, address, city, country) and returns a percentage.

---

## 7. Production Validation

Audit script: `npx tsx scripts/operations/_sprint45-detail-extraction-audit.ts`  
Output: `docs/real-data/_sprint45_detail_extraction_audit.json`

Validated event needles: PLAY!, Sommerfest, Elektroküche, Musik die mich antreibt, WESTBAM, TECHNO DAMPFER, Lehmann, Area51, Affenkäfig, Bootshaus.

---

## 8. Fields Recoverable After Re-import

| Source | Recoverable fields | Mechanism |
|--------|-------------------|-----------|
| Bootshaus website | description | Re-import with `maxDetailPages=50` |
| Affenkäfig | description (already in import records) | Repair plan / re-publish |
| Ticket.io | description, lineup | Detail fetch when PoW absent |

**Rule:** Only fill missing or higher-quality fields — never downgrade (Phase 4.4 merge rules).

---

## 9. Regression Tests

| Test file | Coverage |
|-----------|----------|
| `sprint45-detail-extraction.test.ts` | lifecycle, profiles, completeness, quality, Bootshaus og:description |
| `sprint45-list-detail-enrichment.test.ts` | generic list→detail merge |
| `sprint45-bootshaus-detail-migration.test.ts` | DB migration |
| `admin-source-display.test.ts` | admin capability labels |

---

## 10. Remaining Limitations

1. **Ticket.io list JSON-LD** — `description: "N/A"` until detail fetch succeeds
2. **Bootshaus** — no structured lineup/genres on public pages; description via og:meta only
3. **Ticket Kings** — deprecated, list-only
4. **PoW challenges** — may block live Ticket.io detail enrichment
5. **Production repair apply** — not enabled; use repair plan + controlled re-import

---

## Success Criteria

- [x] Universal detail lifecycle defined (levels 1–4)
- [x] Every production connector audited with field coverage matrix
- [x] Bootshaus detail extraction restored (config + migration + framework)
- [x] Reusable website detail framework (`list-detail-enrichment.ts`)
- [x] Ticket.io detail strategy documented + `maxDetailPages` enabled
- [x] Connector quality + event completeness in admin
- [x] Regression tests added
- [ ] Production re-import of Bootshaus events (requires controlled ops run)
