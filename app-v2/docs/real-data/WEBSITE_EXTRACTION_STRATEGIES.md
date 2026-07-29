# Website Extraction Strategies

Modulares Strategy-System für die Website-Extraktion. Jede Strategie implementiert `WebsiteExtractionStrategy`:

- `key`, `version`, `capabilities`
- `supports(document, config)` — Eignungsprüfung
- `detect(document, config)` — leichte Detection
- `extract(document, config, context)` — Event-Extraktion
- `validateConfiguration(config)` — Konfigurationsvalidierung
- `diagnostics` — Strategy-spezifische Metadaten

Strategien enthalten **keine** Publish- oder Datenbanklogik.

## Registrierte Strategien

| Key | Modul | Status |
|-----|-------|--------|
| `json_ld` | `strategies.ts` | Produktionsreif |
| `embedded_json` | `strategies.ts` | Produktionsreif |
| `html_selector` | `html-strategies.ts` | Produktionsreif |
| `event_detail_page` | `html-strategies.ts` | Foundation (Listen + Details) |
| `custom_adapter` | `html-strategies.ts` | Fallback-Stub |

## json_ld

Generische JSON-LD-Extraktion über bestehenden `json-ld-parser.ts`.

Unterstützt:

- Einzel-Events, Arrays, `@graph`, verschachtelte Strukturen
- schema.org: Event, MusicEvent, Festival, EventSeries (soweit sinnvoll)
- location/Place, address/PostalAddress, startDate/endDate
- eventStatus, eventAttendanceMode, performer, organizer, offers, image, url, description

Ungültige Datensätze werden übersprungen (`skippedCount` in Diagnostics), brechen den Import nicht ab.

## embedded_json

Extraktion aus eingebetteten JSON-Strukturen:

- `<script type="application/json">`
- `__NEXT_DATA__` (Next.js)
- Konfigurierbare Hydration-Keys und Collection-Pfade

Konfiguration (`sourceConfig.website.embeddedJson`):

```typescript
{
  collectionPaths?: string[];   // z. B. ['props.pageProps.events']
  scriptType?: string;          // default: application/json
  hydrationKeys?: string[];     // z. B. ['__NEXT_DATA__']
}
```

Keine websitespezifischen Hardcodes.

## html_selector

Konfigurierbare CSS-Selektoren (Regex-basierte HTML-Utilities, kein Headless Browser):

| Feld | Zweck |
|------|-------|
| `eventContainerSelector` | Event-Wrapper (Pflicht) |
| `titleSelector`, `dateSelector`, `timeSelector` | Kernfelder |
| `startDateAttribute`, `endDateSelector` | Datum aus Attributen |
| `venueSelector`, `locationSelector` | Ort |
| `descriptionSelector`, `imageSelector`, `imageAttribute` | Inhalt |
| `eventUrlSelector`, `eventUrlAttribute` | Detail-Link |
| `ticketUrlSelector`, `ticketUrlAttribute` | Tickets |
| `lineupSelector`, `genreSelector`, `statusSelector` | Zusatz |
| `paginationSelector`, `nextPageSelector` | Paginierung |
| `baseUrl`, `locale`, `timezone`, `dateFormats` | Auflösung |
| `requiredFields`, `optionalFieldRules` | Validierung |

Fehlerhafte Konfiguration → `validateConfiguration()` liefert Issues, kein unkontrollierter Laufzeitfehler.

## event_detail_page

Zweistufiger Ablauf:

1. Event-Links von Listen-/Kalenderseite extrahieren
2. Detailseiten laden und mit konfigurierter Detail-Strategie extrahieren

Schutzmaßnahmen:

- `maxDetailPages` Limit
- `allowedDomains` Allowlist
- URL-Deduplizierung
- Einzelfehler brechen Gesamtimport nicht ab

## custom_adapter

Kontrollierter Fallback über `adapterKey` + `options`. Für Sprint 12+ konkrete Adapter.

## Strategy Selection

```typescript
import { selectWebsiteStrategy } from '@/features/aggregation/connectors/website';

const strategy = selectWebsiteStrategy(document, config);
```

Priorität siehe [WEBSITE_DETECTION.md](./WEBSITE_DETECTION.md). Explizite `preferredStrategy` hat Vorrang.

## Pagination

`pagination.ts` unterstützt innerhalb eines Import-/Testlaufs:

- Next-Link, Page-Parameter, Offset, Cursor (soweit erkennbar)
- Stop bei: max Seiten, leere Seite, wiederholte URL, wiederholter Inhalt

Defaults: `maxPaginationPages: 5`, `maxPagesPerRun: 10`.

## Ausgabe

Alle Strategien liefern `RawWebsiteEvent[]` mit `fieldEvidence` pro extrahiertem Feld. Mapping erfolgt zentral in `mapper.ts`.
