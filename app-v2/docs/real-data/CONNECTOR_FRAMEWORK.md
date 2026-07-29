# Connector Framework

Sprint 9 Phase 2 — Multi-Connector Framework for the aggregation import path.

## Ziel

Die bestehende `SourceConnector`-Schicht zu einer skalierbaren Plattform ausbauen, damit zukünftige Quellen ohne Architekturänderungen integriert werden können.

## Architektur

Keine neue Import-Architektur. Erweiterung der bestehenden Aggregation-Connectoren:

```
SourceRecord
  → SourceConnectorRegistry (Descriptors + Runtime State)
  → SourceConnectorExecutor (Rate Limit + Retry + Diagnostics)
  → BaseSourceConnector.fetchRawEvents()
  → AggregationPipeline (unverändert)
```

### Kernmodule

| Modul | Pfad |
|-------|------|
| Capabilities | `connectors/framework/capabilities.ts` |
| Versionierung | `connectors/framework/versioning.ts` |
| Health | `connectors/framework/health.ts` |
| Fehler | `connectors/framework/errors.ts` |
| Retry | `connectors/framework/retry.ts` |
| Rate Limit | `connectors/framework/rate-limit.ts` |
| Diagnostics | `connectors/framework/diagnostics.ts` |
| Metrics | `connectors/framework/metrics.ts` |
| Definitions | `connectors/framework/connector-definitions.ts` |
| Base Connector | `connectors/framework/base-source-connector.ts` |
| Executor | `connectors/framework/source-connector-executor.ts` |
| Registry | `connectors/source-connector-registry.ts` |

## Registrierte Connectoren

| Key | Typ | Datenformat |
|-----|-----|-------------|
| `manual_reference` | manual | inline_json |
| `club_website` | website | json_ld / html_selector |
| `organizer_website` | website | json_ld / html_selector |
| `ical_feed` | feed | ical |
| `open_data_api` | api | json |
| `rss_feed` | feed | rss |
| `atom_feed` | feed | atom |
| `csv_import` | file | csv |

## Registry-Erweiterungen (additiv)

Jeder `SourceConnectorDescriptor` enthält:

- `version` — connectorVersion, schemaVersion, supportedApiVersions, minimumRegistryVersion
- `capabilities` — einheitliche Capability-Struktur
- `retryConfig` — Default + per-Source Overrides via `sourceConfig.connectorFramework.retry`
- `rateLimitConfig` — Default + per-Source Overrides via `sourceConfig.connectorFramework.rateLimit`
- `health` — Laufzeit-Snapshot
- `metrics` — aggregierte Laufzeitmetriken
- `limitations` — dokumentierte Einschränkungen

## Per-Source Overrides

```typescript
sourceConfig: {
  connectorFramework: {
    retry: { maxRetries: 5 },
    rateLimit: { requestsPerMinute: 30, burstLimit: 5 },
  },
}
```

## Abgrenzung

Bewusst **nicht** implementiert:

- Zweite Produktivquelle
- Scheduler / Auto-Import
- Social-Media-Import
- Push Notifications
- ER-013 Website-Connector Bridge (separates Framework)

## Nächste Phase

- Automatische Pagination für `open_data_api`
- Persistente Health/Metrics in Supabase
- Bridge ER-013 `Connector` → `SourceConnector` (optional)

## Sprint 26 Erweiterungen

### Title Transforms

Config-getriebene Titel-Bereinigung über `source_config.website.transforms` (siehe `WEBSITE_CONNECTOR_FRAMEWORK.md`).

### Reputation Feedback

Abgeschlossene Importläufe melden Outcomes an `SourceReputationService.recordImportRunOutcome()`:

- Einmal pro `importJobId` (Worker-Retries zählen nicht mehrfach)
- Plattformfehler → kein Trust-Penalty
- Source-Fehler / Review / Duplikate → Trust-Anpassung

### Discovery Trust

`DiscoveryEngine` lädt echten Source Trust batchweise. Multi-Source-Events: höchster bekannter Trust. Fallback: `50`.
