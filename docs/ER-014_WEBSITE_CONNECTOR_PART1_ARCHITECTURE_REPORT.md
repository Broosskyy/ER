# ER-014 — Website Connector — Part 1 Architecture Report

**Epic:** ER-014 Website Connector (Part 1 — Architecture & Endpoint Model)  
**Date:** 22 July 2026  
**Repository:** `C:/ER`

---

## Endpoint Architecture

Introduced `features/endpoints/` as a provider-independent acquisition endpoint domain.

**Core type:** `AcquisitionEndpoint` — id, sourceId, displayName, endpointType, connectorKey, url, enabled, config, metadata, healthStatus, timestamps.

**Endpoint types:** `website`, `rss`, `api`, `ical`, `ticket_platform`, `social`, `webhook`, `unknown`

**Type config:** Discriminated union `EndpointTypeConfig` with per-type declarative settings (Website first; others prepared).

**Health:** `EndpointHealthStatus` placeholder aligned with connector health states.

**Validation:** `validateAcquisitionEndpoint()` — framework-level only, no format parsing.

---

## Source Relationship

One Source → many Endpoints without redesigning `SourceRecord`:

- Endpoints stored in `ImportSourceConfig.endpoints[]` (existing `source_config` JSON column)
- ER-013 `sourceConfig.connector` preserved as legacy single-connector assignment
- `SourceRecord.baseUrl` remains provider-level default; endpoint URLs are acquisition-specific

No database migration in Part 1.

---

## Connector Resolution

```
Source → Endpoint → connectorKey → ConnectorRegistry → ConnectorFactory → Connector
```

- `ENDPOINT_TYPE_CONNECTOR_KEYS` — default mapping (no switch statements in services)
- `resolveConnectorKeyForEndpoint()` — explicit key or type default
- `resolveEndpointConnector()` — registry verification without instantiation
- `mapEndpointToConnectorRef()` — populates `ConnectorContext.endpoint`

---

## HTTP Abstraction

Contracts only in `features/endpoints/contracts/http-abstraction.ts`:

| Contract | Purpose |
|----------|---------|
| `HttpClient` | Provider-independent request interface |
| `HttpRequestOptions` | URL, method, headers, timeout, redirects, content types |
| `HttpResponse` | Status, headers, body, finalUrl, contentType, durationMs |
| `HttpClientError` | Transport failures with retryable flag |

**Boundaries:** HTTP layer owns transport, timeouts, redirects, content-type validation. Connectors receive validated body. No implementation in Part 1.

---

## Acquisition Flow

Designed future Website flow (not implemented):

```
Source → Endpoint (website) → Website Connector → HttpClient → Raw HTML → AcquisitionCandidate
```

Parsing, normalization, and Event creation explicitly deferred.

---

## Error Strategy

Website failures map to existing `ConnectorErrorDetail` categories via:

- `mapHttpErrorToConnectorCategory()`
- `mapWebsiteAcquisitionError()`
- `mapHttpClientErrorToConnectorDetail()`

No new connector exception classes. HTTP errors stay in HTTP contract; connectors use unified error model.

---

## Documentation

- `app-v2/docs/endpoints-domain.md` — full architecture
- `connector-context.ts` — updated `ConnectorEndpointRef` documentation
- `source-config.ts` — `endpoints[]` field documented

---

## Files Changed

**Created:**

```
app-v2/src/features/endpoints/
  domain/endpoint-types.ts
  domain/endpoint-health.ts
  domain/endpoint-config.ts
  domain/endpoint-model.ts
  domain/endpoint-mapper.ts
  domain/endpoint-connector-resolution.ts
  domain/endpoint-validation.ts
  domain/website-error-mapping.ts
  contracts/http-abstraction.ts
  index.ts
  __tests__/endpoint-architecture.test.ts
app-v2/docs/endpoints-domain.md
docs/ER-014_WEBSITE_CONNECTOR_PART1_ARCHITECTURE_REPORT.md
```

**Modified:**

```
app-v2/src/features/import/models/source-config.ts
app-v2/src/features/connectors/contracts/connector-context.ts
```

**Not modified:** Connector framework internals, Source service, Import orchestrator, Admin CMS, database schema.

---

## Validation

| Check | Result |
|-------|--------|
| No HTTP implementation | ✓ |
| No fetching | ✓ |
| No parsing | ✓ |
| No event extraction | ✓ |
| No framework redesign | ✓ |
| Endpoint model reusable | ✓ |
| Tests | PASS |

---

## Acceptance Criteria

- ✓ Reusable Endpoint architecture for Website, RSS, API, Ticket Platform, Social, and future connectors
- ✓ Fits ER-013 Connector Framework without redesign
- ✓ Clear responsibility separation (Source / Endpoint / Connector / Context)
- ✓ HTTP abstraction designed, not implemented

---

## Deferred (Part 2+)

- HTTP client implementation
- Website Connector registration and class
- HTML fetch and parse
- Endpoint Admin CMS CRUD
- Execution engine integration
- `source_endpoints` database table (if needed)
