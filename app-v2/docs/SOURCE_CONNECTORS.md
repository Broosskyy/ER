# Source Connectors

**Sprint:** FIRST REAL SOURCES + IMPORT VALIDATION  
**Date:** 2026-07-26

## Connector catalog

### 1. Manual reference

| Property | Value |
|----------|-------|
| Key | `manual_reference` |
| Source type | `manual` |
| Input | `sourceConfig.reference.events[]` or default fixture |
| Output | Curated `RawImportedEvent[]` |

**Fixture event:** Reference Night @ Gretchen, Berlin

### 2. Club website

| Property | Value |
|----------|-------|
| Key | `club_website` |
| Source type | `website` |
| Parser | `json-ld` (default) |
| Input | Page URL or `reference.html` fixture |
| Output | JSON-LD `MusicEvent` / `Event` parsed events |

**Fixture event:** Club Night Berlin @ Tresor

### 3. Organizer website

| Property | Value |
|----------|-------|
| Key | `organizer_website` |
| Source type | `website` |
| Parser | `html` |
| Input | Page URL or `reference.html` fixture |
| Output | JSON-LD events from organizer pages |

**Fixture event:** Organizer Showcase

### 4. ICS/iCal feed

| Property | Value |
|----------|-------|
| Key | `ical_feed` |
| Source type | `ical` |
| Parser | `ical` |
| Input | Feed URL or `reference.ical` fixture |
| Output | VEVENT parsed events |

**Fixture event:** iCal Party  
**Cancelled events:** `STATUS:CANCELLED` → `cancelled: true` on raw event

### 5. Open data API

| Property | Value |
|----------|-------|
| Key | `open_data_api` |
| Source type | `api` |
| Parser | `api` |
| Input | API URL or `reference.apiJson` fixture |
| Field mapping | `sourceConfig.api.fieldMapping` |

**Fixture event:** Open Data Festival

## Raw event fields

All connectors populate a subset of:

```
externalId, importId, title, subtitle, description,
startDate, endDate, timezone, isAllDay,
venueName, venueAddress, cityName, countryCode,
latitude, longitude, genreNames, artistNames,
organizerName, ticketUrl, eventUrl, originalLink,
imageUrl, imageUrls, priceAmount, priceCurrency,
rawSourceType, sourceMetadata, cancelled
```

## Normalized output (after pipeline)

Mapped to `CanonicalImportEvent` / `NormalizedEventCandidate`:

| Raw field | Normalized field |
|-----------|-----------------|
| title | title |
| subtitle | subtitle |
| description | description |
| startDate / endDate | startDate / endDate |
| venueName | venueName |
| cityName | cityName |
| countryCode | countryCode |
| genreNames | genreNames |
| organizerName | organizerName |
| ticketUrl | ticketUrl |
| imageUrl / imageUrls | imageUrl / imageUrls |
| source metadata | sourceId, sourceName |
| importId | importId |
| originalLink / eventUrl | originalLink, eventUrl |

## Triggering imports

Via admin import operations (`ImportOperationsService.startManualImport`):

- Sources with types `manual`, `website`, `ical`, `api`, `rss` use aggregation path
- Explicit `sourceConfig.reference.connectorKey` always uses aggregation
- Other types continue via legacy adapter orchestrator

## Fixtures location

```
src/features/aggregation/fixtures/real-source-fixtures.ts
```

Contains HTML, iCal, API JSON, and manual reference event arrays for offline validation.

## Adding a new connector

1. Add key to `SOURCE_CONNECTOR_KEYS` in `connectors/types.ts`
2. Implement `SourceConnector` class
3. Register in `source-connector-registry.ts`
4. Add fixture + test case
5. Document in this file

Do not create adapter-specific pipeline branches.
