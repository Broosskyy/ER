# Connector Architecture

**Sprint:** FIRST REAL SOURCES + IMPORT VALIDATION  
**Date:** 2026-07-26

## Overview

Source connectors are the first step in the aggregation pipeline. Each connector fetches raw event data from an external source and returns `RawImportedEvent[]`. Connectors do not normalize, validate, or write to the database.

```
SourceRecord + ImportSource
        ↓
SourceConnectorRegistry.resolveConnectorKey()
        ↓
SourceConnector.fetchRawEvents()
        ↓
RawImportedEvent[]
        ↓
FetchStep → NormalizeStep → …
```

## Interface

```typescript
interface SourceConnector {
  readonly connectorKey: SourceConnectorKey;
  fetchRawEvents(
    source: AggregationSource,
    importSource: ImportSource,
    context: PipelineRunContext,
  ): Promise<RawImportedEvent[]>;
}
```

`RawImportedEvent` is the connector output contract. It mirrors fields needed for normalization but is not yet canonical.

## Registry

`SourceConnectorRegistry` resolves connector keys:

| Input | Resolved connector |
|-------|-------------------|
| `sourceConfig.reference.connectorKey` | Explicit key |
| `parserType === 'ical'` | `ical_feed` |
| `parserType === 'api'` | `open_data_api` |
| `sourceType === 'manual'` | `manual_reference` |
| `sourceType === 'website'` + `parserType === 'html'` | `organizer_website` |
| Default website | `club_website` |

Default registry (`sourceConnectorRegistry`) registers all five connectors.

## Fetch provider bridge

`createSourceConnectorFetchProvider(registry)` implements `FetchProvider` for `AggregationPipeline`:

1. Resolve connector key from source metadata
2. Call `connector.fetchRawEvents()`
3. Map each event via `rawEventToFetchedPayload()` → `{ externalId, sourceUrl, rawPayload }`

No special handling per connector in the pipeline itself.

## Connector implementations

### Manual reference (`manual_reference`)

- Reads `sourceConfig.reference.events` when configured
- Falls back to `MANUAL_REFERENCE_EVENTS` fixture
- Use case: curated reference data, QA, admin seeding

### Club website (`club_website`)

- Fetches HTML from `sourceConfig` URL or uses `CLUB_WEBSITE_FIXTURE_HTML`
- Parses JSON-LD `MusicEvent` / `Event` schema
- Use case: club venue pages with structured data

### Organizer website (`organizer_website`)

- Same JSON-LD parser as club website
- Uses `ORGANIZER_WEBSITE_FIXTURE_HTML` as default fixture
- Use case: promoter/organizer event listings

### ICS/iCal feed (`ical_feed`)

- Parses iCal from `sourceConfig.reference.ical`, feed URL, or `ICAL_EVENT` fixture
- Supports `CANCELLED` status via `cancelled` flag on raw event

### Open data API (`open_data_api`)

- Reads `sourceConfig.reference.apiJson` or `OPEN_DATA_API_FIXTURE`
- Applies `sourceConfig.api.fieldMapping` for field names
- Use case: official public event APIs

## Reference configuration

`ImportSourceConfig.reference` bundles fixture/live payloads:

```typescript
interface ReferenceSourceConfig {
  connectorKey?: SourceConnectorKey;
  events?: RawImportedEvent[];
  html?: string;
  ical?: string;
  apiJson?: string | Record<string, unknown>;
}
```

This allows production-near validation without live network calls in tests.

## Extension guidelines

1. Implement `SourceConnector` with a unique `connectorKey`
2. Register in `createDefaultSourceConnectorRegistry()`
3. Add fixture data in `fixtures/real-source-fixtures.ts`
4. Add connector test in `__tests__/source-connectors.test.ts`
5. Do **not** add pipeline-specific branches — normalization handles mapping

## File layout

```
src/features/aggregation/connectors/
  types.ts
  source-connector-registry.ts
  create-source-connector-fetch-provider.ts
  manual-reference-connector.ts
  club-website-connector.ts
  organizer-website-connector.ts
  ical-feed-connector.ts
  open-data-api-connector.ts
```
