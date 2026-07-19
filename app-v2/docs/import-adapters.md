# Import Adapters (Sprint 12B)

Production-ready import adapters for Eternal Rave. All adapters register via `ImportAdapterRegistry` and use the central `ImportFetchService`.

## Adapter Keys

| Key | Format | Description |
|---|---|---|
| `json_ld` | HTML / JSON | Schema.org Event, MusicEvent, Festival from JSON-LD |
| `rss` | RSS 2.0 | XML feed with configurable field mapping |
| `atom` | Atom | XML feed with configurable field mapping |
| `ical` | iCalendar | VCALENDAR / VEVENT parsing |
| `csv` | CSV | Header-based mapping with delimiter config |
| `api_json` | JSON API | Simple GET JSON list with path + field mapping |

Registration: `src/features/import/adapters/register-adapters.ts`

## Source Configuration

Sources support:

- `source_url` — fetch target URL
- `source_config` — adapter-specific JSON config (see `ImportSourceConfig`)
- `default_timezone` — fallback when dates lack timezone
- `adapter_key` — registry lookup key

### Feed mapping (`source_config.feed`)

```json
{
  "feed": {
    "feedUrl": "https://example.com/events.xml",
    "titleField": "title",
    "descriptionField": "description",
    "urlField": "link",
    "dateField": "pubDate",
    "externalIdField": "guid",
    "imageField": "enclosure.@_url"
  }
}
```

### CSV mapping (`source_config.csv`)

```json
{
  "csv": {
    "delimiter": ",",
    "hasHeader": true,
    "fieldMapping": {
      "externalId": "external_id",
      "title": "title",
      "startDate": "start_date",
      "cityName": "city_name"
    }
  }
}
```

### API JSON (`source_config.api`)

```json
{
  "api": {
    "resultsPath": "events",
    "queryParams": { "status": "upcoming" },
    "headerNames": ["X-Api-Key"],
    "fieldMapping": {
      "externalId": "id",
      "title": "name",
      "startDate": "starts_at",
      "cityName": "city"
    }
  }
}
```

API header **values** are resolved from environment variables:
`IMPORT_API_HEADER_<HEADER_NAME>` (e.g. `IMPORT_API_HEADER_X_API_KEY`).

## Pipeline per Adapter

```
Source → ImportFetchService → Parse → EventNormalizer → ImportCandidateValidator → ImportRecord
```

## Security Boundaries

- All HTTP via `ImportFetchService` only
- SSRF protection on every URL (including redirects)
- No dynamic code execution from config
- No secrets in `source_config`
- No client-side auth logic — env vars for API headers only

## Known Limitations

- RSS/Atom feeds often lack full event fields — location may default to source name
- iCal recurring events expanded up to `importConfig.maxRecurrenceInstances` (default 50)
- JSON-LD only parses `application/ld+json` script blocks — no HTML scraping
- `api_json` supports GET only with static field mapping — no GraphQL or scripting
- No entity matching, duplicate detection, or event creation (Sprint 12C+)

## Dependencies (Sprint 12B)

| Package | Version | Purpose | Alternative | Bundle impact |
|---|---|---|---|---|
| `fast-xml-parser` | ^5.x | RSS/Atom XML parsing | Manual DOM parser | Import module only — not used in mobile tabs |
| `ical.js` | ^2.x | iCalendar parsing | node-ical | Import module only |
