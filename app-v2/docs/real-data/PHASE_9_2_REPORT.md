# Phase 9.2 Report — Multi-Connector Framework

Sprint 9 Phase 2 Abschlussbericht.

## Zusammenfassung

Die bestehende `SourceConnector`-Schicht wurde zu einer skalierbaren Multi-Connector-Plattform ausgebaut — ohne neue Import-Architektur und ohne zweite Produktivquelle.

## Implementiert

### Capability-Modell
- 11 einheitliche Capability-Flags
- Alle 5 Connectoren über `BaseSourceConnector.describeCapabilities()`

### Versionierung
- `connectorVersion`, `schemaVersion`, `supportedApiVersions`, `minimumRegistryVersion`
- Registry-Version: `1.0.0`
- Abwärtskompatibel — bestehende Connectoren unverändert im Verhalten

### Health-Modell
- 6 Statuswerte: healthy, degraded, offline, unauthorized, rate_limited, maintenance
- Snapshot mit Erfolgsquote, Fehleranzahl, Laufzeiten
- In-Memory via `SourceConnectorRegistry`

### Retry Engine
- Exponential Backoff mit Jitter
- Retry bei: Netzwerk, Timeout, 5xx, Rate Limit (nach Cooldown)
- Kein Retry bei: 400, 401, 403, Mapping, Konfiguration
- Konfigurierbar via `retryConfig` + `sourceConfig.connectorFramework.retry`

### Rate Limiter
- `requestsPerMinute`, `burstLimit`, `cooldownMs`, `concurrentRequests`
- Keine Hardcodes — Defaults pro Connector-Definition, Overrides per Source
- `SourceConnectorRateLimiter` (In-Memory)

### Diagnostics
- Strukturierte Objekte: Laufzeit, Eventanzahl, Fehler, Warnungen, Mapping-Issues, Versionen
- Retry-Metadaten pro Versuch

### Metrics (vorbereitet)
- `importedEvents`, `skippedEvents`, `duplicateRate`, `mergeRate`, `publishRate`
- `averageResponseTimeMs`, `averageMappingTimeMs`, `totalRuns`
- Noch keine automatische Bewertung

### Registry-Erweiterungen
- `getDescriptor()`, `listDescriptors()`, `getHealth()`, `getMetrics()`
- Deskriptoren mit version, capabilities, health, metrics, retryConfig, rateLimitConfig

### Fehlermodell
- 9 typisierte Codes: `authentication_failed`, `timeout`, `network_error`, `rate_limited`, `schema_invalid`, `mapping_failed`, `upstream_unavailable`, `maintenance`, `configuration_invalid`
- `SourceConnectorError` + `classifySourceConnectorError()`

## Connector-Matrix (Analyse)

| Connector | Typ | Format | Auth | Timeout | Retry | Rate Limit | Pagination |
|-----------|-----|--------|------|---------|-------|------------|------------|
| manual_reference | manual | inline_json | none | 0 | 0 | hoch | — |
| club_website | website | json_ld | none | 60s | 3 | 30/min | — |
| organizer_website | website | json_ld | none | 60s | 3 | 30/min | — |
| ical_feed | feed | ical | optional | 60s | 3 | 60/min | — |
| open_data_api | api | json | optional | 60s | 3 | 60/min | metadata |

## Verifikation

| Check | Ergebnis |
|-------|----------|
| Typecheck | grün |
| Tests | **881** bestanden (+18 neue) |
| Lint | 0 Errors |
| Migrationen | keine neue |

## Bekannte Einschränkungen

- Health/Metrics nur In-Memory (kein Persist)
- Pagination-Capability deklarativ, nicht automatisch ausgeführt
- ER-013 Website-Connector-Framework nicht verbunden
- `duplicateRate`/`mergeRate`/`publishRate` in Metrics noch nicht aus Pipeline befüllt
- Keine Admin-UI für Connector Health

## Bewusst nicht implementiert

- Zweite Produktivquelle
- Scheduler / Auto-Import
- Social-Media-Import
- Push Notifications

## Nächste Empfehlung

1. Persistente Health/Metrics in Supabase
2. Automatische Pagination für `open_data_api`
3. Pipeline-Metriken (duplicate/merge/publish) in Connector-Metrics schreiben
4. Admin-Connector-Health-View (read-only)
