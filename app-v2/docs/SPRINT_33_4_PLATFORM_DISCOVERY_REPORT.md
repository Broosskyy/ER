# Sprint 33.4 — Platform Discovery Expansion

## Summary

Sprint 33.4 expands ticket platform imports beyond single configured shops (Bootshaus → Ticket.io, Affenkäfig → Ticket Kings) toward **platform discovery**: finding publicly available electronic music events on supported ticket platforms, filtering by scope, surfacing new organizer/shop candidates for admin review, and activating them as schedulable sources without code changes.

## Platform Analysis (Phase 2)

### Ticket.io

| Discovery vector | Available? | Notes |
|------------------|------------|-------|
| Global event search | **No** | White-label per-organizer shops at `{slug}.ticket.io` |
| Public API / catalog | **No** | No documented public platform-wide API |
| Shop directory | **No** | Marketing site sitemap covers marketing pages only |
| Per-shop event list | **Yes** | Each shop exposes public HTML/JSON-LD event pages |
| Sitemap (shops) | **No** | No enumerable shop index |

**Decision:** Implement **shop discovery** — extract `*.ticket.io` URLs from Eternal Rave corpus (configured sources, metadata, import payloads) and probe each unknown shop. No slug enumeration (not technically or legally reliable).

### Ticket Kings

| Discovery vector | Available? | Notes |
|------------------|------------|-------|
| Platform-wide list | **Yes** | `https://ticketkings.de/all-events/` |
| Pagination | **Yes** | `/all-events/page/N/` (HTML) |
| Organizer filter | **Partial** | Tribe Events taxonomy in HTML |
| Public API | **No** | WordPress front-end only |
| iCal feed | **Unreliable** | Referenced in HTML; returns 500 in probe |

**Decision:** Implement **platform list crawler** reusing `ticket-kings-adapter` + electronic scope filter. Surface organizer candidates from discovered events.

## Architecture (Phase 3)

```
Platform Discovery Service
├── Ticket Kings: crawlTicketKingsPlatform()
│   └── parseTicketKingsShopHtml + electronic-music-scope-filter
├── Ticket.io: discoverTicketIoShops()
│   └── corpus slug extraction + probeTicketIoShop
├── PlatformDiscoveryRepository (runs + candidates)
└── Admin activate → SourceRecord + scheduler (every_6_hours)
```

Existing components reused:

- `TicketPlatformConnector` / adapters
- `electronic-music-scope-filter.ts`
- `source-onboarding` PLATFORM_REGISTRY (updated with discovery notes)
- `SourceService` / `AdminSourceRepository` for activation
- Multi-origin `event_source_references` (unchanged — origins on publish)

## Implementation

| Component | Path |
|-----------|------|
| Domain types | `src/features/ticket-platform-discovery/domain/types.ts` |
| Ticket Kings crawler | `discovery/ticket-kings-platform-crawler.ts` |
| Ticket.io shop discovery | `discovery/ticket-io-shop-discovery.ts` |
| Corpus helper | `discovery/discovery-corpus.ts` |
| Proposed source configs | `config/proposed-source-config.ts` |
| Service | `services/platform-discovery-service.ts` |
| Repositories | `repositories/platform-discovery-repository.ts`, `supabase-platform-discovery-repository.ts` |
| Admin UI | `admin/PlatformDiscoveryPanel.tsx` on `/admin/sources` |
| Migration | `supabase/migrations/20260767000000_sprint334_platform_discovery.sql` |
| Validation script | `scripts/operations/_sprint334-platform-discovery-validation.ts` |

## Admin Workflow (Phase 7)

1. Admin opens **Quellen** → **Platform Discovery**
2. Run **Discover Ticket Kings** or **Discover Ticket.io Shops**
3. Review run summary (accepted/rejected counts, limitations)
4. Review candidates (shop / organizer / platform_list)
5. **Activate source** → creates `sources` row, enables scheduler (`every_6_hours`, `manual_review`)
6. Scheduler runs regular imports via existing `ImportAggregationService`

No manual SQL. No per-source code changes.

## Electronic Music Filter (Phase 5)

All discovery paths apply `requireElectronicSignal: true` via existing `electronic-music-scope-filter`:

- Genre keywords
- Tags, title, description
- Artists, organizer, venue allowlists
- Machine rules in scope config

Non-electronic events are counted in `rejectionReasons` on the discovery run summary.

## Multi-Origin (Phase 9)

Unchanged. Ticket platform sources remain enrichment origins. `event_source_references` metadata is written on **publish**, not import. Multiple origins per canonical event continue to work.

## Platform Limits

- **Ticket.io:** Discovery bounded by corpus — new shops only appear when referenced by an existing Eternal Rave data source.
- **Ticket Kings:** Single-operator platform; `/all-events/` is the authoritative public list.
- Neither platform offers a global search API suitable for unconstrained crawling.

## Validation

```bash
cd app-v2
npx vitest run src/features/ticket-platform-discovery/__tests__/sprint334-platform-discovery.test.ts
npx vitest run src/data/__tests__/sprint334-migration.test.ts
npx tsx scripts/operations/_sprint334-platform-discovery-validation.ts
```

## Future Extensions

- Seed corpus from published event `ticketUrl` fields
- Ticket.io shop discovery via partner link mining (with robots.txt respect)
- Ticket Kings organizer-scoped list URLs when filter endpoints stabilize
- Resident Advisor / Shotgun when adapters exist
