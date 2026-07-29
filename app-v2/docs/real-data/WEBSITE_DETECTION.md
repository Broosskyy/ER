# Website Detection Engine

Die Detection Engine analysiert ein bereits geladene `WebsiteDocument` und liefert strukturierte Signale sowie Strategy-Empfehlungen — **ohne** Events zu extrahieren.

## Eingabe

`WebsiteDocument` (nach Fetch Layer):

- `requestedUrl`, `finalUrl`, `statusCode`, `contentType`, `charset`
- `html`, `responseSize`, `fetchedAt`, `redirectChain`
- gefilterte `headers`, `warnings`

## Erkannte Formate (`WebsiteDetectedFormat`)

| Format | Bedeutung |
|--------|-----------|
| `json_ld` | `<script type="application/ld+json">` vorhanden |
| `schema_org_event` | schema.org Event-Typen (Event, MusicEvent, Festival, …) |
| `embedded_json` | Eingebettetes JSON in Script-Tags |
| `next_data` | Next.js `__NEXT_DATA__` |
| `nuxt_payload` | Nuxt-Hydration-Payload |
| `rss_link` / `ical_link` | Feed-/Kalender-Links im HTML |
| `event_list` / `event_card` | Event-Container-Muster |
| `event_detail_link` | Links zu Detailseiten |
| `pagination_hint` / `load_more_hint` | Paginierung / Load-More |
| `structured_date` / `structured_venue` | Strukturierte Datums-/Venue-Hinweise |
| `ticket_link` / `lineup_hint` / `image_source` | Zusatzsignale |
| `client_rendered_suspected` | Leerer Root-Container oder JS-Hinweistext |

## Detection Report (`WebsiteDetectionReport`)

| Feld | Beschreibung |
|------|--------------|
| `detectedStrategies` | Kandidaten mit Confidence und Event-Schätzung |
| `detectedFormats` | Alle erkannten Signale |
| `eventContainerCount` | Geschätzte Event-Container |
| `detailPageUrls` | Erkannte Detailseiten-URLs |
| `paginationDetected` | Paginierung erkannt |
| `ticketLinks` / `imageSources` | Extrahierte Links |
| `dateFieldCount` / `venueFieldCount` | Strukturierte Feld-Hinweise |
| `javascriptRenderingSuspected` | Verdacht auf Client-Rendering |
| `warnings` | Nicht-blockierende Hinweise |
| `blockers` | Blockierende Probleme (z. B. `client_rendered`) |
| `recommendedStrategy` | Empfohlene Extraktionsstrategie |
| `recommendedNextAction` | `extract`, `configure_selectors`, `fetch_details`, `blocked` |

## Strategy-Empfehlung (Standard-Priorität)

1. `json_ld` — valides schema.org JSON-LD
2. `embedded_json` — eingebettete JSON-Payloads
3. `html_selector` — konfigurierbare CSS-Selektoren
4. `event_detail_page` — Listen + Detailseiten
5. `custom_adapter` — kontrollierter Fallback

`sourceConfig.website.preferredStrategy` überschreibt die automatische Auswahl.

## Blocker vs. Warnungen

- **Blocker:** z. B. starkes JS-Rendering-Signal → `recommendedNextAction: 'blocked'`
- **Warnungen:** unvollständige Signale, Fixture-Override, fehlende Konfiguration

## API

```typescript
import { detectWebsiteDocument } from '@/features/aggregation/connectors/website';

const report = detectWebsiteDocument(document, websiteConfig);
```

Über Source Management:

```typescript
const result = await sourceManagementService.runWebsiteDetection('admin', sourceId);
// → SourceAdminWebsiteDetectionResult mit report, strategy, diagnostics
```

## Einschränkungen

- Keine Browser-Ausführung — rein statische HTML-Analyse (Regex/DOM-light)
- Keine LLM-basierte Laufzeiterkennung
- Detection schätzt Event-Anzahl, extrahiert aber nicht
