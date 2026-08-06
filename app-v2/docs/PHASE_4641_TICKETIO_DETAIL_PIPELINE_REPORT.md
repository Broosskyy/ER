# Phase 4.6.4.1 — Ticket.io Detail Pipeline Report

Generated: 2026-08-02T20:22:50.631Z

## 1. Pipeline trace summary

Stages: **list page** → **slug discovery** (event rows + JSON-LD URLs) → **detail fetch** → **HTML** → **JSON-LD / detail parser** → **normalized payload** → **import record** → **field trust merge** → **canonical publish** → **projection** → **public UI**

### Root cause: `pagesFetched = 0`

Two sequential blockers were identified:

1. **Config gap (fixed):** Production `source_config.ticketPlatform.limits` omitted `maxDetailPages`. Runtime now applies the connector default (`15`) via `withTicketIoEffectiveLimits()`. DB patch uses explicit source IDs (migration previously referenced non-existent `connector_key` on `sources`).
2. **PoW gate (remaining):** With limits enabled, all shops discover detail slugs but **100% of detail HTTP responses return Ticket.io ALTCHA / Security check pages** from server-side fetch. List pages succeed; detail pages require browser PoW.

### Per-source detail fetch audit

| Shop | URLs discovered | Attempted | Fetched | PoW blocked | Stored limit | Effective limit | Detail stage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| lehmannclub | 10 | 10 | 0 | 10 | 0 | 15 | skipped |
| technodampfer | 12 | 12 | 0 | 12 | 0 | 15 | skipped |
| protontheclub | 7 | 7 | 0 | 7 | 0 | 15 | skipped |
| area51events | 4 | 4 | 0 | 4 | 0 | 15 | skipped |
| hmg-concerts | 20 | 20 | 0 | 20 | 0 | 15 | skipped |
| Bootshaus Ticket.io | 15 | 15 | 0 | 15 | 0 | 15 | skipped |

## 2. Parser coverage

- **List JSON-LD (always available):** title, dates, venue, address, geo, price, ticket URL, image, organizer, placeholder performer (`Unbekannt` filtered)
- **List row enrichment:** genres, price overview text, sold-out hints
- **Detail page (PoW-blocked in production fetch):** description, lineup, ticket phases, attributes, FAQ, minimum age, doors, timetable

## 3. Import record audit

Fields available on list JSON-LD flow into `normalized_payload` immediately. Detail-only fields remain absent when `detailEnrichment.skippedReason` is `pow_blocked` or legacy `max_detail_pages_zero`. No silent drops in normalize step — missing fields trace to fetch stage.

## 4. Canonical publish audit

Representative gaps are upstream: import records lack detail-sourced lineups/descriptions. Field trust merge cannot publish fields never imported. Bootshaus on a Ship lineup lives on detail HTML / flyer only.

## 5. Invalid lineup regression

Affected events: 3. Parser fix: reject `^by ` organizer credits; skip title inference for `pres by` patterns. Repair pass re-projects canonical lineups from sanitized import records.

## 6. Generic fixes implemented

- `ticket-io-effective-config.ts` — default `maxDetailPages: 15` when missing from stored config
- `ticket-io-detail-fetch.ts` — slug discovery + fetch audit; `pow_blocked` skip reason
- `ticket-platform-fetch.ts` — per-event `detailEnrichment.pagesFetched` (0/1)
- `lineup-artist-quality.ts` — reject `^by ` prefix fragments
- `ticket-io-title-artists.ts` — skip `pres by` organizer billing titles
- Ops patch — query by explicit Ticket.io source IDs (not `connector_key`)

## 7. Controlled repair

Config patch applied to: source-ticket-io-technodampfer, source-ticket-io-lehmannclub, source-bootshaus-ticket-io, source-ticket-io-area51events, source-ticket-io-hmg-concerts, source-ticket-io-protontheclub

## 8. Before / after metrics

| Metric | Before | After |
| --- | ---: | ---: |
| Import records with pagesFetched>0 | 0 | 0 |
| Complete lineups | 5 | 5 |
| Partial lineups | 30 | 30 |
| Missing lineups | 24 | 28 |
| With description | 10 | 10 |
| With genres | 5 | 5 |
| With price | 63 | 63 |
| Invalid lineups | 4 | 0 |

## 9. Remaining blockers

- **Ticket.io ALTCHA PoW** on all detail page URLs from server-side HTTP client
- Lineups/descriptions only on detail HTML or flyer artwork for many events
- List JSON-LD uses `performer: Unbekannt` placeholder when real lineup is detail-only

## 10. Recommendation for next data field

Before flyer/OCR: evaluate **Ticket.io PoW bypass strategy** (headless browser session, official API, or CDN/event JSON endpoint). Until detail HTML is obtainable server-side, lineup completion for Ticket.io detail-only events cannot reach 100%.

## Artifacts

- `docs/real-data/_phase4641_ticketio_pipeline_trace.json`
- `docs/real-data/_phase4641_ticketio_before_after.json`
- `docs/real-data/_phase4641_invalid_lineups.json`