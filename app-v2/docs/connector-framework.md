# Connector Framework — Architecture Notes

**Epic:** ER-013 (+ ER-014 Part 2 Website Connector)  
**Scope:** Provider-independent execution infrastructure. Website Connector registered (ER-014 Part 2). No schedulers, workers, or queues.

## Position in the stack

```
Source (metadata registry — ER-012)
  ↓
Connector (execution — ER-013)
  ↓
Acquisition Candidate
  ↓
Review → Approval → Event (existing import pipeline)
```

**Source** describes *what* to acquire from. **Connector** performs *how* to acquire. Connectors never create Events.

## Lifecycle (metadata only)

```
Registered → Configured → Ready → Executing → Completed | Failed
```

ER-013 defines lifecycle states only. No runtime engine or state machine persistence.

## Canonical contract

Every future connector implements `Connector`:

| Method | Purpose |
|--------|---------|
| `describeCapabilities()` | Declarative capability flags (no execution) |
| `validateConfiguration(context)` | Framework + connector config checks |
| `execute(context)` | Returns `ConnectorResult` with acquisition candidates |
| `describeHealth?(context)` | Optional health metadata (future monitoring) |

Registration uses `ConnectorRegistration` with a factory `create: () => Connector`.

## Execution context

`ConnectorContext` is **immutable execution input** — all fields are `readonly`. Connectors must not mutate source, endpoint, execution metadata, runtime hints, authentication, or rate-limit fields.

`ConnectorContext` encapsulates all execution inputs — no long parameter lists:

- `source` — `Readonly<SourceRecord>` from ER-012
- `endpoint?` — `Readonly<ConnectorEndpointRef>` from ER-014 endpoint model
- `execution` — execution id, correlation id, trigger type, timestamps
- `runtime?` — cancellation and tracing hints (prepared, not enforced)
- `authentication?` — mechanism metadata only (no secrets)
- `rateLimit?` — configured limits (enforcement deferred)
- `log()` — structured logging callback

## Connector developer contract (frozen ER-014.1)

**Architecture freeze:** ER-014 Part 1.1 through ER-020 should **extend** this framework, not redesign it.

### Connector lifetime

Connectors MUST be stateless **or** return a fresh instance from `ConnectorRegistration.create()` on every execution. The Factory creates a new instance per `executeConnector()` call.

### Connectors MUST

- Implement the `Connector` contract (or extend `BaseConnector`)
- Register via `register-connectors.ts` only
- Return `AcquisitionCandidate[]` in `ConnectorResult` — never Event entities
- Treat `ConnectorContext` as read-only input
- Use the `HttpClient` abstraction for transport (not raw fetch)

### Connectors MUST NOT

- Modify `Source`, `Endpoint`, or `ConnectorContext`
- Write to the database
- Create Events
- Perform normalization or duplicate resolution
- Publish content
- Bypass the Connector Framework or execution pipeline
- Bypass the `HttpClient` abstraction for HTTP transport

### Connector responsibility boundary

```
Endpoint
  ↓
Transport (via HttpClient)
  ↓
Raw acquisition payload
  ↓
AcquisitionCandidate
```

Nothing beyond raw acquisition output. Review, normalization, duplicate resolution, and publishing belong to downstream pipelines.

## Result model

`ConnectorResult` is acquisition output only:

- `candidates[]` — `AcquisitionCandidate` (never Event entities)
- `warnings[]`, `errors[]` — `ConnectorErrorDetail` with unified categories
- `statistics`, `diagnostics`, `durationMs`, `metadata`

## Capability model

`ConnectorCapabilities` describes support declaratively:

- `supportsAuthentication`, `supportsPolling`, `supportsWebhook`
- `supportsPagination`, `supportsIncrementalSync`

Framework validation can flag inconsistent capability declarations (e.g. both webhook and polling).

## Error strategy

Unified categories: `configuration`, `authentication`, `connectivity`, `parsing`, `timeout`, `rate_limit`, `unknown`.

Framework errors: `ConnectorRegistryError`, `ConnectorValidationError`, `ConnectorExecutionError`.

No provider-specific exception classes.

## Registry

`ConnectorRegistry` (`features/connectors/registry/connector-registry.ts`):

- `register(registration)` — additive, rejects duplicates
- `getRegistration(key)`, `has(key)`, `listKeys()`, `listDescriptors()`
- `inspectCapabilities(key)` — capability discovery without instantiation

## Factory

`ConnectorFactory` (`features/connectors/registry/connector-factory.ts`):

- `create(key)` — constructs connector from registration factory
- Does not execute connectors

## Framework service

`ConnectorFrameworkService` orchestrates framework-level validation and connector invocation:

- `validateBeforeExecution()` — registration, capability consistency, context
- `executeConnector()` — validate → create → connector.validateConfiguration → connector.execute
- `getDiagnostics()` — registration inspection

`ConnectorExecutionEngine` (ER-014 Part 3) is the canonical application entry point for endpoint-based execution. It loads endpoints, validates executability, assembles context, invokes `ConnectorFrameworkService`, validates candidates, and returns `ConnectorExecutionResult`.

## Dependency injection

Wired in `data/repositories/registry.ts`:

```typescript
registerConnectors(connectorRegistry);
export const connectorFactory = new ConnectorFactory(connectorRegistry);
export const connectorFrameworkService = new ConnectorFrameworkService(...);
```

`registerConnectors()` is the bootstrap hook for provider registrations. ER-014 Part 2 registers the **Website Connector** (`connectorKey: website`). ER-014 Part 3 adds the **Connector Execution Engine** — see `app-v2/docs/connector-execution-engine.md`.

## Adding a future connector

1. Implement `Connector` (or extend `BaseConnector`)
2. Define `ConnectorRegistration` with capabilities and factory
3. Call `connectorRegistry.register(registration)` from `register-connectors.ts`
4. Do **not** modify framework internals, Source domain, or Import orchestrator

## Extension points (prepared, not implemented)

- Retry policies and backoff
- Health monitoring and execution history
- Distributed / parallel execution
- Authentication providers
- Observability, metrics, telemetry
- Job queues and worker pools
- Endpoint persistence (one Source → many endpoints) — **domain model defined in ER-014**; see `app-v2/docs/endpoints-domain.md`

## Registered providers

| Key | Epic | Transport | Output |
|-----|------|-----------|--------|
| `website` | ER-014 Part 2 | `DefaultHttpClient` (GET, timeout, redirects) | One `AcquisitionCandidate` with raw HTML |

## Deferred (out of scope)

RSS, JSON API, iCal, Ticket Platform, Social, and AI connectors; scheduler; worker; queue; execution engine; parser framework; normalization; duplicate resolution; publishing; database tables for connectors/endpoints.

## Admin CMS (ER-013 Part 3)

Connector administration is available at `/admin/connectors` for users with `sources:read` / `sources:write` permissions.

### Registry UI

- Lists registered connectors with key, display name, version, lifecycle state, health status, capability summary, and supported endpoint types
- Shows framework diagnostics (registration count, registry integrity, configuration issues)
- Displays **Framework Ready** and **Execution Not Yet Available** banners

### Configuration model

Framework-level settings only — no provider-specific configuration:

| Setting | Scope | Notes |
|---------|-------|-------|
| `enabled` | Global + per-connector | Framework readiness only |
| `defaultTimeoutMs` | Global + per-connector | Placeholder — not enforced |
| `maxRetries` | Global + per-connector | Placeholder for future retry policy |
| `maxConcurrentExecutions` | Global + per-connector | Placeholder for future limits |
| `diagnosticsEnabled` | Global + per-connector | Controls diagnostics visibility |
| `authenticationMechanismPlaceholder` | Global + per-connector | Future auth provider selection |

Settings persist in AsyncStorage (`app.connectorFrameworkAdminConfig`) — no database tables.

### Source integration

Sources can assign a connector via `sourceConfig.connector`:

```
Source → Assigned Connector → Future Endpoint (placeholder)
```

Managed on the Source detail screen (`/admin/sources/[id]`). Endpoint management is UI-only placeholder.

### Capability inspection

Read-only capability viewer on connector detail screen. Includes authentication, polling, webhooks, pagination, incremental sync, manual execution (not available), and scheduled execution (future).

### Health states

Framework readiness only — not runtime health checks:

| State | Meaning |
|-------|---------|
| `ready` | Registration valid, configuration complete, enabled |
| `configuration_required` | Missing or invalid framework configuration |
| `disabled` | Connector or global framework disabled |
| `unsupported` | Connector key not registered |
| `unknown` | Could not resolve status |

### Diagnostics

`ConnectorAdminService.getDiagnostics()` verifies:

- Connector registration integrity
- Framework configuration validity
- Capability consistency
- Missing required configuration

No external requests are made.

### Services

```typescript
export const connectorAdminService = new ConnectorAdminService(
  connectorFrameworkService,
  connectorRegistry,
  connectorConfigStore,
  sourceService,
  sourceService,
);
```

## Backward compatibility

ER-012 Source management, Import workflow, and existing Admin CMS behaviour remain unchanged outside connector additions. The connector framework is additive infrastructure only.
