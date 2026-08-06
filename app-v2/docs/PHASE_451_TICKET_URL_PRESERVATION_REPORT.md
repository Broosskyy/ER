# Phase 4.5.1 — Ticket URL Preservation and Live UI Validation

**Date:** 2026-08-01  
**Status:** Complete

## Executive Summary

Phase 4.5 website detail reimport restored descriptions but regressed canonical `ticket_url` from event-specific Ticket.io deep links to the generic shop URL `https://bootshaus.ticket.io/`. Root cause was blind `candidate.ticketUrl ?? existing.ticketUrl` in the legacy update path. A shared URL quality gate now prevents downgrade; 12 affected events were corrected in production; post-fix idempotency import preserved deep links.

---

## 1. Root Cause

| Stage | Finding |
|-------|---------|
| **Trigger** | Phase 4.5 Bootshaus website detail enrichment supplied `https://bootshaus.ticket.io/` (shop root) on every event page |
| **Mechanism** | `importUpdateService.buildUpdatedAdminEvent()` used `ticketUrl: candidate.ticketUrl ?? existing.ticketUrl` |
| **Path** | Legacy publish path (`genericSourceFieldTrustMerge=false`) overwrote existing Ticket.io deep links during description update |
| **Not affected** | Prices, venue, lineup, descriptions (those updated correctly) |

### Sample trace — PLAY! Open Air (`evt-1785339406307-kw5r61q`)

| Layer | Value |
|-------|-------|
| Website Origin `source-bootshaus-koeln` | external: `bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln` → ticket: `https://bootshaus.ticket.io/` (shop_root) |
| Ticket.io Origin `source-bootshaus-ticket-io` | external: `bootshaus-club.ticket.io/gPHSUV3l/` → ticket: `https://bootshaus-club.ticket.io/gPHSUV3l/` (event_specific) |
| Canonical before fix | `https://bootshaus.ticket.io/` |
| Canonical after fix | `https://bootshaus-club.ticket.io/gPHSUV3l/` |
| Trust decision | `accepted_incoming` — incoming_higher_quality (score 100 vs 20) |

### Sample trace — Bootshaus Sommerfest Part 4 (`evt-1785339415449-xpazmaq`)

Same pattern: website shop root vs Ticket.io `NEtJnQ4A/` deep link. Corrected to `https://bootshaus-club.ticket.io/NEtJnQ4A/`.

### Sample trace — Mallorca event (`evt-1785339377456-7miaf2o`)

Website-only origin; no Ticket.io deep link in import records. Canonical `https://bootshaus.ticket.io/` is correct (shop_root, no better URL available).

### Sample trace — AFFENKÄFIG RULES club event (`evt-1785339005035-wam829k`)

Dual-origin; corrected from shop root to `https://bootshaus-club.ticket.io/B3jK8aPC/`.

---

## 2. Field-Trust Rule Implemented

New module: `src/features/events/domain/ticket-url-quality.ts`

**URL classification:** `event_specific` > `shop_root` > `platform_root` > `invalid`

**Selection priority:**
1. Valid active event-specific ticket URL from ticket-platform Origin
2. Valid official event-specific organizer/venue ticket URL
3. Other trusted event-specific purchase URL
4. Generic shop/root URL only when no event-specific URL exists
5. Empty or generic URLs never overwrite a valid event-specific URL

**Integrated in:**
- `import-update-service.ts` — `buildUpdatedAdminEvent`, `buildEnrichmentAdminEvent`
- `field-trust-merge-service.ts` — create/update merge paths
- `merge-strategy.ts` — multi-origin merge with source-priority tiebreaker on equal quality

---

## 3. Bootshaus Audit (all linked events)

| Metric | Count |
|--------|-------|
| Events audited | 43 |
| With event-specific Origin URL | 18 |
| Canonical already correct (post-fix) | 18 |
| Canonical generic (acceptable — no deep link) | 25 |
| Conflicting URLs | 0 |
| Corrections needed (pre-fix) | 12 |
| Corrections applied | 12 |

Artifact: `docs/real-data/_sprint451_bootshaus_ticket_url_audit.json`

---

## 4. Targeted Corrections Applied

12 events updated (`ticket_url` only). No new Events or Origins. Descriptions, prices, venue data unchanged.

| Event | Old URL | New URL |
|-------|---------|---------|
| PLAY! Open Air | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/gPHSUV3l/` |
| Sommerfest Part 4 | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/NEtJnQ4A/` |
| Into The Madness Pre-Party | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/BcDqml12/` |
| Bootshaus on a Ship Vol. III | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/wUc3uQrR/` |
| Bootshaus Sommerfest | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/vB0cAmWg/` |
| AFFENKÄFIG RULES | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/B3jK8aPC/` |
| NYE 2026 | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/S0cbXDda/` |
| Bootshaus on a Ship Vol. IV | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/4zjKRnsa/` |
| Nibirii Festival 2026 | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/jNAEFLQG/` |
| Sommerfest Closing | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/ycDXwvrm/` |
| Halloween 2026 | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/Hv4f09p8/` |
| LOONYLAND pres. LUCA DANTE… | `bootshaus.ticket.io/` | `bootshaus-club.ticket.io/tA3dBrv7/` |

---

## 5. Cache Invalidation

`importEventPublishService.refreshConsumerFeed()` clears:
- Event Detail cache (`clearEventDetailCache`)
- Home feed cache (`clearHomeFeedRequestCache`)
- Search cache (`clearDiscoverySearchRequestCache`)
- Consumer event repository (`consumerEventRepository.refresh()`)

Called after corrections and after idempotency import.

---

## 6. Second-Run Idempotency

Bootshaus website import after fix:

| Metric | Value |
|--------|-------|
| created | 0 |
| updated | 12 (description/metadata touch only) |
| unchanged | 26 |
| duplicate Origins | 0 |
| canonical count | 114 (unchanged) |
| ticket URL downgrades | 0 |
| corrections needed post-import | 0 |

---

## 7. Live UI Validation

Validated via `scripts/operations/_sprint451-frontend-sample-validation.ts` using production data + `projectCanonicalEventFields` + Event Detail view models (same projection path as running Expo Web UI). Expo Web on `localhost:8081` returned HTTP 200 for all sample event routes.

| Sample | Description | Ticket URL | Price | Provider | Venue/City |
|--------|-------------|------------|-------|----------|------------|
| PLAY! Open Air | 1,849 chars ✓ | `gPHSUV3l/` ✓ | ab 18,00 € ✓ | Bootshaus ✓ | Bootshaus, Köln ✓ |
| Sommerfest Part 4 | 1,015 chars ✓ | `NEtJnQ4A/` ✓ | ab 16,90 € ✓ | Bootshaus ✓ | Bootshaus, Köln ✓ |
| AFFENKÄFIG RULES | 745 chars ✓ | `B3jK8aPC/` ✓ | ab 19,90 € ✓ | Bootshaus ✓ | Bootshaus, Köln ✓ |
| Mallorca NOTRE DAME | 636 chars ✓ | shop root ✓ | — | Bootshaus ✓ | TBA, Palma ✓ |

All three navigation paths (direct, home-nav, search-nav) return identical projection for each sample.

---

## 8. Tests

`src/features/events/domain/__tests__/sprint451-ticket-url-quality.test.ts` — **10/10 passing**

Coverage:
- Event-specific URL beats shop root
- Website reimport preserves Ticket.io deep link
- Generic URL cannot overwrite event-specific URL
- Empty URL cannot overwrite real URL
- Shop root allowed when no deep link exists
- Field-trust merge preservation + Ticket.io upgrade
- Cache invalidation hooks
- Merge-strategy source-priority tiebreaker

Full suite: **1357 passed**, 4 failed (pre-existing: 2 live-fetch timeouts, 1 unrelated approval test — not introduced by Phase 4.5.1).

---

## 9. Canonical / Origin Counts

| | Before | After |
|---|--------|-------|
| Published canonical events | 114 | 114 |
| event_origins rows | 0 | 0 |

---

## 10. Remaining Limitations

1. **25 Bootshaus events** have no Ticket.io deep link in any Origin — shop root is the best available URL (e.g. Mallorca external events, Nature One).
2. **Website detail enrichment** still extracts generic `bootshaus.ticket.io/` from event pages; prevented from downgrading canonical but not yet improved to extract per-event links from page markup.
3. **Direct DB correction** used for the 12 events (surgical `ticket_url` update); future reimports are protected by field-trust but provenance rows for ticket_url were not backfilled for those corrections.
4. **Full test suite** has 4 pre-existing failures unrelated to ticket URL work (live network timeouts, import approval edge case).

---

## Scripts

```bash
# Read-only audit
npx tsx scripts/operations/_sprint451-bootshaus-ticket-url-correction.ts

# Apply corrections + idempotency import
npx tsx scripts/operations/_sprint451-bootshaus-ticket-url-correction.ts --apply

# Frontend sample validation
npx tsx scripts/operations/_sprint451-frontend-sample-validation.ts
```
