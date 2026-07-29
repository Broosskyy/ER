# First Real Source Configuration — Bootshaus Köln

## SourceRecord

Factory: `createBootshausKoelnSourceRecord()` in `src/features/sources/production/bootshaus-source.ts`

| Field | Value |
|-------|-------|
| `id` | `source-bootshaus-koeln` |
| `slug` | `bootshaus-koeln` |
| `stableKey` | `bootshaus-koeln-website-v1` |
| `displayName` | Bootshaus Köln |
| `sourceType` | `website` |
| `parserType` | `html` |
| `connectorKey` | `club_website` |
| `category` | `website` |
| `status` | `active` |
| `baseUrl` / `website` | `https://bootshaus.tv/events/` |
| `countryCode` | `DE` |
| `city` | Köln |
| `defaultTimezone` | `Europe/Berlin` |
| `genreNames` | Techno, House, Electronic |
| `venueName` | Bootshaus |
| `trustScore` | 76 |
| `priority` | 78 |
| `reviewRequired` | `true` |
| `autoEnabled` | `false` |
| `pollingIntervalMinutes` | 360 (prepared, inactive) |

## Website Configuration (`sourceConfig.website`)

```typescript
{
  preferredStrategy: 'html_selector',
  userAgent: 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
  acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8',
  htmlSelector: {
    baseUrl: 'https://bootshaus.tv',
    eventContainerSelector: '.upcoming-item',
    titleSelector: '.upcoming-title',
    dateSelector: '.date-day',
    monthSelector: '.date-month',
    timeSelector: '.date-time',
    venueSelector: '.upcoming-subtitle',
    imageSelector: 'img',
    imageAttribute: 'src',
    eventUrlSelector: '.upcoming-item',
    eventUrlAttribute: 'href',
    timezone: 'Europe/Berlin',
    requiredFields: ['title'],
  },
  limits: {
    maxEventsPerRun: 50,
    maxDetailPages: 0,
    maxPaginationPages: 1,
    maxPagesPerRun: 1,
    timeoutMs: 30000,
  },
}
```

## Date Composition

List cards expose day / month / time in separate elements. The generic `composeListDateParts()` helper combines them into `YYYY-MM-DDTHH:mm:ss` before normalization.

## Fixture Mode (tests)

```typescript
sourceConfig: {
  reference: {
    connectorKey: 'club_website',
    html: BOOTSHAUS_LIST_FIXTURE_HTML, // offline snippet
  },
  website: BOOTSHAUS_WEBSITE_CONFIG,
}
```

## Live Mode (smoke / manual import)

Use `createBootshausKoelnLiveSourceRecord()` — omits `reference.html`, applies stricter limits (`maxEventsPerRun: 10`).

## Field Mapping

| Extracted | Maps to |
|-----------|---------|
| `.upcoming-title` | `title` |
| day + month + time | `startDate` (via compose + normalizer) |
| `.upcoming-subtitle` | `venueName` / organizer hint |
| `img[src]` | `imageUrl` (external HTTPS reference) |
| `href` on `.upcoming-item` | `sourceUrl` / `externalId` |

Optional detail-page fields (description, genres, ticket links) are available via `event_detail_page` strategy but not required for list-based import.

## No Custom Adapter

Bootshaus does **not** use `custom_adapter`. All extraction runs through the generic `html_selector` strategy added in Sprint 11.

## Framework Fix (Sprint 12)

CSS class matching was improved to avoid prefix collisions (e.g. `.upcoming-title` vs `.upcoming-title-container`). This benefits all future HTML selector sources.
