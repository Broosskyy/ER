# Multi-Origin Event Model

## Overview

Eternal Rave uses one **canonical event** per real-world occurrence. Each canonical event may have multiple **origins** — one per external source reference (official website, ticket shop, aggregator).

Origins are persisted in `event_source_references.metadata` (JSONB) alongside the existing provenance row. The application type is `EventOrigin` (`src/features/events/domain/event-origin.ts`).

## Origin fields

| Field | Description |
|-------|-------------|
| `sourceId` / `externalId` | Stable idempotency key (`source_id`, `external_event_id`) |
| `role` | `official`, `organizer`, `venue`, `festival`, `promoter`, `ticketing`, `aggregator`, `community` |
| `platform` | e.g. `ticket_io`, `ticket_king`, `bootshaus_website` |
| `canonicalUrl` / `eventUrl` / `ticketUrl` | URLs per origin |
| `syncStatus` | `active`, `stale`, `unavailable`, `blocked`, `removed`, `error` |
| `isPrimary` | Whether this origin owns canonical editorial fields |
| `isActive` | Mirrors `event_source_references.active` |

## Lifecycle

- **Publish / enrichment** — `EventOriginService.upsertFromPublish()` during import publish.
- **Origin disappears** — mark `active = false` / `syncStatus = unavailable`; canonical event is not deleted.
- **Canonical archival** — separate event lifecycle policy only.

## API

Discovery event detail supports optional `includeOrigins=true` (additive response field). Default responses are unchanged.

## Backfill

Operations backfill type `event_origins` enriches existing `event_source_references` rows idempotently.

**Sprint 33.1 production run:** 44 → 62 source references with origin metadata; second pass idempotent.

Scripts: `_sprint331-origin-backfill-dry-run.ts`, `_sprint331-origin-backfill-run.ts`

## Field ownership

See `field-ownership-policy.ts` and `event_field_provenance` for per-field `selected_source_id` tracking.
