# Phase 4.7.1.1 — Ticket Evidence Completion Report

**Generated:** 2026-08-03

## Executive results

| Metric | Count |
|--------|------:|
| Shop-root events upgraded to event-specific Ticket.io page | **7** |
| Shop-root events confirmed shop-root-only (no proven event slug) | **6** |
| Events that gained visible price (this repair pass) | **0** |
| Events that gained visible availability (this repair pass) | **0** |
| Published events with unchanged lineup fingerprints | **108 / 108** |
| Final repair pass mutations | **0** (idempotent) |

## LEVI and BC173 outcomes

| Event | Official page (preserved) | Public CTA destination | Classification |
|-------|---------------------------|--------------------------|----------------|
| **NIGHTSWITHUS presents LEVI** | `https://bootshaus.tv/events/nightswithus-presents-levi` | `https://bootshaus-tickets.ticket.io/YvJnLSXd/` | `upgraded_to_ticket_event_page` |
| **Bootshaus pres. BC173 (let's get loco)** | `https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco` | `https://bootshaus-club.ticket.io/BcDqml12/` | `upgraded_to_ticket_event_page` |
| BC173 Airport Session (related) | `https://bootshaus.tv/events/19-9-26-bc173-airport-session-pres-by-bootshaus` | `https://bootshaus-club.ticket.io/fjspvLe4/` | `upgraded_to_ticket_event_page` |

Evidence: event-specific Ticket.io slugs found in static HTML `<a href>` on official Bootshaus event pages. No slugs were fabricated.

## Representative event validation

| Event | CTA destination | Price visible | Availability visible | Notes |
|-------|-----------------|---------------|----------------------|-------|
| Sommerfest Elektroküche | Ticket Kings event URL (correct) | No | Yes (Verfügbar) | TK page has no JSON-LD `offers` price — `source_genuinely_missing` |
| MDMA | Ticket Kings event URL (correct) | No | Yes (Verfügbar) | Same — no price in accessible TK HTML |
| Bootshaus on a Ship Vol. III | `bootshaus-club.ticket.io/wUc3uQrR/` | Yes (`ab 32,00 €`) | Yes | No regression |
| Blacklist Festival 2026 | `blacklist-festival.ticket.io/BF2Qb7HL/` | No | Unknown | Event page upgraded; list/detail price blocked or absent |
| LEVI | Event-specific Ticket.io | No | Yes | Upgraded from shop root |
| BC173 | Event-specific Ticket.io | No | Yes | Upgraded from shop root |

## Shop-root audit (all 13)

### Upgraded (`upgraded_to_ticket_event_page`) — 7

1. NIGHTSWITHUS presents LEVI → `bootshaus-tickets.ticket.io/YvJnLSXd/`
2. Bootshaus pres. BC173 → `bootshaus-club.ticket.io/BcDqml12/`
3. BC173 Airport Session → `bootshaus-club.ticket.io/fjspvLe4/`
4. Blacklist Festival 2026 → `blacklist-festival.ticket.io/BF2Qb7HL/`
5. Polyamor Bootshaus → `polyamor.ticket.io/PDikPg1v/`
6. Unreal Weekender Night I → `unreal-bootshaus.ticket.io/U1dUL7lG/`
7. Unreal Weekender Night II → `unreal-bootshaus.ticket.io/Zt24QJcV/`

### Confirmed shop-root-only (`confirmed_shop_root_only`) — 6

All **122 pres. @ Palma de Mallorca** events plus **122 pres. JUNO @ Palma**. Official Bootshaus pages contain only generic `bootshaus.ticket.io` nav links and Fourvenues outbound URLs (outside Ticket.io/Ticket Kings scope). Label remains **Ticketshop öffnen**.

## Root cause and fix

**Problem:** Website detail extraction collected ticket links from basic `<a href>` filtering but did not run structured HTML discovery (data attributes, JSON-LD, embedded Ticket.io URLs). Import records therefore stored only the generic Bootshaus shop root even when event pages contained proven event slugs.

**Fix (generic, provider-agnostic):**

- `outbound-ticket-html-discovery.ts` — href, data-attribute, JSON-LD, and embedded URL extraction with ticket-destination filtering
- Wired into `html-strategies.ts` detail extraction and `website-textual-enrichment.ts`
- `EventTicketSection` now surfaces canonical `priceLabel` and `availabilityLabel` when present
- Ops repair `_phase4711-ticket-evidence-completion.ts` — live official-page discovery, canonical writer repair, lineup fingerprint abort, idempotent double-pass

## Ticket Kings price gap (Sommerfest / MDMA)

Live fetch of Ticket Kings event pages shows **no `offers` JSON-LD block and no parseable price in HTML**. Field classification: **`source_genuinely_missing`** for price. Availability inferred as `available` from platform presence (existing canonical logic). Detail purchase flow may load price via NightManager JS (not scraped; no bypass).

## Lineup safety

Pre/post repair SHA-256 lineup fingerprints over `event_lineup_entries`, `event_artists`, and artist name sets: **0 mutations across 108 published events**. JUNO/Nicole da Silva duplication explicitly not touched.

## Deliverables

- `docs/real-data/_phase4711_mobile_baseline.json`
- `docs/real-data/_phase4711_shop_root_evidence.json`
- `docs/real-data/_phase4711_ticket_field_traces.json`
- `docs/real-data/_phase4711_ticket_ui_traces.json`
- `docs/real-data/_phase4711_before_after.json`
- `docs/real-data/_phase4711_repair_backup.json`
- `docs/real-data/_phase4711_repair_runs.json`
- `docs/real-data/_phase4711_acceptance_matrix.json`

## Commands

```bash
npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts baseline
npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts discover
npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts full
```
