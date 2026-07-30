# Ticket Kings Production Report — Sprint 32

**Status:** Production active (Sprint 33.3 live import validated 2026-07-30)  
**Date:** 2026-07-30  
**Source ID:** `source-affenkaefig-ticket-kings`  
**Role:** Enrichment (`ticketing`) — not a primary event source

---

## Summary

Ticket Kings is the second production ticket platform integrated via the **unchanged** generic `ticket_platform` layer from Sprint 30/31. Only a new adapter, registry entry, source factory, migration, fixtures, and tests were added — no structural connector changes.

---

## Adapter

| Item | Value |
|------|-------|
| Platform ID | `ticket_king` |
| Adapter | `adapters/ticket-kings-adapter.ts` |
| CMS | WordPress + The Events Calendar (Tribe Events) |
| List URL | `https://ticketkings.de/all-events/` |
| Parsing | JSON-LD `Event` blocks (primary) + Tribe list HTML fallback |
| Detail parsing | `parseTicketKingsEventDetailHtml()` — checkout provider ID from Night Manager embed |
| Rate limit | 15 requests/minute (shared connector definition) |
| Timezone | `Europe/Berlin` (IANA only) |

**Fields:** `external_id`, `title`, `organizer`, `venue`, `start`, `end`, `timezone`, `image`, `ticketUrl`, `canonicalUrl`, `priceAmount` (when available), `checkoutProviderId` (metadata).

---

## Wiederverwendete Architektur (unchanged)

| Component | Reused |
|-----------|--------|
| `TicketPlatformConnector` | ✓ |
| `ticket-platform-fetch.ts` | ✓ (+ `checkoutProviderId` in metadata) |
| `electronic-music-scope-filter.ts` | ✓ |
| `normalize-ticket-event.ts` | ✓ |
| `import-update-service` enrichment | ✓ |
| `import-event-publish-service` enrichment branch | ✓ |
| `duplicate-detection-service` enrichment scoring | ✓ |
| `ImportAggregationService` | ✓ |
| Scheduler / review / trust pipeline | ✓ |

**Only adapter-specific code:** `ticket-kings-adapter.ts`, `ticket-kings-source.ts`, fixtures, tests, migration.

---

## Scope Filter

Bootshaus shop fixture (`ticket-kings-affenkaefig-events.html`):

| Metric | Count |
|--------|------:|
| Discovered (JSON-LD `Event`) | 5 |
| Accepted (electronic / allowed venue or organizer) | 4–5 |
| Rejected | 0–1 |

Stuttgart MDMA event may pass via organizer `M.D.M.A` and electronic keywords. Comedy/theater/sport events rejected by shared filter (unit tested).

---

## Enrichment

When a Ticket Kings record matches an existing canonical event:

- **Ticket URL** filled when missing
- **Prices** available on import record (`priceAmount` / `priceCurrency`) — list pages rarely expose prices; detail pages + Night Manager embed for availability
- **Image** only when canonical event has none
- **Title, description, dates, venue, sourceId** never overwritten
- Ticket Kings registered as additional origin via multi-source references

---

## Neue Events

Unmatched events: `Review → Trust → Publish` with `manual_review` — no special handling.

---

## Duplicate Detection

| Scenario | Result |
|----------|--------|
| Affenkäfig canonical + Ticket Kings same event | Integration test: admin count unchanged, duplicate score ≥ 70 |
| Ticket URL match | Unit test: score ≥ 70 via `url:ticketUrl` key |
| Bootshaus + Ticket.io | Sprint 31 regression: unchanged |
| Affenkäfig website import | Sprint 32 regression: unchanged |

Cross-source enrichment validated for Ticket Kings + Affenkäfig ecosystem (Essigfabrik / MDMA / Underland events).

---

## Scheduler

| Setting | Value |
|---------|-------|
| `schedule_enabled` | `true` |
| `schedule_interval_preset` | `every_6_hours` |
| `polling_interval_minutes` | 360 |
| Migration | `20260764000000_sprint32_ticket_kings_production.sql` |

---

## Ticket.io ↔ Ticket Kings Comparison

| Aspect | Ticket.io | Ticket Kings |
|--------|-----------|--------------|
| Platform ID | `ticket_io` | `ticket_king` |
| HTML strategy | JSON-LD `MusicEvent` on shop list | JSON-LD `Event` (Tribe) + list HTML fallback |
| Shop model | Per-club subdomain (`*.ticket.io`) | Central `ticketkings.de` |
| Checkout | ticket.io native | Night Manager embed (`nacht-manager.de`) |
| Detail pages | Often 403 to bots | JSON-LD + embed on detail |
| Prices on list | JSON-LD `Offer` | Rare; detail meta / embed |
| Scope (prod) | Bootshaus shop | Affenkäfig ecosystem (Essigfabrik, MDMA, …) |
| Trust / priority | 70 / 65 | 68 / 64 |
| Connector changes | None for Sprint 32 | None — adapter only |

---

## Known Limitations

1. **List-page prices:** Tribe list JSON-LD often lacks `offers`; prices require detail fetch or Night Manager API.
2. **Slug drift:** Affenkäfig website slugs may differ from Ticket Kings URLs — matching uses `day-venue` + title, not URL alone.
3. **Detail fetch:** Generic fetch layer is list-first; detail parser exported for future `maxDetailPages` extension.
4. **Global shop:** `/all-events/` includes non-Affenkäfig promoters; scope filter limits to electronic venues/organizers.

---

## Tests

| Suite | Result |
|-------|--------|
| `src/data/__tests__/` | 111 / 111 |
| Ticket platform (io + kings) | 14 / 14 |
| Production integration (Bootshaus, Affenkäfig, Ticket.io, Ticket Kings) | 16 / 16 |
| Import + aggregation regression | 193 / 193 |

---

## Git

- Commit: `feat(ticket-platform): integrate ticket kings production source`
- Tag: `ticket-kings-production-ready`
