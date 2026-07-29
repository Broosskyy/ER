# Connector Diagnostics

Strukturierte Diagnosedaten pro Connector-Lauf.

## Struktur

```typescript
interface SourceConnectorDiagnostics {
  durationMs: number;
  eventCount: number;
  errors: SourceConnectorErrorDetail[];
  warnings: SourceConnectorDiagnosticsWarning[];
  skippedRecords: number;
  mappingIssues: SourceConnectorMappingIssue[];
  apiVersion?: string;
  connectorVersion: string;
  schemaVersion: string;
  retryAttempts: number;
  rateLimited: boolean;
}
```

## Erzeugung

`SourceConnectorExecutor` erzeugt Diagnostics bei jedem Lauf:

1. Rate-Limit-Acquisition (mit `rateLimited`-Flag)
2. `fetchRawEvents()` mit Retry-Loop
3. `detectMappingIssues()` für fehlende Pflichtfelder (title, startDate)
4. Version aus `describeVersion()`

## Beispiel

```typescript
const executor = registry.getExecutor();
const { diagnostics } = await executor.execute(connector, source, importSource, context);

console.log(diagnostics.eventCount);
console.log(diagnostics.mappingIssues);
console.log(diagnostics.retryAttempts);
```

## Mapping Issues

Automatisch erkannt:

- Fehlender `title`
- Fehlendes `startDate`

Weitere Mapping-Validierungen können in späteren Phasen ergänzt werden.

## Keine Textlogs

Diagnostics sind strukturierte Objekte — keine reinen String-Logs. Aggregation-Logging bleibt separat.

## Retry-Metadaten

Zusätzlich liefert `SourceConnectorExecutionResult.retryMetadata[]` pro Retry-Versuch:

- `attempt`
- `maxRetries`
- `delayMs`
- `errorCode`
- `completedAt`
