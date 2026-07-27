# Source Model

**Sprint:** EVENT AGGREGATION FOUNDATION + IMPORT PIPELINE  
**Date:** 2026-07-26  
**Status:** Complete

## Summary

`AggregationSource` is the central view model for event aggregation. It maps from the canonical `SourceRecord` without introducing a parallel persistence layer.

## Fields

| Field | Source | Description |
|-------|--------|-------------|
| `id` | `SourceRecord.id` | Source ID |
| `name` | `displayName` | Human-readable name |
| `type` | `sourceType` | website, api, rss, ical, ticket_platform, social, manual |
| `url` | `baseUrl` / `website` | Primary URL |
| `countryCode` | `countryCode` / `sourceConfig.regional` | Country (e.g. DE) |
| `languageCode` | `languageCode` / `sourceConfig.regional` | Language (e.g. de) |
| `status` | derived | active, inactive, archived, error |
| `priority` | `priority` | 0–100 merge/import priority |
| `syncIntervalMinutes` | `pollingIntervalMinutes` | Sync interval |
| `lastSyncedAt` | `lastImportAt` | Last successful sync |
| `errorStatus` | `lastJobStatus` | Error indicator |
| `importStrategy` | `acquisitionStrategy` | manual, scheduled, webhook, on_demand |
| `parserType` | `parserType` | html, rss, json, ical, api, csv, json-ld |
| `requiresAuthentication` | `requiresAuthentication` | Auth required flag |
| `authPrepared` | `sourceConfig.auth` | Auth metadata prepared |
| `reviewRequired` | `reviewRequired` | Admin review before publish |
| `trustScore` | `trustScore` | Source trust level |
| `defaultTimezone` | `defaultTimezone` | Normalization default |

## Auth preparation

`SourceAuthConfig` stores metadata only — no secrets:

```typescript
interface SourceAuthConfig {
  type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth';
  headerName?: string;
  tokenEnvKey?: string;
  oauthProvider?: string;
  prepared: boolean;
}
```

Stored in `SourceRecord.sourceConfig.auth`.

## Supported future source types

The model is designed for:

- Resident Advisor, Shotgun, Eventbrite, DICE (API / ticket_platform)
- Club, festival, organizer websites (website + html/json-ld)
- Instagram, Facebook Events (social)
- CSV, XML, ICS feeds (csv, rss, ical)
- Manual sources (manual)

## Mapper

`mapSourceRecordToAggregationSource()` in `src/features/aggregation/domain/aggregation-source.ts`

## Tests

- `aggregation-source.test.ts`
