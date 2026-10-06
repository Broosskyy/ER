# M9.3B.1 — Ticket.io Network Discovery (Read-Only Dry Run)

**Date:** 2026-09-02 (Europe/Berlin)
**Branch:** `rebuild/event-core-clean`
**Baseline HEAD:** `e3e012838738680a6b01efad691776f64052cf30`
**Status:** `M9_3B_1_TICKETIO_NETWORK_DISCOVERY_DRY_RUN_VERIFIED`

---

## Preflight

| Check | Result |
|---|---|
| Branch | `rebuild/event-core-clean` |
| HEAD | `e3e0128` (matches remote) |
| Staging target | Verified via `verifyLinkedStagingTarget` |
| Production linked | **No** (`assertProductionNotLinked`) |
| Staging consumer baseline | **28 eligible events preserved** (no writes) |

---

## Architecture Delivered

Generic read-only discovery layer under:

`app-v2/server/official-connectors/ticket-evidence/network-discovery/`

| Module | Role |
|---|---|
| `ticket-io-network-discovery.ts` | Orchestrator — shop fetch, list parse, dedupe, detail sampling, summary |
| `shop-seeds.ts` | Data-driven NRW seed shops + outbound shop merge |
| `event-candidate.ts` | Lifecycle, identity keys, network dedupe |
| `relevance-classifier.ts` | Electronic relevance (HIGH / LIKELY / AMBIGUOUS / IRRELEVANT) |
| `match-staging-catalog.ts` | Read-only staging comparison via existing `matchEventToCatalog` |
| `media-classifier.ts` | Ticket.io media role classification |
| `outbound-sources.ts` | Outbound source graph (organizer, venue, social, ticket) |
| `shop-scorer.ts` | Shop value scoring + enablement tiers |
| `genre-coverage.ts` | Multi-label genre inference |

**Reused (not duplicated):** `parseTicketIoShopListHtml`, `parseTicketIoDetailDom`, `extractVisibleAdmissionPriceFromTicketIoBody`, `ticket-offer-role`, `event-matcher`, `consumer-event-lifecycle`.

**Dry-run script:** `app-v2/scripts/run-m9-3b-1-ticketio-network-discovery.ts`

**Artifacts:** `artifacts/m9-3b-1-ticketio-network-discovery/`

---

## Network Investigation Summary

- **Shop pattern:** `https://{slug}.ticket.io/` (JSON-LD `MusicEvent` blocks on shop root)
- **Event pattern:** `https://{slug}.ticket.io/{providerEventId}/` (6–12 char IDs)
- **Pagination:** Not observed on sampled roots; full upcoming inventory embedded in JSON-LD
- **Portal surface:** `portal.srvded.ticket.io` reachable; additional shops discovered via outbound links
- **No anti-bot bypass** — standard HTTPS fetch with declared audit User-Agent

---

## Discovery Metrics

| Metric | Value |
|---|---|
| `totalShopsDiscovered` | 25 |
| `reachableShops` | 25 |
| `activeShops` | 19 |
| `totalUpcomingTicketIoEvents` | 97 |
| `highRelevanceEvents` | 16 |
| `likelyRelevantEvents` | 1 |
| `ambiguousEvents` | 80 |
| `irrelevantEvents` | 0 |
| `existingExact` | 10 |
| `existingStrongMatch` | 0 |
| `possibleMatch` | 0 |
| `netNewRelevantEvents` | 7 |
| `reviewRequired` | 0 |

### Eternal Rave Comparison (read-only)

- Staging published events loaded: **30** (includes archived-filtered consumer exclusions)
- **10 ticket.io discoveries** matched existing canonical events **exactly** via ticket URL binding + matcher
- **7 net-new relevant** candidates identified (not written)
- **No duplicate canonical proposals** for Bootshaus / Nibirii / Chris Stussy overlap

### Golden Regression Anchors

| Anchor | Discovery | Match | Duplicate Risk |
|---|---|---|---|
| Chris Stussy | Found as `CHRIS STASSY` on ticket.io | `EXISTING_EXACT` → `8a8eb9b7` | **No** |
| NYE 2026 | Found | `EXISTING_EXACT` → `b314fd67` | **No** |
| ZAAGSTEP | Not in shop JSON-LD at scrape time | — | — |
| Unreal Weekender Night I | Not in shop JSON-LD at scrape time | — | — |

Chris/NYE correctly bind to existing canonical events without proposing net-new duplicates.

---

## Coverage

### By City (relevant upcoming)

| City | Count |
|---|---|
| Köln | 2 |
| Düsseldorf | 1 |
| Unknown | 94 |

*City inference limited on list-only JSON-LD; detail sampling needed for fuller NRW city breakdown.*

### By Genre / Type

| Type | Count |
|---|---|
| Ambiguous | 93 |
| Electronic Festival | 4 |

*Broad shop inventories (e.g. Stadtgarten) skew ambiguous until genre/detail enrichment.*

---

## Ticket Evidence Quality

| Signal | Count (relevant upcoming) |
|---|---|
| Event-specific ticket target | 97 |
| List minimum admission price | 97 |
| Multiple visible products (detail) | 0 (list-only default) |
| Sold-out signal | 0 |
| Admission-class labels (detail) | 0 |

List JSON-LD provides reliable minimum prices. Detail-page sampling (3 events/shop) required for Doorsale/Blind Ticket/phase semantics — architecture wired, limited by dry-run sample budget.

---

## Media Evidence

| Signal | Count |
|---|---|
| Events with media | 0 |
| Event-specific media | 0 |
| Lineup flyers | 0 |

Media classification layer implemented; shop list JSON-LD does not expose event images. Detail fetch path collects CDN URLs when present.

---

## Top Shop Candidates

| Tier | Shop | Upcoming | High Rel. | Net-New Rel. | Notes |
|---|---|---:|---:|---:|---|
| **TIER_1_ENABLE_FIRST** | `bootshaus-club` | 12 | 12 | 2 | 100% electronic ratio; verified canonical overlap |
| **TIER_2_ENABLE_LATER** | `stadtgarten` | 68 | 4 | 4 | Mixed inventory; **capped** — never auto-promoted on raw count |
| **TIER_2_ENABLE_LATER** | `gewoelbe`, `glow`, `zakk`, `nachtresidenz` | varies | varies | varies | Moderate electronic signal |
| **SUPPLEMENTAL_ONLY** | `aura`, `tonite` | low | low | 0 | Ticket evidence supplement potential |
| **REJECT / INACTIVE** | `nibirii-festival`, `odonien` | 0 | 0 | 0 | No current JSON-LD events on root |

---

## Write Guarantee

| Guard | Value |
|---|---|
| `newEventWrites` | **0** |
| `eventUpdates` | **0** |
| `ticketWrites` | **0** |
| `mediaWrites` | **0** |
| `productionMutations` | **0** |

No source registry activation. No scheduler changes.

---

## Tests

```
test:connectors  → 224 passed (includes 12 new network-discovery tests)
test:ingestion   → 93 passed
typecheck        → pass
git diff --check → pass
```

---

## Technical Limitations (M9.3B.2 inputs)

1. **List-only discovery** — many events lack genre/city until detail enrichment
2. **High ambiguous count** — intentional; broad coverage over hard-filtering
3. **ZAAGSTEP / Unreal** — not present in ticket.io shop JSON-LD listings; still covered by Bootshaus official connector
4. **Media** — requires detail-page or CDN parse for most shops
5. **Shop lang variants** — deduped by hostname in orchestrator
6. **28-event consumer baseline** — unchanged; this milestone performs zero staging mutations

---

## Final Status

**`M9_3B_1_TICKETIO_NETWORK_DISCOVERY_DRY_RUN_VERIFIED`**

M9.3B.2 not started.
