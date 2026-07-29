# Connector Health

Einheitliches Health-Modell für Source Connectors.

## Statuswerte

| Status | Bedeutung |
|--------|-----------|
| `healthy` | Letzter Lauf erfolgreich |
| `degraded` | Wiederholte nicht-kritische Fehler (Mapping, Schema) |
| `offline` | Netzwerk/Timeout/Upstream nicht erreichbar |
| `unauthorized` | Auth-Fehler (401/403) |
| `rate_limited` | API Rate Limit erreicht |
| `maintenance` | Upstream-Wartung (503) |

## Snapshot-Struktur

```typescript
interface SourceConnectorHealthSnapshot {
  status: SourceConnectorHealthStatus;
  lastSuccessfulRunAt?: string;
  lastErrorAt?: string;
  lastErrorCode?: SourceConnectorErrorCode;
  lastErrorMessage?: string;
  successRate: number;        // 0–1
  errorCount: number;
  totalRunCount: number;
  averageDurationMs: number;
  lastResponseTimeMs?: number;
  updatedAt: string;
}
```

## Aktualisierung

Health wird **in-memory** durch `SourceConnectorRegistry` aktualisiert:

- Erfolg → `healthy`, `lastSuccessfulRunAt`, `successRate` neu berechnet
- Fehler → Status aus `resolveHealthStatusFromErrorCode(error.code)`

```typescript
const health = sourceConnectorRegistry.getHealth('open_data_api');
```

## Keine UI

Health-Daten sind für Admin/Ops vorbereitet, aber in dieser Phase ohne UI.

## Persistenz

Aktuell nur In-Memory. Persistente Speicherung in Supabase ist eine spätere Phase.

## Fehler → Health Mapping

| Error Code | Health Status |
|------------|---------------|
| `authentication_failed` | `unauthorized` |
| `rate_limited` | `rate_limited` |
| `maintenance` | `maintenance` |
| `timeout`, `network_error`, `upstream_unavailable` | `offline` |
| `schema_invalid`, `mapping_failed`, `configuration_invalid` | `degraded` |
