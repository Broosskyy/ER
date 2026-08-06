# Generic Source Platform — Phase 3 (Ticket.io Production)

Phase 3 delivers the first production-ready **multi-shop Ticket.io connector** on the existing Generic Source Platform. No parallel pipeline, no architecture redesign.

## Scope delivered

| Area | Implementation |
|------|----------------|
| Multi-shop | `createTicketIoShopSourceRecord()` — unlimited shops via `source_config.ticketPlatform` |
| URL detection | `ticket-io-url.ts` — detect, normalize, stable IDs, duplicate shop detection |
| Probe | `ticket-io-probe.ts` — validate URL, preview events, pagination hints, warnings (never publishes) |
| Sync | Normalized content hash, rate limiting, missing-event archival (existing), unchanged skip via hash |
| Matching | Unchanged — `AggregationPipeline` + existing duplicate/matching services |
| Publication | Bootshaus enrichment unchanged; discovered shops default to `auto_publish` primary |
| Monitoring | `unchangedCount`, `missingCount`, `pagesProcessed`, `connectorVersion` on import jobs |

## Publish policies

| Shop type | `publishPolicy.behavior` | Flow |
|-----------|--------------------------|------|
| Bootshaus (has website) | `enrichment` | Match → fill ticket URL on canonical event |
| New discovered shop | `auto_publish` | Match/create → publish to Admin + Public API |

## Connector version

`ticket_platform` connector bumped to **1.1.0** (`TICKET_IO_CONNECTOR_VERSION`).

## Key files

- `src/features/aggregation/connectors/ticket-platform/ticket-io-url.ts`
- `src/features/ticket-platform-discovery/discovery/ticket-io-probe.ts`
- `src/features/sources/production/ticket-io-source.core.ts`
- `src/features/aggregation/connectors/ticket-platform/ticket-platform-fetch.ts`
- `supabase/migrations/20260769000000_sprint35_ticket_io_production.sql`

## Verification

```bash
npx vitest run src/features/aggregation/connectors/ticket-platform
npx vitest run src/features/ticket-platform-discovery
npx vitest run src/features/sources/production/__tests__/sprint35-ticket-io-production.test.ts
```

## Out of scope (per product decision)

- Generic Onboarding UI
- Ticket Kings removal
- Global Ticket.io shop enumeration API
