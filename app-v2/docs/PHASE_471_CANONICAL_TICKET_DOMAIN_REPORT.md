# Phase 4.7.1 — Canonical Ticket Domain Report

**Generated:** 2026-08-03  
**Status:** Complete

## Results summary (production)

### Ticket acceptance counts

| State | Before | After |
|-------|--------|-------|
| **Total published** | 108 | 108 |
| `direct_purchase_correct` | 22 | 22 |
| `ticket_event_page_correct` | 64 | 64 |
| `official_event_page_only` | 3 | 3 |
| `shop_root_fallback_only` | 13 | 13 |
| `listing_fallback_only` | 0 | 0 |
| `external_detail_blocked` | 0 | 0 |
| `source_has_no_ticket_data` | 3 | 3 |
| `review_required` | 3 | 3 |
| `incorrect` | **0** | **0** |

### Key metrics

| Metric | Value |
|--------|-------|
| Corrected ticket field writes (repair pass 1) | **7** (`websiteUrl` separation only) |
| Repair pass 2 mutations | **0** (idempotent) |
| Remaining shop-root fallbacks | **13** (no event-specific slug in any source) |
| Events with prices | **63** |
| Events with availability signals | **36** |
| Events with ticket phases stored | **0** |
| Homepages incorrectly used as ticket CTA | **0** |
| Lineup mutations during repair | **0** (SHA fingerprint verified per event) |

### Representative events

| Event | Ticket CTA | Official page | Acceptance |
|-------|-----------|---------------|------------|
| **LEVI** | `bootshaus.ticket.io/` (shop root) | `bootshaus.tv/events/nightswithus-presents-levi` | `shop_root_fallback_only` — CTA: *Ticketshop öffnen* |
| **Ship Vol. III** | `bootshaus-club.ticket.io/wUc3uQrR/` | `bootshaus.tv/events/bootshaus-on-a-ship-vol-iii` | `ticket_event_page_correct` |
| **Ship Vol. IV** | Event-specific ticket.io slug | separate official page | `ticket_event_page_correct` |
| **Sommerfest Elektroküche** | Ticket Kings event URL | Affenkäfig official event page | `ticket_event_page_correct` |
| **MDMA** | Ticket Kings / ticket.io event URLs | preserved separately | `ticket_event_page_correct` |
| **Blacklist Festival** | shop root (no slug in imports) | `bootshaus.tv/events/10-2026-blacklist-festival-2026` | `shop_root_fallback_only` |
| **BC173** | shop root | official Bootshaus event page | `shop_root_fallback_only` |

All 13 shop-root events are individually classified in `_phase471_shop_root_audit.json` with `eventSpecificInImports: false` — no fabricated deep links.

## Architecture

### Canonical ticket contract

`CanonicalTicketSnapshot` (`canonical-ticket-domain.ts`) separates:

- `officialEventUrl` → persisted as `events.website_url`
- `purchaseUrl` / `publicCtaUrl` → persisted as `events.ticket_url` (backward-compatible CTA)
- `destinationClass` (9 values), price range, availability, phases, provenance

### One read path

`readCanonicalTicket()` — used by Event Detail CTA, `toEventDisplayModel()`, and ops audits.

### One write path

`writeCanonicalTicketFields()` — used by import publish (`import-event-field-mapper.ts`) and production repair script.

### URL classification

`classifyTicketDestination()` maps every URL to exactly one destination class using generic host/path signals (connector adapters remain provider-specific).

### CTA truthfulness

| Destination class | German CTA |
|-------------------|------------|
| `direct_purchase` | Tickets kaufen |
| `ticket_platform_event` | Tickets ansehen |
| `official_event_page` | Eventseite öffnen |
| `ticket_platform_listing` | Tickets suchen |
| `ticket_platform_root` | Ticketshop öffnen |
| homepage | Veranstalterseite öffnen |

## Deliverables

| File | Purpose |
|------|---------|
| `docs/real-data/_phase471_ticket_preflight.json` | Full preflight matrix |
| `docs/real-data/_phase471_ticket_field_matrix.json` | Per-field ticket state |
| `docs/real-data/_phase471_ticket_url_classification.json` | All URL classifications |
| `docs/real-data/_phase471_shop_root_audit.json` | 13 shop-root events individually classified |
| `docs/real-data/_phase471_ticket_repair_backup.json` | Pre-repair backup + lineup fingerprints |
| `docs/real-data/_phase471_ticket_repair_runs.json` | Repair pass log |
| `docs/real-data/_phase471_ticket_before_after.json` | Before/after per event |
| `docs/real-data/_phase471_ticket_acceptance_matrix.json` | Acceptance summary |

## Operations

```bash
npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts preflight
npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts backup
npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts repair
npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts full
```

## Tests

- `canonical-ticket.test.ts` — 15 tests (classification, selection, blocked detail, price, CTA, idempotency)
- `typecheck:app` — pass
- `build:web` + `validate:build-output` — pass

## Remaining known gaps

1. **13 shop-root fallbacks** — no event-specific ticket.io slug exists in website imports or ticket-platform enrichment; correctly labeled *Ticketshop öffnen*, not *Tickets kaufen*.
2. **Ticket phases** — structured phases not yet persisted in production (`phasesPresent: 0`); parser produces phases but detail fetch often blocked.
3. **3 review_required** — conflicting ticket candidates from multiple origins; manual review recommended.
