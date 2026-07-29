# Affenkäfig Source Acquisition Contract

Sprint 28.1 — verified live domain

## Status

| Field | Value |
|-------|-------|
| **Source ID** | `source-affenkaefig` |
| **Stable key** | `affenkaefig-website-v1` |
| **Connector** | `organizer_website` |
| **List strategy** | `event_detail_page` |
| **Detail strategy** | `json_ld` (Schema.org `Event` on `/event/{slug}/`) |
| **Activation** | **DISABLED** |
| **Official domain** | `https://affenkaefig.info` |
| **Legacy domain** | `https://affenkaefig.de` (unconfigured — rejected) |

## Official URLs

| Role | URL |
|------|-----|
| Event list (discovery) | `https://affenkaefig.info/tickets/` |
| Event detail (canonical) | `https://affenkaefig.info/event/{slug}/` |
| WooCommerce archive (partial) | `https://affenkaefig.info/produkt-kategorie/event-tickets/` |
| WordPress REST (alternate) | `https://affenkaefig.info/wp-json/wp/v2/ecm_event` |

Product URLs (`/produkt/...`) redirect to canonical `/event/...` pages.

## Platform stack

- WordPress + Kadence theme
- WooCommerce ticket products
- Custom post type `ecm_event`
- Rank Math JSON-LD on event detail pages

## Pagination

Tickets page lists upcoming events inline (8 observed 2026-07-29). No pagination config required initially. Limits: `maxDetailPages: 50`.

## Field availability (live verified)

| Field | Availability | Source |
|-------|--------------|--------|
| title | ✅ | JSON-LD `name` |
| description | ✅ partial | JSON-LD `description` |
| startDateTime | ✅ | JSON-LD `startDate` (`Europe/Berlin` offset) |
| endDateTime | ❌ usually | Not on sample events |
| doorsOpen | ❌ | Not in JSON-LD |
| timezone | ✅ | `Europe/Berlin` default |
| venueName | ✅ per event | JSON-LD `location.name` |
| venueAddress | ✅ partial | JSON-LD `location.address` |
| city | ✅ | `addressLocality` |
| organizerName | ✅ | Defaults + JSON-LD org on site |
| imageUrl | ✅ | JSON-LD `image[]` (event flyers) |
| ticketUrl | ✅ | Same as canonical event URL (`ticketUrlFallback: eventUrl`) |
| genres | ❌ | Not in JSON-LD |
| lineupRaw | ❌ | Not in JSON-LD (may exist in HTML later) |
| timetableRaw | ❌ | Not available |
| cancellationStatus | ⚠️ | `eventStatus` when present |

## Entity model

| Role | Decision |
|------|----------|
| **Organizer** | `organizer-affenkaefig` |
| **Venue** | Per-event (Essigfabrik, Bootshaus, A8, Capitol, …). No `defaultVenueId`. |

## External event ID

Priority on detail JSON-LD:

1. `@id` (when event-specific)
2. `url` — **primary** (`https://affenkaefig.info/event/{slug}/`)
3. WordPress `ecm_event` post ID (REST only, not used in connector)
4. Deterministic hash (last resort)

Stable across title/description/image/ticket text changes because slug + URL are canonical.

## Idempotency key

`sourceId` + `externalEventId` (canonical event URL).

## Rate limit / retry

Website connector: 30s timeout, max 50 detail pages per run, standard fetch retry.

## Update frequency (planned)

`pollingIntervalMinutes: 360` when scheduler enabled post controlled import.

## Cancellation / delisting

Generic lifecycle engine. Events removed from tickets page must not auto-delete published records.

## Image strategy

- Use JSON-LD `image` when path contains event-specific uploads (e.g. `*_LineUP_*`, dated flyers).
- Reject generic site logos (`affenkaefig-logo`, `party1.jpg` homepage assets) as event posters.
- Homepage `og:image` is not used for events.

## Known risks

| Risk | Severity |
|------|----------|
| List page has no JSON-LD events — requires detail fetches | Low (implemented) |
| `startDate` sometimes midnight without door time | Medium |
| Variable venues — entity resolution per event | Medium |
| Cross-source overlap with Bootshaus events | Medium |
| `affenkaefig.de` still dead | Low (documented legacy) |

## References

- `src/features/sources/production/affenkaefig-source.ts`
- `supabase/migrations/20260761000000_sprint281_affenkaefig_live_domain.sql`
- `docs/real-data/AFFENKAEFIG_SOURCE_RECOVERY_REPORT.md`
