# Eternal Rave Discovery API

Version: **v1** (stable)

The Discovery API is the single public access layer for all event data on the Eternal Rave platform. All clients (Android, iOS, Web, Admin, internal services) should use this API instead of direct database access.

## Base URL

```
/v1/discovery
```

Version negotiation:
- Path prefix: `/v1/...`
- Header: `X-ER-API-Version: v1`

Unsupported versions fall back to `v1` without breaking existing clients.

## Authentication

Not implemented in Sprint 22. Architecture supports:

| Tier | Header | Rate limit (default) |
|------|--------|----------------------|
| `public` | none | 120 req/min |
| `internal` | `X-ER-Internal: 1` | 10,000 req/min |

Optional client identification: `X-ER-Client-Id`

## Response Envelope

All successful responses share the same structure:

```json
{
  "ok": true,
  "data": {},
  "pagination": {
    "limit": 24,
    "hasMore": true,
    "nextCursor": { "encoded": "..." },
    "totalMatched": 120
  },
  "meta": {
    "version": "v1",
    "requestId": "drq_...",
    "timestamp": "2026-07-28T07:00:00.000Z",
    "surface": "home_today",
    "filters": {},
    "performance": {
      "durationMs": 12,
      "source": "hybrid",
      "cacheStatus": "miss",
      "eventsScanned": 120,
      "eventsReturned": 24
    },
    "cacheKey": "v=v1|route=events.today|..."
  }
}
```

Error responses:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_CURSOR",
    "message": "Invalid discovery query.",
    "details": [{ "field": "cursor", "code": "INVALID_CURSOR", "message": "..." }],
    "retryable": false
  },
  "meta": {
    "version": "v1",
    "requestId": "drq_...",
    "timestamp": "2026-07-28T07:00:00.000Z"
  }
}
```

### Error codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_FILTER` | 400 | Invalid filter parameter |
| `INVALID_CURSOR` | 400 | Malformed pagination cursor |
| `INVALID_SORT` | 400 | Unknown sort field or direction |
| `INVALID_QUERY` | 400 | Missing or invalid query |
| `NOT_FOUND` | 404 | Event or entity not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded (architecture only) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Pagination

Cursor-based pagination only. No offset pagination.

1. First request: omit `cursor`
2. Follow-up: pass `nextCursor` from previous response as `cursor`

Query parameter or JSON body field: `cursor`, `limit` (max 100, default 24)

## Endpoints

### Events

#### `GET /v1/discovery/events/today`

Events happening today.

| Parameter | Type | Description |
|-----------|------|-------------|
| `city` | string | Filter by city |
| `limit` | number | Page size |
| `cursor` | string | Pagination cursor |

#### `GET /v1/discovery/events/weekend`

Events this weekend (Friday–Sunday).

#### `GET /v1/discovery/events/nearby`

Events near a location.

| Parameter | Type | Required |
|-----------|------|----------|
| `latitude` | number | yes |
| `longitude` | number | yes |
| `radiusKm` | number | no (default 50) |
| `limit` | number | no |
| `cursor` | string | no |

#### `GET /v1/discovery/events/trending`

Trending/upcoming events with relevance ranking and diversity.

| Parameter | Type |
|-----------|------|
| `city` | string |
| `limit` | number |
| `cursor` | string |

#### `GET /v1/discovery/events/search`

Full-text search with fuzzy matching and synonyms.

| Parameter | Type | Required |
|-----------|------|----------|
| `text` | string | yes |
| `locale` | `de` \| `en` | no |
| `city` | string | no |
| `limit` | number | no |
| `cursor` | string | no |

#### `POST /v1/discovery/events/filter`

Generic filter endpoint. Accepts a full `DiscoveryQuery` in the request body:

```json
{
  "query": {
    "surface": "search_events",
    "date": { "preset": "this-weekend" },
    "entities": { "city": "Köln", "genres": ["Techno"] },
    "price": { "freeOnly": true },
    "venueEnvironment": { "outdoor": true },
    "sortBy": "date",
    "limit": 24
  }
}
```

#### `GET /v1/discovery/events/:id`

Event detail by ID.

### Venues

#### `GET /v1/discovery/venues/:id`

Venue profile.

#### `GET /v1/discovery/venues/:id/events`

Discoverable events at a venue. Supports `limit`, `cursor`.

### Organizers

#### `GET /v1/discovery/organizers/:id`

Organizer profile.

#### `GET /v1/discovery/organizers/:id/events`

Events by organizer.

### Festivals

#### `GET /v1/discovery/festivals/:id`

Festival profile (event-derived until dedicated repository).

#### `GET /v1/discovery/festivals/:id/events`

Events belonging to a festival.

## DiscoveryQuery Reference

Full query model for `/events/filter`:

| Field | Type | Description |
|-------|------|-------------|
| `surface` | string | Ranking context (required) |
| `search` | object | `{ text, mode, locale, fuzzyThreshold }` |
| `date` | object | `{ preset, startAt, endAt, includePast }` |
| `entities` | object | `{ city, venueId, organizerId, festivalId, festivalEditionId, genres }` |
| `location` | object | `{ latitude, longitude, radiusKm, city }` |
| `price` | object | `{ freeOnly, maxPriceEur }` |
| `venueEnvironment` | object | `{ indoor, outdoor }` |
| `sortBy` | string | `relevance`, `distance`, `date`, `newest`, `popularity`, `freshness`, `alphabetical` |
| `sortDirection` | string | `asc` or `desc` |
| `cursor` | object | `{ encoded }` |
| `limit` | number | 1–100 |
| `diversify` | boolean | Enable diversity ranking |

### Date presets

`all`, `today`, `tomorrow`, `this-weekend`, `this-week`, `next-month`, `upcoming`, `custom`

## Caching

Architecture supports response, query, CDN, and edge caching. Cache headers are returned on HTTP responses:

- `Cache-Control`
- `CDN-Cache-Control`
- `X-Cache-Key`

Provider-specific CDN/edge implementation is deferred.

## Versioning Strategy

- Current stable version: **v1**
- New versions added as `/v2/discovery/...` without breaking v1
- Clients should send `X-ER-API-Version` and handle `meta.version` in responses
- Breaking changes require a new major version path

## Internal Usage (TypeScript)

```typescript
import { getDiscoveryQueryPlatform } from '@/features/discovery/discovery-runtime';

const response = await getDiscoveryQueryPlatform().queryToday({ city: 'Köln' });
```

HTTP adapter for edge deployment:

```typescript
import { getDiscoveryHttpAdapter } from '@/features/discovery/discovery-runtime';

const httpResponse = await getDiscoveryHttpAdapter().handle({
  method: 'GET',
  path: '/v1/discovery/events/today',
});
```
