# First Real Public Source — Bootshaus Köln

Sprint 12 integrates **one** real public website source into Eternal Rave using the existing connector and aggregation architecture.

## Selected Source

| Field | Value |
|-------|-------|
| Name | Bootshaus Köln |
| Public URL | https://bootshaus.tv/events/ |
| Connector | `club_website` (unchanged key) |
| Strategy | `html_selector` (generic, no custom adapter) |
| Source ID | `source-bootshaus-koeln` |
| Stable Key | `bootshaus-koeln-website-v1` |

## Candidate Comparison (summary)

| Candidate | Result |
|-----------|--------|
| Bootshaus (`bootshaus.tv/events/`) | **Selected** — static HTML, 37+ events, no JSON-LD, no headless browser |
| Affenkäfig | Rejected — redirects to homepage, no event listing |
| Berghain / about:blank | Fetch failed / unavailable |
| O-Ton | `robots.txt Disallow: /` |
| Grelle Forelle / others | 404 or no event structure |

### Why Bootshaus

1. Official public event calendar for a major electronic music club (Köln)
2. Multiple future events with stable HTML list cards (`.upcoming-item`)
3. No login, CAPTCHA, or bot-wall observed
4. No JavaScript rendering required for event list extraction
5. Rich fields: title, date, time, image, detail URL, organizer subtitle
6. Generic `html_selector` strategy sufficient — **no Bootshaus-specific scraper**
7. Technically stable Pixend CMS HTML structure
8. robots.txt allows `/events/` (disallows only internal paths)

## Architecture (unchanged)

```
SourceRecord (bootshaus-source.ts)
  → club_website connector
  → WebsiteProcessor
  → html_selector strategy
  → RawWebsiteEvent → RawImportedEvent
  → AggregationPipeline
  → Resolver / Merge / Review
```

## Implementation Files

| File | Purpose |
|------|---------|
| `src/features/sources/production/bootshaus-source.ts` | SourceRecord factory + website config |
| `src/features/sources/production/bootshaus-fixture.ts` | Offline HTML fixtures |
| `src/features/sources/production/__tests__/bootshaus-source.test.ts` | E2E tests |
| `scripts/dev/bootshaus-live-smoke-test.ts` | Manual live smoke test |

## Live Detection Results (2026-07-27)

- Final URL: `https://bootshaus.tv/events/`
- HTTP 200, static HTML (~67 KB)
- Recommended strategy: `html_selector`
- ~37 event containers detected
- No JSON-LD / Embedded JSON
- No JavaScript rendering blocker
- Detail page links detected (optional future enrichment)

## Live Extraction Sample

| Title | Start (Europe/Berlin) |
|-------|------------------------|
| 122 pres. AVANGART TABLDOT @ Palma de Mallorca (ES) | 2026-07-27 23:45 |
| LOONYLAND AT NATURE ONE | 2026-07-30 20:00 |
| PLAY! Open Air – Bootshaus Köln | 2026-08-01 14:00 |
| Bootshaus Sommerfest - Part 4 | 2026-08-01 22:00 |

## Operational Notes

- `autoEnabled: false` — no scheduler, no auto-import
- `reviewRequired: true` — all imports land in review
- Tests use fixture HTML only (no live network)
- Live fetch enabled when `reference.html` is omitted

See also: [FIRST_REAL_SOURCE_CONFIGURATION.md](./FIRST_REAL_SOURCE_CONFIGURATION.md), [FIRST_REAL_SOURCE_SMOKE_TEST.md](./FIRST_REAL_SOURCE_SMOKE_TEST.md)
