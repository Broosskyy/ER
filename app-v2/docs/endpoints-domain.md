# Endpoints Domain — Architecture Notes

**Epic:** ER-014 Part 1 (+ Part 2 Website Connector transport)  
**Scope:** Reusable acquisition endpoint model. Website is the first consumer. HTTP transport implemented in Part 2; parsing and execution engine deferred.

## Position in the stack

```
Source (provider metadata — ER-012)
  ↓
Endpoint (addressable acquisition target — ER-014)
  ↓
Connector (execution behaviour — ER-013)
  ↓
Acquisition Candidate
  ↓
Review → Approval → Event
```

**Endpoint** sits between Source and Connector. A Source describes the provider; an Endpoint describes *where* and *how* to acquire from that provider for a specific connector type.

## Responsibility boundaries

| Layer | Owns | Does not own |
|-------|------|--------------|
| **Source** | Provider identity, trust, priority, base URL, parser hints, global auth flag | URLs per feed/page, connector execution, parsing |
| **Endpoint** | Id, display name, type, URL, connector key, enabled, type config, health placeholder | HTTP transport, HTML parsing, candidate normalization |
| **Connector** | Validation, acquisition execution, candidate output | Source registry, endpoint persistence |
| **ConnectorContext** | Runtime assembly of source + endpoint + execution metadata | Business configuration storage |
| **HttpClient** | Transport, timeouts, redirects, content-type checks (`DefaultHttpClient`) | Parsing, event extraction |

## Endpoint model

`AcquisitionEndpoint` (`features/endpoints/domain/endpoint-model.ts`):

| Field | Purpose |
|-------|---------|
| `id` | Stable identity within a source |
| `sourceId` | Parent source reference |
| `displayName` | Admin-visible label |
| `endpointType` | `website`, `rss`, `api`, `ical`, `ticket_platform`, `social`, `webhook`, `unknown` |
| `connectorKey` | Registry lookup key |
| `url` | Acquisition URL where applicable |
| `enabled` | Per-endpoint activation |
| `config` | Type-specific declarative config (discriminated union) |
| `metadata` | Operational metadata (no secrets) |
| `healthStatus` | Framework readiness placeholder |
| `createdAt` / `updatedAt` | Audit timestamps |

## Source relationship

One Source → many Endpoints. **No Source model redesign.**

Endpoints persist in `ImportSourceConfig.endpoints[]` on the existing `sources` row JSON (`source_config` column). ER-013's `sourceConfig.connector` remains as legacy single-connector assignment until Admin migrates to endpoint list UI.

```
SourceRecord
  └── sourceConfig
        ├── connector?     (ER-013 legacy)
        └── endpoints[]?   (ER-014)
```

`SourceRecord.baseUrl` remains the provider-level default. Endpoint URLs may equal or extend the base URL (e.g. `/events` path).

## Connector resolution

**Runtime rule (frozen):** `Endpoint.connectorKey` is the **single source of truth** for connector resolution. `Endpoint.endpointType` is never used at runtime.

```
Endpoint.connectorKey
  → ConnectorRegistry.getRegistration(key)
  → ConnectorFactory.create(key)
  → Connector.execute(context)
```

`ENDPOINT_TYPE_CONNECTOR_KEYS` exists only for:

- Default creation (`applyDefaultConnectorKeyForEndpoint`)
- Migrations
- Validation hints
- Developer convenience (`suggestConnectorKeyForEndpointType`)

`resolveConnectorKeyForEndpoint()` reads `connectorKey` only and throws if missing. `resolveEndpointConnector()` verifies registry registration without instantiation. `mapEndpointToConnectorRef()` populates read-only `ConnectorContext.endpoint`.

## HTTP abstraction

`HttpClient` interface (`features/endpoints/contracts/http-abstraction.ts`):

- `HttpRequestOptions` — url, method, headers, timeout, redirects, accepted content types
- `HttpResponse` — status, headers, body, finalUrl, contentType, durationMs
- `HttpClientError` — transport-layer failures with codes mapped to `ConnectorErrorCategory`

**Implementation:** `DefaultHttpClient` (`features/endpoints/http/default-http-client.ts`) — GET/HEAD, timeout via `AbortController`, manual redirect following with loop detection, content-type validation, status `200` only.

**Timeout strategy:** connector framework `defaultTimeoutMs` (per-endpoint timeout deferred).

**Redirect handling:** `followRedirects` + `maxRedirects` on request options (enforced in HTTP layer, not connector).

**Content-type validation:** `acceptedContentTypes` checked in HTTP layer before body reaches connector.

## Website acquisition flow (ER-014 Part 2–3)

```
Source
  → select enabled Endpoint (endpointType: website)
  → ConnectorExecutionEngine.execute()
  → resolve connectorKey → Website Connector
  → HttpClient.request({ url, timeout, ... })
  → raw HTML in memory (opaque — not parsed)
  → Website Connector produces exactly one AcquisitionCandidate
  → ConnectorExecutionResult (candidates returned; persistence deferred)
  → future: parser → normalization → review pipeline
```

Parsing and normalization are explicitly deferred to a future epic.

## Error strategy

Website acquisition failures map into existing `ConnectorErrorDetail` categories:

| Failure | Category |
|---------|----------|
| Invalid URL / content-type | `configuration` |
| Auth required / denied | `authentication` |
| Network / HTTP status / redirect limit | `connectivity` |
| Timeout | `timeout` |
| Rate limit | `rate_limit` |
| Empty body / unparseable HTML | `parsing` |
| Unknown | `unknown` |

Use `mapWebsiteAcquisitionError()` and `mapHttpClientErrorToConnectorDetail()` — no provider-specific exception classes outside the HTTP contract.

## Type-specific configuration

Discriminated union `EndpointTypeConfig`:

- `website` — userAgent, followRedirects, maxRedirects, acceptedContentTypes, requiresJavaScriptRendering (placeholder)
- `rss`, `api`, `ical`, `ticket_platform`, `social`, `webhook` — prepared for future connectors

## Validation

`validateAcquisitionEndpoint()` — framework-level only:

- Required fields, URL format, config type match, URL required for URL-based types
- No HTML/RSS/API format validation

## Deferred (ER-014 Part 3+)

- HTML parsing and event extraction
- Endpoint Admin CMS CRUD
- Database `source_endpoints` table (if JSON becomes insufficient)
- Execution engine integration
- Scheduler / worker triggers
- Per-endpoint timeout configuration

## Framework compatibility

ER-014 extends ER-013 without redesign:

- `ConnectorContext.endpoint` already existed as `ConnectorEndpointRef` — now populated from `AcquisitionEndpoint`
- `ConnectorContext` is immutable (`readonly` fields) as of ER-014 Part 1.1
- `connectorKey` is the runtime resolution source of truth as of ER-014 Part 1.1
- `ConnectorRegistry` / `ConnectorFactory` unchanged
- `ConnectorResult` unchanged
- Source write path unchanged (endpoints stored in existing `sourceConfig` JSON)

## Architecture freeze (ER-014 Part 1.1)

The Endpoint + Connector architecture is **frozen** for ER-014 through ER-020. Future epics extend via new connector registrations and endpoint types — not framework redesign.
