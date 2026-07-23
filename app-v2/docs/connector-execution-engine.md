# Connector Execution Engine — Architecture Notes

**Epic:** ER-014 Part 3  
**Scope:** Canonical connector execution orchestration. No scheduling, parsing, normalization, or publishing.

## Position in the stack

```
Manual / System Caller
        ↓
ConnectorExecutionService (admin entry point)
        ↓
ConnectorExecutionEngine
        ↓
Endpoint Loader → Endpoint Validation
        ↓
ConnectorRegistry → ConnectorFrameworkService
        ↓
Connector (e.g. WebsiteConnector)
        ↓
HttpClient (transport)
        ↓
AcquisitionCandidate[]
        ↓
ConnectorExecutionResult
```

## Responsibilities

| Owns | Does not own |
|------|--------------|
| Endpoint loading from `SourceRecord.sourceConfig.endpoints` | HTTP transport |
| Engine-boundary endpoint executability checks | Connector-specific configuration |
| Connector resolution via registry | Parsing, normalization, Events |
| Execution context assembly | Scheduling, retries, queues |
| Execution lifecycle logging | Raw HTML in logs |
| Candidate contract validation | Duplicate detection |
| Canonical `ConnectorExecutionResult` | Publishing |

## Request contract

```typescript
ConnectorExecutionRequest {
  endpointId: string;
  trigger: 'manual' | 'system' | 'test';
  requestedBy?: string;
  correlationId?: string;
  sourceId?: string; // optional lookup hint
}
```

## Result contract

```typescript
ConnectorExecutionResult {
  executionId: string;
  endpointId: string;
  sourceId?: string;
  connectorKey: string;
  trigger: ConnectorExecutionTrigger;
  status: 'succeeded' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  candidates: AcquisitionCandidate[];
  diagnostics: ConnectorExecutionDiagnostics;
  errors: ConnectorErrorDetail[];
  logs: ConnectorExecutionLogEntry[];
}
```

## Validation ownership

| Layer | Validates |
|-------|-----------|
| **Engine** | Endpoint exists, enabled, source enabled/not archived, framework endpoint fields, connector registered, endpoint type compatible with connector registration |
| **Connector** | Connector-specific configuration (e.g. website URL, JS rendering) |
| **HttpClient** | URL, timeout, redirects, HTTP status, content type |
| **Engine (post-connector)** | Candidate array contract (`externalId`, `rawPayload`, `metadata.retrievedAt`) |

Invalid candidates **fail the entire execution** — none are silently discarded.

## Execution lifecycle logs

| Code | When |
|------|------|
| `EXECUTION_REQUESTED` | Request accepted |
| `EXECUTION_ENDPOINT_LOADED` | Endpoint + source resolved |
| `EXECUTION_CONNECTOR_RESOLVED` | Registry lookup succeeded |
| `EXECUTION_STARTED` | Connector invoked |
| `EXECUTION_SUCCEEDED` | Connector completed successfully |
| `EXECUTION_FAILED` | Failure before completion log |
| `EXECUTION_CANCELLED` | Abort signal |
| `EXECUTION_COMPLETED` | Always emitted (success, failure, cancellation) |

Connector-specific logs (e.g. `WEBSITE_*`) are preserved.

## Cancellation

- Engine accepts optional `AbortSignal`
- Propagated via `ConnectorContext.runtime.abortSignal`
- Cancellation before connector start → status `cancelled`
- No partial success on cancellation
- HttpClient timeout remains transport-owned — engine does not add a second HTTP timeout

## Persistence

- `ConnectorExecutionRepository` interface + `InMemoryConnectorExecutionRepository`
- Persists execution metadata only (no raw HTML, no candidate bodies)
- **Candidates are returned in the result only** — candidate persistence deferred to a later epic
- Wired in `data/repositories/registry.ts`

## Idempotency

- Each accepted request creates a **new** unique `executionId`
- Duplicate manual requests may create separate executions
- Engine invokes connector **at most once** per execution
- Scheduler-level deduplication belongs to ER-015

## Concurrency

- Concurrent executions for the same endpoint are **allowed** in Part 3
- No distributed locking
- Execution metadata supports future ER-015 lock implementation

## Manual execution entry point

```typescript
connectorExecutionService.executeEndpoint(role, request, { signal?, requestedBy? })
```

- Requires `sources:write` admin permission
- Delegates to `ConnectorExecutionEngine` only
- No public API route in Part 3

## Security

- No secrets, raw HTML, or auth headers in lifecycle logs
- Log metadata sanitized via `sanitizeExecutionLogMetadata()`
- Admin actor recorded via `requestedBy` when provided

## Preparation for ER-015

The engine exposes stable execution IDs, correlation IDs, lifecycle logs, and persistence hooks for the future scheduler without requiring engine changes for new connectors.

## Related documentation

- `app-v2/docs/connector-framework.md`
- `app-v2/docs/website-connector.md`
- `app-v2/docs/endpoints-domain.md`
- `docs/ER-014_PART3_CONNECTOR_EXECUTION_ENGINE_COMPLETION_REPORT.md`
