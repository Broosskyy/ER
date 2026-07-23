# ER-014 Part 3 — Connector Execution Engine Completion Report

**Epic:** ER-014 Website Connector (Part 3 — Connector Execution Engine)  
**Date:** 22 July 2026  
**Repository:** `C:/ER`

---

## 1. Execution Engine Implementation

Implemented `ConnectorExecutionEngine` (`features/connectors/services/connector-execution-engine.ts`) as the canonical application service for connector execution.

**Flow:** Load endpoint → validate executability → resolve connector → build context → `ConnectorFrameworkService.executeConnector()` → validate candidates → return `ConnectorExecutionResult`.

The engine is connector-agnostic — no `if (connectorKey === 'website')` branches.

---

## 2. Request and Result Contracts

**Files:** `features/connectors/contracts/connector-execution.ts`

| Contract | Purpose |
|----------|---------|
| `ConnectorExecutionRequest` | `endpointId`, `trigger`, `requestedBy`, `correlationId`, `sourceId` hint |
| `ConnectorExecutionResult` | Full execution record with candidates, diagnostics, errors, logs |
| `ConnectorExecutionDiagnostics` | Timing breakdown, candidate count, cancellation state |
| `ConnectorExecutionLogEntry` | Structured lifecycle log entries |
| `ConnectorExecutionRecord` | Persistence metadata shape |

Triggers: `manual`, `system`, `test`. Statuses: `succeeded`, `failed`, `cancelled`.

---

## 3. Endpoint Loading and Validation

**Loader:** `SourceConfigEndpointExecutionLoader` searches `SourceRecord.sourceConfig.endpoints` via `AdminSourceRepository`.

**Engine validation** (`endpoint-execution-validation.ts`):
- Endpoint enabled
- Source enabled and not archived
- Source/endpoint ID consistency
- `validateAcquisitionEndpoint()` framework checks
- Connector registration + endpoint type compatibility

Connector-specific validation remains connector-owned.

---

## 4. Connector Resolution

Via existing `ConnectorRegistry.getRegistration()` — no hardcoded connector map, no direct `WebsiteConnector` construction in the engine.

---

## 5. Execution Context

Assembled by engine with:
- `executionId`, `correlationId`, `triggerType`, `initiatedBy`
- `runtime.abortSignal` (new field on `ConnectorRuntimeHints`)
- Structured `log()` callback forwarding to engine lifecycle logs

---

## 6. Lifecycle and Logging

Lifecycle codes: `EXECUTION_REQUESTED`, `EXECUTION_ENDPOINT_LOADED`, `EXECUTION_CONNECTOR_RESOLVED`, `EXECUTION_STARTED`, `EXECUTION_SUCCEEDED` / `EXECUTION_FAILED` / `EXECUTION_CANCELLED`, `EXECUTION_COMPLETED`.

Log metadata sanitized — no raw HTML, secrets, or auth headers. Website connector `WEBSITE_*` logs preserved.

---

## 7. Diagnostics Aggregation

Engine aggregates:
- `endpointLoadDurationMs`
- `connectorResolutionDurationMs`
- `connectorExecutionDurationMs`
- `totalDurationMs`
- `candidateCount`
- `connectorDiagnostics` (passthrough from connector)

No parsing or normalization metrics.

---

## 8. Error Mapping

| Category | Examples | Source |
|----------|----------|--------|
| Endpoint | `ENDPOINT_NOT_FOUND`, `ENDPOINT_DISABLED`, `SOURCE_DISABLED` | Engine |
| Registry | `CONNECTOR_NOT_FOUND` | Engine |
| Connector | `WEBSITE_*`, `HTTP_*` | Connector / HttpClient |
| Contract | `CONNECTOR_CONTRACT_VIOLATION` | Engine post-validation |
| Engine | `ENGINE_UNEXPECTED_ERROR`, `EXECUTION_PERSISTENCE_FAILED` | Engine |
| Cancellation | `EXECUTION_CANCELLED` | Engine |

Unexpected exceptions never escape without finalization.

---

## 9. Candidate Contract Validation

`candidate-validation.ts` enforces:
- `candidates` is an array
- Each candidate has `externalId`, `rawPayload` object, `metadata.retrievedAt`
- Endpoint/source ID consistency when present in metadata
- No Event entity marker fields

**Rule:** Invalid candidates fail the **entire** execution — none silently discarded.

---

## 10. Cancellation Behavior

- Optional `AbortSignal` on `engine.execute(request, { signal })`
- Propagated via `ConnectorContext.runtime.abortSignal`
- Website connector checks abort at execute start
- Status `cancelled` with `EXECUTION_COMPLETED` log

---

## 11. Timeout Ownership

HttpClient timeout remains transport-owned. Engine does not introduce a second HTTP timeout layer.

---

## 12. Persistence Decision

| Item | Decision |
|------|----------|
| Interface | `ConnectorExecutionRepository` |
| Implementation | `InMemoryConnectorExecutionRepository` (no DB migration) |
| Stored | Execution metadata, diagnostics summary, error summary |
| Not stored | Raw HTML, candidate bodies, secrets |
| Candidates | **Returned only** — persistence deferred |

---

## 13. Idempotency Decision

- Each request → new unique `executionId`
- Duplicate manual requests → separate executions
- Connector invoked at most once per execution
- Scheduler deduplication → ER-015

---

## 14. Concurrency Decision

- Concurrent executions for same endpoint: **allowed**
- No distributed locking in Part 3
- Metadata supports future ER-015 locks

---

## 15. Manual Execution Entry Point

`ConnectorExecutionService.executeEndpoint(role, request)` — requires `sources:write` admin permission. Wired in `data/repositories/registry.ts`. No public API route or admin UI in Part 3.

`ConnectorAdminService.getDiagnostics()` now reports `executionAvailable: true`.

---

## 16. Security Protections

- `sanitizeExecutionLogMetadata()` strips sensitive keys and truncates long strings
- No raw HTML in logs
- Admin actor via `requestedBy`
- Errors sanitized for application-facing output

---

## 17. Tests Added

**15 new tests** in `connector-execution-engine.test.ts`:

- Successful website execution through engine
- Endpoint not found, disabled
- Connector not registered
- Connector configuration error
- Transport failure mapping
- Contract violations (non-array, missing retrievedAt)
- Unexpected connector exceptions
- Cancellation
- Log security (no HTML)
- Persistence metadata
- Unique execution IDs
- Admin permission gate on execution service

**Total: 534 tests PASS**

---

## 18. Documentation Updated

| Document | Change |
|----------|--------|
| `app-v2/docs/connector-execution-engine.md` | **Created** |
| `app-v2/docs/connector-framework.md` | Execution engine section |
| `app-v2/docs/endpoints-domain.md` | Updated acquisition flow |
| `app-v2/docs/website-connector.md` | Engine execution reference |
| `AI_CONTEXT.md` | ER-014 Part 3 status, 534 tests |

---

## 19. Files Changed

### New

| File | Purpose |
|------|---------|
| `contracts/connector-execution.ts` | Request/result contracts |
| `domain/connector-execution-ids.ts` | ID generation |
| `domain/endpoint-execution-loader.ts` | Endpoint loading |
| `domain/endpoint-execution-validation.ts` | Engine-boundary validation |
| `domain/candidate-validation.ts` | Post-connector candidate validation |
| `domain/execution-log-sanitizer.ts` | Log metadata sanitization |
| `repositories/connector-execution-repository.ts` | Persistence interface + in-memory impl |
| `services/connector-execution-engine.ts` | Execution engine |
| `services/connector-execution-service.ts` | Manual admin entry point |
| `__tests__/connector-execution-engine.test.ts` | Engine tests |

### Modified

| File | Change |
|------|--------|
| `contracts/connector-context.ts` | `abortSignal` on runtime hints |
| `providers/website/website-connector.ts` | Abort check at execute start |
| `data/repositories/registry.ts` | Wire engine + service |
| `services/connector-admin-service.ts` | `executionAvailable: true` |
| `index.ts` | Export execution types/services |
| `__tests__/test-helpers.ts` | Mock candidate `retrievedAt` |
| `__tests__/connector-admin-service.test.ts` | Updated executionAvailable expectation |

---

## 20. Known Limitations

- In-memory execution persistence only (lost on restart)
- No scheduler, queue, or workers (ER-015)
- No candidate persistence
- No admin execution UI
- No parsing, normalization, or Event creation
- Concurrent executions not limited per endpoint
- Endpoint loader scans all sources (no dedicated endpoints table)

---

## 21. Validation Results

| Gate | Result |
|------|--------|
| `npm run typecheck` | **PASS** |
| `npm test` (534) | **PASS** |
| `npm run release:check` | **PASS** |
| No direct `fetch` in engine | **Confirmed** |
| No parsing/normalization/Events | **Confirmed** |
| No scheduler/retries/locking | **Confirmed** |
| No raw HTML in logs | **Confirmed** |
| Framework boundaries unchanged | **Confirmed** |

**ER-014 Part 3 is complete.**
