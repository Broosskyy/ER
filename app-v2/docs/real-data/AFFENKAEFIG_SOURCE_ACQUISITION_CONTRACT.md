# Affenkäfig Source Acquisition Contract

Sprint 28 — Eternal Rave reference pipeline (second production source target)

## Status

| Field | Value |
|-------|-------|
| **Source ID** | `source-affenkaefig` |
| **Stable key** | `affenkaefig-website-v1` |
| **Connector** | `organizer_website` |
| **Strategy** | `json_ld` (Schema.org `@graph`) |
| **Activation** | **DISABLED** (Sprint 26.7 + Sprint 28) |
| **Live domain** | **UNCONFIGURED** (2026-07-29) |

## Official domain

| Item | Value |
|------|-------|
| Domain | `https://affenkaefig.de` |
| Event list URL (configured) | `https://affenkaefig.de/events/` |
| Live response (2026-07-29) | HTTP 200, body: *„Diese Domain ist unkonfiguriert.“* |

No alternative official event API or structured feed was found in repository artifacts or live checks.

## URL patterns (intended, when live)

| Pattern | Purpose |
|---------|---------|
| `https://affenkaefig.de/events/` | Event list (JSON-LD `@graph` expected per Sprint 13 design) |
| `https://affenkaefig.de/events/{slug}` | Event detail canonical URL (external ID preference) |

## Pagination

Not observed. Connector limits: `maxPagesPerRun: 1`, `maxDetailPages: 0` (list-only JSON-LD).

## Field availability (from fixture + JSON-LD parser contract)

| Field | Availability | Notes |
|-------|--------------|-------|
| title | ✅ | `name` |
| description | ✅ optional | |
| startDateTime | ✅ | ISO 8601 with offset |
| endDateTime | ✅ optional | Festival events |
| doorsOpen | ❌ | Not in fixture |
| timezone | ✅ | `Europe/Berlin` (source default) |
| venueName | ✅ per event | Variable locations (not single club) |
| venueAddress | ⚠️ partial | Locality/country in fixture |
| city | ✅ | `addressLocality` |
| organizerName | ✅ | Affenkäfig |
| imageUrl | ❌ in fixture | Live TBD |
| ticketUrl | ⚠️ | Falls back to `eventUrl` |
| genres | ❌ | Source-level defaults only |
| lineupRaw | ❌ | Not in current JSON-LD fixture |
| timetableRaw | ❌ | Not available |
| cancellationStatus | ❌ | Live TBD |

## Entity model

| Role | Decision |
|------|----------|
| **Organizer** | Affenkäfig — canonical `organizer-affenkaefig` |
| **Venue** | **Per-event** (Rheinpark, Warehouse Köln in fixtures). No fixed `defaultVenueId`. |
| **Festival** | Some events typed `Festival` in JSON-LD |

## External event ID

Priority (existing `parseJsonLdEvent`):

1. `@id`
2. `url` (preferred for Affenkäfig fixture events)
3. `name` (fallback)
4. Generated id (last resort)

## Idempotency key

`sourceId` + `externalEventId` via standard import pipeline.

## Rate limit / retry

Website connector defaults: 30s timeout, 1 page per run, standard retry/rate-limit from connector framework.

## Update frequency (planned)

`pollingIntervalMinutes: 360` when scheduler enabled post-go-live.

## Cancellation / delisting

Handled by generic lifecycle engine — no Affenkäfig-specific logic. Removed listings must not auto-delete published events without lifecycle rules.

## Known risks

1. **Domain unconfigured** — blocks all live acquisition (BLOCKING)
2. Variable venues — entity resolution must not force Bootshaus-style single venue
3. Fixture HTML in DB removed by Sprint 28 migration — prevents accidental fixture publish
4. No live lineup/timetable evidence yet

## References

- `src/features/sources/production/affenkaefig-source.ts`
- `supabase/migrations/20260760000000_sprint28_affenkaefig_production_connector.sql`
- `docs/real-data/FIRST_REAL_SOURCE.md` (original rejection: redirect / no listing)
