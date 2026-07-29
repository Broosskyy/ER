# First Production Source — Eternal Rave Partner Feed V1

Sprint 9 Phase 1 — single production source integration.

## Gewählte Quelle

**Rheinland Nights Partner Feed (Eternal Rave Partner API V1)**

| Kriterium | Erfüllung |
|-----------|-----------|
| Stabile Schnittstelle | Versioniertes JSON (`meta.version`, `data.events[]`) |
| Rechtlich zulässig | Vertraglich freigegebener Partner-Feed (Freigabe vor Live-URL Pflicht) |
| Strukturierte Daten | Nested JSON mit IDs, Zeiten, Venue, Organizer, Artists |
| Langfristig nutzbar | Feld-Mapping über `sourceConfig.api.fieldMapping` |
| Ausreichende Felder | Titel, Beschreibung, Start/Ende, Venue, Organizer, Stadt, Adresse, Bild, Tickets, Genres, Artists |
| Reproduzierbar testbar | Fixture `PARTNER_V1_API_FIXTURE` + 3 Testevents |

### Begründung gegen Alternativen

| Alternative | Warum nicht V1 |
|-------------|----------------|
| Club-Website JSON-LD | Scraping-Risiko, instabile HTML-Struktur |
| iCal | Weniger Metadaten (Artists, Genres, Bilder) |
| ER-014 Website Connector | Kein Pipeline-Bridge; nur HTML-Akquisition |
| Zweite Quelle | Explizit ausgeschlossen |

## Architektur

Bestehender **`open_data_api`** Connector — keine neue Architektur.

```
SourceRecord (eternal-rave-partner-v1)
  → OpenDataApiConnector
  → mapOpenDataApiEvent (field mapping + nested paths)
  → AggregationPipeline (7 steps)
  → ImportMatchingService (entity resolvers)
  → ImportRecord (needs_review)
  → ImportReviewService.approveRecord (published)
  → EventRepository.refresh()
  → Discovery / Search / Profiles
```

## Konfiguration

| Konstante | Wert |
|-----------|------|
| Source ID | `source-er-partner-v1` |
| Slug | `eternal-rave-partner-v1` |
| Connector | `open_data_api` |
| Results path | `data.events` |
| Live URL env | `ER_PARTNER_V1_API_URL` |
| Bearer token env | `ER_PARTNER_V1_API_TOKEN` |

Factory: `createEternalRavePartnerV1SourceRecord()` in `src/features/sources/production/eternal-rave-partner-v1-source.ts`

## Feld-Mapping

| Ziel | Partner-Feld |
|------|----------------|
| externalId | `id` |
| title | `name` |
| description | `description` |
| startDate | `starts_at` |
| endDate | `ends_at` |
| timezone | `timezone` |
| venueName | `venue.name` |
| venueAddress | `venue.address` |
| cityName | `venue.city` |
| organizerName | `organizer.name` |
| ticketUrl | `tickets.url` |
| imageUrl | `images.primary` |
| eventUrl | `url` |
| artistNames | `artists[]` (string oder `{name}`) |
| genreNames | `genres[]` |

Rohdaten bleiben in `sourceMetadata.raw` erhalten.

## Aktivierung (manuell)

1. Schriftliche Nutzungsfreigabe dokumentieren
2. `ER_PARTNER_V1_API_URL` und `ER_PARTNER_V1_API_TOKEN` setzen
3. Source in Admin aktivieren (`reviewRequired: true`)
4. Manueller Import via `ImportOperationsService.startManualImport()`
5. Admin-Review → Freigabe

**Kein Scheduler. Kein Auto-Import. Kein Auto-Publish.**

## Datenqualität

Fixture enthält 3 Events:

1. **Vollständig** — alle Pflicht- und Empfehlungsfelder
2. **Vollständig (Open Air)** — zweites Event für Dedup/Listen-Tests
3. **Minimal** — nur Titel, Start, Stadt (Validierung/Fallback)

## Bekannte Einschränkungen

- Live-URL nicht im Repo; Aktivierung nur mit Env + Vertrag
- Entity-Matching hängt von Matching-Katalog ab (Venue/Organizer/Artist IDs nach Review)
- Keine automatische Veröffentlichung
- Keine Push Notifications bei neuen Partner-Events

## Nächste Quellen (nicht V1)

- Zweite Partner-API (nach V1-Stabilisierung)
- iCal für Venue-only-Partner
- Scheduler (separater Sprint)

## Code

- `src/features/sources/production/eternal-rave-partner-v1-source.ts`
- `src/features/sources/production/partner-v1-fixture.ts`
- `src/features/aggregation/connectors/open-data-api-mapper.ts`
- `src/features/aggregation/connectors/open-data-api-connector.ts`
