# Source Connector Registry

Sprint 26 — canonical runtime registry for the production import path.

## Kanonische Registry

**Produktive Runtime-Registry:** `src/features/aggregation/connectors/source-connector-registry.ts`

```ts
import {
  sourceConnectorRegistry,
  createDefaultSourceConnectorRegistry,
} from '@/features/aggregation/connectors/source-connector-registry';
```

Alle Scheduler-, Queue-, Worker- und Aggregation-Pipeline-Fetches laufen über diese Registry.

### Registrierte Connectoren

| Key | Klasse | Datenformat |
|-----|--------|-------------|
| `manual_reference` | `ManualReferenceConnector` | inline / fixture |
| `club_website` | `ClubWebsiteConnector` | HTML (JSON-LD, selectors, …) |
| `organizer_website` | `OrganizerWebsiteConnector` | HTML (JSON-LD, selectors, …) |
| `ical_feed` | `IcalFeedConnector` | RFC5545 |
| `open_data_api` | `OpenDataApiConnector` | REST JSON |
| `rss_feed` | `RssFeedConnector` | RSS XML |
| `atom_feed` | `AtomFeedConnector` | Atom XML |
| `csv_import` | `CsvImportConnector` | CSV |

## Connector-Auflösung

Strikte Auflösung in `source-connector-resolution.ts`:

1. `sourceConfig.reference.connectorKey` (explizit) hat Vorrang
2. Sonst Mapping über `sourceType` / `parserType` / `source_roles`
3. Keine stillen Fallbacks — unklare Konfiguration → `SourceConnectorError`

Website-Quellen ohne expliziten Key benötigen `source_roles`:

- `club` / `venue` → `club_website`
- `organizer` / `festival` → `organizer_website`
- Gemischte Rollen → Fehler

## Runtime-Ablauf

```
SourceRecord
  → resolveSourceConnectorKeyFromRecord()
  → SourceConnectorRegistry.get(key)
  → SourceConnectorExecutor (rate limit, retry, metrics, health)
  → BaseSourceConnector.fetchRawEvents()
  → AggregationPipeline (normalize → validate → duplicate → merge → review → publish)
```

Scheduler/Queue:

```
ImportSchedulerEngine → ImportJobQueueService → ImportJobQueueProcessor
  → resolveSourceConnectorKeyFromRecord() (vor Import)
  → ImportAggregationService.executeExistingJob()
```

## Connector-Registrierung

Neuen Connector hinzufügen:

1. `SourceConnectorKey` in `connectors/types.ts` ergänzen
2. Definition in `framework/connector-definitions.ts`
3. Klasse extends `BaseSourceConnector`
4. In `createDefaultSourceConnectorRegistry()` registrieren
5. Auflösung in `source-connector-resolution.ts` erweitern
6. Tests in `__tests__/sprint26-source-platform-consolidation.test.ts`

## Admin-Metadaten

**ER-013 Registry** (`src/features/connectors/`) — Admin-UI für Endpoint-Konfiguration. Nicht im Import-Fetch-Pfad.

Admin kann Connector-Deskriptoren aus der kanonischen Registry lesen:

```ts
sourceConnectorRegistry.listDescriptors();
```

## Legacy-Status

| System | Status | Verwendung |
|--------|--------|------------|
| **Aggregation Registry** | ✅ Produktiv | Scheduler, Queue, Worker, Pipeline |
| **Import Adapters** | ⚠️ Legacy | `ImportOrchestrator` — nur Tests/Kompatibilität |
| **ER-013 Connectors** | ⚠️ Admin-only | Endpoint-UI, nicht Import-Fetch |

`ImportOrchestrator` ist deprecated. Produktive Imports laufen ausschließlich über `ImportAggregationService`.

Parser werden geteilt:

- `import/parsers/feed-parser.ts` — RSS/Atom (Adapter + Connectors)
- `import/parsers/csv-source-parser.ts` — CSV (Adapter + Connectors)

## Website-Konfiguration

Titel-Bereinigung config-getrieben via `source_config.website.transforms`:

- `remove_suffix`, `remove_prefix`, `regex_replace`, `trim`
- Keine quellenspezifischen Namen im Framework-Code

Gemeinsame Website-Basis: `website/website-source-connector-base.ts` (club + organizer).

## Reputation Integration (Sprint 26 Teil 2)

`ImportAggregationService` → `SourceReputationService.recordImportRunOutcome()`:

| Outcome | Reputation |
|---------|------------|
| Erfolgreicher Import mit Daten | Positiv / neutral je nach Publish/Review |
| Keine Datensätze | Neutral |
| Technischer Plattformfehler | Keine Änderung |
| Source-Parsing/Mapping-Fehler | Negativ |
| Review-Queue | Leicht negativ |
| Duplikate | Neutral bis leicht negativ |

Idempotenz über `importJobId` in Reputation-Metadaten. Queue-Processor setzt `recordImportReputation: false` während Retries.

## Discovery Trust (Sprint 26 Teil 2)

Regel für Multi-Source-Events: **höchster effektiver Trust** unter allen bekannten `source_id`s.

- Provider: `discovery/trust/discovery-source-trust.ts`
- Batch-Load pro Discovery-Query (kein N+1)
- Fallback: `DISCOVERY_DEFAULT_SOURCE_TRUST = 50`
- Ranking bleibt deterministisch

## Testanforderungen

Bei Connector-Änderungen:

- Unit-Tests für Auflösung (`source-connector-resolution`)
- Connector-Fetch-Tests (`source-connectors.test.ts`)
- Scheduler/Queue-Routing (`sprint15-production-scheduler.test.ts`)
- Sprint-26-Konsolidierungstests
- Typecheck + relevante Vitest-Suite

## Neue Quelle hinzufügen (Kurzanleitung)

1. Quellentyp bestimmen (Website, RSS, CSV, iCal, API).
2. `public.sources`-Eintrag anlegen (Admin oder Seed) mit `source_roles` und/oder `sourceConfig.reference.connectorKey`.
3. `source_config` ausfüllen:
   - Website: `website.preferredStrategy`, `htmlSelector` oder JSON-LD
   - RSS/Atom: `feed.feedUrl` oder `reference.feed`
   - CSV: `csv.fieldMapping`, optional `reference.csv`
   - API: `api.fieldMapping`
4. Optional Fixture für Tests unter `reference.*`.
5. Entity-Aliases für Matching ergänzen.
6. Manuellen Import ausführen, Trust/Publish prüfen.
7. Schedule aktivieren wenn gewünscht.

### Beispiel `source_config` (Club-Website, HTML-Selektoren)

```json
{
  "reference": { "connectorKey": "club_website" },
  "website": {
    "preferredStrategy": "html_selector",
    "htmlSelector": {
      "eventContainerSelector": ".event",
      "titleSelector": ".title",
      "dateSelector": ".date"
    },
    "transforms": [{ "type": "trim" }]
  }
}
```
