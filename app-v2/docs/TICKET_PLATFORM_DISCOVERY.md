# Ticket Platform Discovery Architecture

## Goal

Discover electronic music events on supported ticket platforms **without** hard-coding one shop per platform. New organizers/shops surface as reviewable source candidates; admins activate them into the existing import scheduler.

## Supported Discovery Modes

| Platform | Mode | Entry point |
|----------|------|-------------|
| Ticket Kings | `platform_list` | `https://ticketkings.de/all-events/` |
| Ticket Kings | `organizer` | Derived from platform crawl |
| Ticket.io | `shop` | `{slug}.ticket.io` from corpus URL mining |

## Data Model

- `platform_discovery_runs` — one row per admin-triggered crawl
- `platform_discovery_candidates` — shops, organizers, or platform lists pending review

Candidate lifecycle: `discovered` → `review` (duplicate match) → `activated` (source created)

## Flow

```mermaid
flowchart TD
  A[Admin: Run Discovery] --> B{Platform}
  B -->|Ticket Kings| C[crawlTicketKingsPlatform]
  B -->|Ticket.io| D[discoverTicketIoShops]
  C --> E[electronic-music-scope-filter]
  D --> E
  E --> F[Save run + candidates]
  F --> G[Admin review]
  G --> H[Activate source]
  H --> I[Scheduler every_6h]
  I --> J[ImportAggregationService]
  J --> K[Review pipeline / publish origins]
```

## Reused Components

- `TicketPlatformConnector` — production imports
- `parseTicketKingsShopHtml` / `parseTicketIoShopHtml` — HTML parsing
- `electronic-music-scope-filter` — genre/venue/organizer filtering
- `AdminSourceRepository` — source persistence
- `SourceBackedImportScheduleRepository` — scheduler after activation

## Platform Constraints

### Ticket.io

No public platform-wide event index. Each organizer operates an isolated white-label shop. Discovery is **corpus-driven**: only shops referenced in Eternal Rave data (sources, configs, URLs) are probed.

### Ticket Kings

Single WordPress operator with a public `/all-events/` listing. Pagination is HTML-based. This is the primary platform-wide discovery path for Ticket Kings.

## Admin Surface

`/admin/sources` → **Platform Discovery** panel:

- Run discovery per platform
- View acceptance/rejection metrics
- Activate candidates (creates source + enables scheduler)

## Security

- RLS: admin-only read/write on discovery tables
- `service_role` grant for operational scripts
- No automatic source activation — admin approval required

## Related Docs

- [SPRINT_33_4_PLATFORM_DISCOVERY_REPORT.md](./SPRINT_33_4_PLATFORM_DISCOVERY_REPORT.md)
- [AUTOMATED_SOURCE_ONBOARDING.md](./AUTOMATED_SOURCE_ONBOARDING.md)
