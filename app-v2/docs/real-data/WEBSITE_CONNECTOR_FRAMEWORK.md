# Website Connector Framework (ER-013 / Sprint 11)

Generisches Website-Connector-Framework für öffentliche Event-Webseiten — integriert in die bestehende Aggregation-Connector-Schicht (Sprint 9) und Source Management Platform (Sprint 10).

## Ziel

Eine Website-Quelle soll **ohne hartcodierten Scraper** konfigurierbar sein. Das Framework liefert modulare Extraktionsstrategien, die später für Club-, Festival-, Veranstalter-, Ticket- und Venue-Webseiten wiederverwendet werden.

**Nicht im Scope:** konkrete Produktivquellen (Bootshaus, Affenkäfig), Admin-UI, Scheduler, Headless Browser, LLM-Extraktion.

## Datenfluss

```
SourceRecord
  → SourceConnectorRegistry
  → SourceConnectorExecutor (Rate Limit, Retry, Diagnostics)
  → ClubWebsiteConnector / OrganizerWebsiteConnector
  → WebsiteProcessor
      → WebsiteFetchLayer
      → detectWebsiteDocument()
      → selectWebsiteStrategy()
      → Strategy.extract()
      → RawWebsiteEvent[]
      → mapRawWebsiteEvents() → RawImportedEvent[]
  → AggregationPipeline (unverändert)
```

Keine parallele Pipeline. Kein zweites Connector Framework.

## Modulstruktur

| Modul | Pfad | Aufgabe |
|-------|------|---------|
| Types | `connectors/website/types.ts` | `WebsiteDocument`, `RawWebsiteEvent`, `WebsiteDetectionReport` |
| Config | `connectors/website/config.ts` | `WebsiteConnectorConfig` |
| Limits | `connectors/website/limits.ts` | Laufzeit-Limits (Seiten, Events, Response-Größe) |
| Security | `connectors/website/security.ts` | SSRF-Schutz, Domain-Allowlist, URL-Deduplizierung |
| Fetch | `connectors/website/fetch.ts` | HTTP-Abstraktion über `importFetchService` |
| Detection | `connectors/website/detection.ts` | Signale + Strategy-Empfehlungen |
| Strategies | `connectors/website/strategies.ts`, `html-strategies.ts` | JSON-LD, Embedded JSON, HTML-Selektoren, Detailseiten, Custom |
| Strategy Selector | `connectors/website/strategy-selector.ts` | Priorisierte Auswahl |
| Pagination | `connectors/website/pagination.ts` | Kontrollierte Mehrseiten-Verarbeitung |
| Mapper | `connectors/website/mapper.ts` | `RawWebsiteEvent` → `RawImportedEvent` |
| Processor | `connectors/website/processor.ts` | Orchestrierung detect + process |
| Fixtures | `connectors/website/fixtures.ts` | Deterministische Test-HTML |

## Bestehende Connectoren

| Key | Änderung |
|-----|----------|
| `club_website` | Delegiert an `WebsiteProcessor`; Fixture-Fallback über `reference.html` |
| `organizer_website` | Gemeinsame Basis `website-source-connector-base.ts` + Organizer-Fixture |

Connector Keys **unverändert**. Bestehende SourceRecords bleiben kompatibel.

## Title Transforms (Sprint 26)

Optionale Titel-Bereinigung über `sourceConfig.website.transforms`:

```json
"transforms": [
  { "type": "regex_replace", "value": "\\s*\\| Venue Name\\s*$", "replacement": "" },
  { "type": "trim" }
]
```

Unterstützte Typen: `remove_suffix`, `remove_prefix`, `regex_replace`, `trim`.
Keine quellenspezifischen Namen im Framework-Code.

## Konfiguration

Konfiguration liegt unter `sourceConfig.website` (`WebsiteConnectorConfig`):

```typescript
{
  preferredStrategy?: 'json_ld' | 'embedded_json' | 'html_selector' | 'event_detail_page' | 'custom_adapter',
  autoSelectStrategy?: boolean,
  userAgent?: string,
  acceptLanguage?: string,
  requestHeaders?: Record<string, string>,
  htmlSelector?: { /* siehe WEBSITE_EXTRACTION_STRATEGIES.md */ },
  embeddedJson?: { collectionPaths?, scriptType?, hydrationKeys? },
  eventDetailPage?: { listPageUrl?, eventLinkSelector?, allowedDomains?, detailStrategy? },
  customAdapter?: { adapterKey?, options? },
  limits?: Partial<WebsiteRunLimits>
}
```

Legacy-Felder (`sourceConfig.jsonLd`, `sourceConfig.reference.html`) werden weiterhin von `club_website` unterstützt.

## RawWebsiteEvent

Internes Rohmodell vor Normalisierung:

- Identität: `sourceUrl`, `detailUrl`, `externalId`
- Rohfelder: `rawStartDate`, `rawVenue`, `rawArtists`, …
- Herkunft: `extractionStrategy`, `extractionConfidence`, `fieldEvidence[]`
- Qualität: `warnings[]`

Mapping in `mapRawWebsiteEvents()` erzeugt `RawImportedEvent` für die bestehende AggregationPipeline.

## Field Evidence / Provenance

`WebsiteFieldEvidence` dokumentiert pro Feld:

- `field`, `strategy`, `sourceUrl`
- `selectorOrPath` (CSS-Selektor oder JSON-Pfad)
- `confidence`, `extractedAt`, `rawValue`

Keine parallele Provenance-Struktur — ergänzt bestehende `sourceMetadata` am Import-Event.

## Source Management Integration

`SourceManagementService` (additiv):

| Methode | Zweck |
|---------|-------|
| `validateWebsiteConfiguration()` | Strategie-Konfiguration prüfen |
| `runWebsiteDetection()` | Detection Report für eine Quelle |
| `runWebsiteExtractionPreview()` | Extraktionsvorschau mit Diagnostics |
| `runTestImport()` | Bestehender Testimport inkl. Website-Fixtures |

Admin View Models: `SourceAdminWebsiteDetectionResult`, `SourceAdminWebsiteExtractionPreview`, `canRunWebsiteDetection`.

## Test Import

- Produktionscode unterstützt echte öffentliche HTTPS-URLs.
- Tests verwenden **ausschließlich** lokale HTML-Fixtures (`reference.html`, `htmlOverride`) — keine Live-Webseiten.
- Default-Fixture-URL: `https://events.example.com/...` (RFC 2606, SSRF-sicher).

## Observability

Nutzt ausschließlich bestehende Systeme:

- Connector Health / Metrics / Diagnostics (Sprint 9)
- `WebsiteExtractionDiagnostics`: Fetch-, Detection-, Extraction-Dauer, Strategy, Confidence, Seiten-/Event-Zähler

## Verwandte Dokumentation

- [WEBSITE_DETECTION.md](./WEBSITE_DETECTION.md)
- [WEBSITE_EXTRACTION_STRATEGIES.md](./WEBSITE_EXTRACTION_STRATEGIES.md)
- [WEBSITE_CONNECTOR_SECURITY.md](./WEBSITE_CONNECTOR_SECURITY.md)
- [PHASE_11_REPORT.md](./PHASE_11_REPORT.md)
