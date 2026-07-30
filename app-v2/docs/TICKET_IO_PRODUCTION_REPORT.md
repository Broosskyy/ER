# Ticket.io Production Report — Sprint 31

**Status:** Production enabled  
**Date:** 2026-07-30  
**Source ID:** `source-bootshaus-ticket-io`  
**Role:** Enrichment (`ticketing`) — not a primary event source

---

## Summary

Ticket.io is integrated as the first production ticket platform connector using the generic `ticket_platform` architecture from Sprint 30. The Bootshaus shop (`https://bootshaus-club.ticket.io/`) is registered as an enrichment source with `manual_review` publish mode. Existing Bootshaus website events are matched and enriched (ticket URL, optional image) instead of creating duplicates.

---

## Connector

| Item | Value |
|------|-------|
| Connector key | `ticket_platform` |
| Adapter | `ticket_io` (`adapters/ticket-io-adapter.ts`) |
| Parsing strategy | JSON-LD `MusicEvent` blocks from shop list HTML |
| Rate limit | 15 requests/minute |
| Canonical URL | `https://bootshaus-club.ticket.io/{eventSlug}/` |
| Timezone normalization | Offset datetimes → `Europe/Berlin` (IANA only) |

**Supported fields:** `external_id`, `title`, `organizer`, `venue`, `start`, `end`, `timezone`, `image`, `ticketUrl`, `canonicalUrl`, `priceAmount`, `priceCurrency`, `ticketStatus`.

**Shop-specific logic** is confined to `ticket-io-adapter.ts`. All orchestration uses the generic `TicketPlatformConnector` and `ticket-platform-fetch.ts`.

---

## Scope Filter

Bootshaus shop fixture (`ticket-io-bootshaus-shop.html`):

| Metric | Count |
|--------|------:|
| Discovered (JSON-LD `MusicEvent`) | 17 |
| Accepted (electronic / allowed venue) | 17 |
| Rejected | 0 |

Filter checks: title, description, categories, organizer, venue, known electronic keywords, excluded categories (comedy, theater, sport, schlager, klassik, pop, rock, corporate).

Bootshaus shop events pass via `allowedVenues: ['bootshaus']` and electronic event naming. No non-electronic events were present in the Bootshaus fixture run.

Synthetic rejection test: comedy/theater titles correctly rejected (`excluded_category`).

---

## Normalization

- `external_id` = canonical ticket.io event URL  
- `start` / `end` preserved as ISO-8601 instants  
- `timezone` stored as `Europe/Berlin` (no UTC offset strings persisted)  
- `ticketUrl` and `canonicalUrl` aligned to shop slug URLs  
- `sourceMetadata.enrichmentSource = true` on all ticket platform records

---

## Enrichment

When a ticket.io record matches an existing event (Bootshaus website or future sources):

- **Ticket URL** filled when missing on canonical event  
- **Image** filled only when canonical event has no image (quality-preserving)  
- **Title, description, dates, venue** never overwritten (`buildEnrichmentAdminEvent`)  
- **Source ID** on published event preserved (official source wins)  
- Ticket platform registered as additional origin via multi-source references on publish

Merge authority: ticket/partner sources receive +30 priority on `ticketUrl` in `merge-strategy.ts`.

---

## New Events

Unmatched ticket.io events enter the standard pipeline:

`Review → Trust → Publish` (no special handling)

Publish mode: **`manual_review`** — unmatched events stay in the review queue; no auto-publish of unknown events.

---

## Duplicate Detection

| Scenario | Expected | Verified |
|----------|----------|----------|
| Bootshaus website + Ticket.io same night | 1 event | Integration test: admin event count unchanged after ticket.io import |
| Duplicate score ≥ 70 on matched records | Yes | Integration test passes |
| Title similarity threshold for enrichment | 50 (vs 70 default) | Unit test |
| `venueId` in matching catalog | Required for venue+date+title match | Fixed in `mapEventToDuplicateCandidate` |
| Pipeline vs post-match duplicate score | Higher score wins | Fixed in `toImportRecordInput` |

Blocking keys include `url:{ticketUrl}` in duplicate candidate generator.

Affenkäfig cross-match is architecturally supported (scope filter includes `affenkaefig`) but not integration-tested in Sprint 31 — Bootshaus shop is the first production target.

---

## Review Decisions

- Source: `review_required = true`, `publish_mode = manual_review`  
- Matched enrichment records: eligible for publish as updates to existing events  
- Unmatched records: remain in review queue until operator approval  
- `blockOnDuplicate: false` — duplicates enrich rather than block

---

## Scheduler

| Setting | Value |
|---------|-------|
| `schedule_enabled` | `true` |
| `schedule_interval_preset` | `every_6_hours` |
| `polling_interval_minutes` | 360 |
| Migration | `20260763000000_sprint31_ticket_io_production.sql` |

Interval aligned with Bootshaus/Affenkäfig production sources.

---

## Tests

| Suite | Result |
|-------|--------|
| `src/data/__tests__/` | 108 / 108 passed |
| Ticket platform unit tests | 10 / 10 passed |
| `ticket-io-integration.test.ts` | 4 / 4 passed |
| `sprint13-production-integration.test.ts` | 8 / 8 passed (Bootshaus/Affenkäfig regression) |

---

## Known Limitations

1. **Detail page 403:** Ticket.io event detail URLs may return HTTP 403 to bots. List-page JSON-LD is the primary data source; detail fetches are not required for Bootshaus shop import.
2. **Rate limits:** 15 req/min connector limit; shop list is a single fetch per run for Bootshaus.
3. **Affenkäfig shop:** No dedicated ticket.io shop configured yet; architecture ready for additional `allowedVenues` / adapters.
4. **Price / ticket status:** Parsed from JSON-LD `Offer` when present; not yet surfaced on all consumer views.
5. **Live HTML drift:** Shop markup changes require adapter fixture updates; JSON-LD `MusicEvent` schema is stable.

---

## Regression

No changes to Search, Discovery, or Home modules. Bootshaus and Affenkäfig connector paths unchanged. Scheduler migration is additive (single new source).

---

## Git

- Commit: `feat(ticket-platform): integrate ticket.io production source`
- Tag: `ticket-io-production-ready` (when acceptance criteria met)
