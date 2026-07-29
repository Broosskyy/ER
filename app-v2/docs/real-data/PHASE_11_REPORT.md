# Sprint 11 — Website Connector Framework / ER-013 Abschlussbericht

## Zusammenfassung

Sprint 11 implementiert das **generische Website Connector Framework** innerhalb der bestehenden Aggregation-Connector-Schicht. Keine neue Import-Architektur, kein paralleles Source System, kein zweites Connector Framework.

## Implementierte Komponenten (neu)

| Komponente | Pfad |
|------------|------|
| Website Types | `connectors/website/types.ts` |
| Config Schema | `connectors/website/config.ts` |
| Run Limits | `connectors/website/limits.ts` |
| SSRF Security | `connectors/website/security.ts` |
| Fetch Layer | `connectors/website/fetch.ts` |
| HTML Utilities | `connectors/website/html-utils.ts` |
| Detection Engine | `connectors/website/detection.ts` |
| Strategy Interface | `connectors/website/strategy-types.ts` |
| JSON-LD + Embedded JSON | `connectors/website/strategies.ts` |
| HTML + Detail + Custom | `connectors/website/html-strategies.ts` |
| Strategy Selector | `connectors/website/strategy-selector.ts` |
| Pagination Foundation | `connectors/website/pagination.ts` |
| Event Mapper | `connectors/website/mapper.ts` |
| Processor | `connectors/website/processor.ts` |
| Test Fixtures | `connectors/website/fixtures.ts` |
| Public Exports | `connectors/website/index.ts` |
| Framework Tests | `connectors/website/__tests__/website-framework.test.ts` |

## Angepasste bestehende Komponenten

| Komponente | Änderung |
|------------|----------|
| `club-website-connector.ts` | Delegiert an `WebsiteProcessor` |
| `organizer-website-connector.ts` | Unveränderte Key-Semantik, nutzt Club-Pfad mit Organizer-Fixture |
| `source-config.ts` | `website?: WebsiteConnectorConfig` |
| `source-management-service.ts` | `validateWebsiteConfiguration`, `runWebsiteDetection`, `runWebsiteExtractionPreview` |
| `source-admin-models.ts` | Website Detection/Preview View Models |

## Wiederverwendete Module

- `importFetchService` — HTTP, Retry, Rate Limit, SSRF-Basis
- `json-ld-parser.ts` — JSON-LD-Extraktion
- `SourceConnectorExecutor` / Registry / Health / Metrics / Diagnostics
- `AggregationPipeline` — unverändert
- `SourceManagementService.runTestImport` — erweitert um Website-Fixtures

## Tests

Neue Testdatei: `website-framework.test.ts` (20 Tests)

Abdeckung:

1. URL-Sicherheitsvalidierung (localhost, private IPs, metadata)
2. Redirect-/Domain-Utilities (dedupe, relative URLs)
3. JSON-LD Detection + Extraction + @graph
4. Embedded JSON / `__NEXT_DATA__`
5. HTML Selector Extraction + Config Validation
6. Unvollständige Events (skip, kein Abort)
7. Processor End-to-End mit Fixtures
8. Strategy Selection (explicit preferred)
9. Backward Compatibility (`club_website`, `organizer_website`)
10. SourceManagementService Integration (Detection, Preview, Test Import, History)
11. Detail-Link Detection, Pagination Fixtures

**Gesamt:** 908 Tests bestanden (+20 gegenüber Sprint 10).

## Migrationen

Keine Datenbank-Migrationen in Sprint 11. Konfiguration rein additiv über `sourceConfig.website`.

## Verifikation

| Check | Ergebnis |
|-------|----------|
| Typecheck | grün |
| Tests | **908** bestanden |
| Lint | 0 Errors |
| Parallele Architektur | keine gefunden |
| SSRF / Redirect | validiert, `.local` blockiert |
| Limits | Defaults in `limits.ts` |

## Architektur-Prüfung

- Kein zweites Connector Framework — Erweiterung unter `connectors/website/`
- `club_website` / `organizer_website` Keys unverändert
- Keine neue kanonische Eventstruktur — `RawWebsiteEvent` → bestehendes `RawImportedEvent`
- Keine Admin-UI, kein Scheduler, kein Headless Browser
- Keine Bootshaus-/Affenkäfig-Logik

## Bekannte Einschränkungen

- HTML-Parsing regex-basiert (kein vollständiger DOM-Parser)
- JavaScript-rendered Seiten werden erkannt, aber nicht gerendert
- `custom_adapter` ist Stub — konkrete Adapter folgen in Sprint 12
- `event_detail_page` Pagination in Produktion noch begrenzt getestet
- Import History weiterhin In-Memory
- Website-Connectoren in Source Management: nur `club_website` und `organizer_website` (explizit)

## Technische Schulden

- Vollständiger DOM-Parser (cheerio/jsdom) optional für komplexe Selektoren
- Echte HTTP-Fetch-Integrationstests mit Mock-Server (nicht Live-Web)
- `isWebsiteConnector()` auf generischen Website-Typ erweitern, wenn weitere Connectoren registriert werden
- `rawSourceType: 'unknown'` für Nicht-JSON-LD-Strategien — ggf. neuer `RawSourceType`-Wert in späterem Sprint

## Vorbereitung Sprint 12

| Baustein | Status |
|----------|--------|
| Generisches Website Framework | ✅ |
| JSON-LD / Embedded JSON / HTML Selector | ✅ |
| Listen + Detailseiten Foundation | ✅ |
| Pagination Foundation | ✅ |
| Source Management API | ✅ |
| Security + Limits | ✅ |
| Erste echte Produktivquelle | ⏳ Sprint 12 |
| Custom Adapter Implementierung | ⏳ Sprint 12 |
| Admin-UI | ⏳ später |

## Dokumentation

- [WEBSITE_CONNECTOR_FRAMEWORK.md](./WEBSITE_CONNECTOR_FRAMEWORK.md)
- [WEBSITE_DETECTION.md](./WEBSITE_DETECTION.md)
- [WEBSITE_EXTRACTION_STRATEGIES.md](./WEBSITE_EXTRACTION_STRATEGIES.md)
- [WEBSITE_CONNECTOR_SECURITY.md](./WEBSITE_CONNECTOR_SECURITY.md)
