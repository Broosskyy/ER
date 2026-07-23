# ER-014 — Website Connector — Part 2 Completion Report

**Epic:** ER-014 Website Connector (Part 2 — Website Connector Implementation)  
**Date:** 22 July 2026  
**Repository:** `C:/ER`

---

## Website Connector

Implemented `WebsiteConnector` (`features/connectors/providers/website/website-connector.ts`) extending `BaseConnector`.

| Property | Value |
|----------|-------|
| `connectorKey` | `website` |
| `displayName` | Website Connector |
| Capabilities | `supportsPolling: true`, `supportsPagination: false` |

**Execution pipeline:**

1. Validate endpoint configuration
2. Resolve full website endpoint from `context.source.sourceConfig.endpoints`
3. Issue HTTP GET via injected `HttpClient`
4. Build exactly one `AcquisitionCandidate` with opaque raw HTML
5. Return `ConnectorResult` with transport diagnostics

**Boundaries preserved:** No HTML parsing, DOM inspection, normalization, duplicate detection, Event creation, publishing, scheduler, worker, or queue.

Registered in `register-connectors.ts` and bootstrapped via `data/repositories/registry.ts`.

---

## HttpClient

Implemented `DefaultHttpClient` (`features/endpoints/http/default-http-client.ts`) fulfilling the ER-014 Part 1 `HttpClient` contract.

| Feature | Implementation |
|---------|----------------|
| Methods | GET, HEAD |
| Timeout | `AbortController` + configurable `timeoutMs` |
| Redirects | Manual follow (`redirect: 'manual'`); `followRedirects` + `maxRedirects` |
| Redirect safety | Visited URL set; loop detection; max count default 5 |
| Status codes | Accept `200` only; reject 4xx/5xx |
| Content types | Validate against `acceptedContentTypes` before returning body |
| Headers | Request headers forwarded; response headers captured as record |
| Response body | `text()` — treated as opaque string |

**Not implemented:** retries, caching, cookies, authentication, browser automation.

Supporting utilities in `http-client-utils.ts`: URL validation (`http`/`https`), content-type normalization, accepted-type matching.

---

## Validation

`validateWebsiteConnectorConfiguration()` (`website-connector-validation.ts`) runs before any HTTP request:

| Check | Error code |
|-------|------------|
| Endpoint reference required | `WEBSITE_ENDPOINT_REQUIRED` |
| URL required | `WEBSITE_URL_REQUIRED` |
| Endpoint type must be `website` | `WEBSITE_ENDPOINT_TYPE` |
| `connectorKey` must be `website` | `WEBSITE_CONNECTOR_KEY` |
| Endpoint must be enabled | `WEBSITE_ENDPOINT_DISABLED` |
| Valid http/https URL | `WEBSITE_URL_INVALID` |
| Positive finite timeout | `WEBSITE_TIMEOUT_INVALID` |
| JS rendering not supported | `WEBSITE_JS_RENDERING_UNSUPPORTED` |

`resolveWebsiteEndpoint()` merges `ConnectorContext.endpoint` with stored `AcquisitionEndpoint` config (user agent, redirects, content types).

---

## Transport

`WebsiteConnector` delegates all HTTP to the injected `HttpClient`. It never calls `fetch` directly.

Request options resolved from endpoint + framework settings:

- `url` — from endpoint
- `timeoutMs` — from `DEFAULT_CONNECTOR_FRAMEWORK_SETTINGS.defaultTimeoutMs`
- `followRedirects` / `maxRedirects` — from `WebsiteEndpointConfig` (defaults: true / 5)
- `acceptedContentTypes` — from config (defaults: `text/html`, `application/xhtml+xml`)
- `headers` — `User-Agent`, `Accept`

HTML is treated as opaque content. No inspection of body structure.

---

## Error Mapping

HTTP failures map through `HttpClientError` → `mapHttpClientErrorToConnectorDetail()`:

| Failure | Code | Category |
|---------|------|----------|
| Invalid URL | `HTTP_INVALID_URL` | `configuration` |
| Unsupported content type | `HTTP_CONTENT_TYPE` | `configuration` |
| HTTP 4xx / 5xx | `HTTP_STATUS` | `connectivity` |
| Redirect loop / limit | `HTTP_REDIRECT_LIMIT` | `connectivity` |
| Missing redirect location | `HTTP_STATUS` | `connectivity` |
| Network failure | `HTTP_NETWORK` | `connectivity` |
| Timeout | `HTTP_TIMEOUT` | `timeout` |

Validation failures map to `configuration` category via `ConnectorErrorDetail` in `createFailureResult()`.

---

## AcquisitionCandidate

Exactly **one** candidate per successful request:

```typescript
{
  externalId: endpointId,
  sourceUrl: response.finalUrl,
  rawPayload: { html, contentType, status },
  metadata: {
    endpointId, sourceId, connectorKey: 'website',
    request: { url, method, timeoutMs, followRedirects, maxRedirects },
    response: { status, contentType, contentLength, finalUrl, durationMs },
    retrievedAt: ISO timestamp,
  },
}
```

- `normalizedPayload` — not populated
- Events — not created
- HTML — stored verbatim in `rawPayload.html`

---

## Diagnostics

`ConnectorResult.diagnostics` (transport only):

| Field | Source |
|-------|--------|
| `httpStatus` | Response status |
| `contentType` | Normalized content-type header |
| `contentLength` | `response.body.length` |
| `finalUrl` | Post-redirect URL |
| `requestDurationMs` | HttpClient measured duration |

Failure diagnostics include `validationFailed`, `transportFailed`, and `url` where applicable.

---

## Logging

Structured logging via `ConnectorContext.log()`:

| Event | Level |
|-------|-------|
| `WEBSITE_EXECUTE_START` | info |
| `WEBSITE_VALIDATION_FAILED` | warning / error |
| `WEBSITE_REQUEST_START` | info |
| `WEBSITE_RESPONSE_RECEIVED` | info |
| `WEBSITE_TRANSPORT_FAILED` | error |
| `WEBSITE_EXECUTE_COMPLETE` | info |

No `console.log` usage.

---

## Tests

**519 tests PASS** (17 new tests for ER-014 Part 2).

| Suite | Tests | Coverage |
|-------|-------|----------|
| `default-http-client.test.ts` | 7 | GET success, 4xx, invalid content-type, redirects, redirect loop, timeout, invalid URL |
| `website-connector.test.ts` | 10 | Validation (enabled, URL, type, disabled, JS rendering), success candidate, transport errors, logging, HttpClient options, endpoint resolution |

All tests use mocked `fetch` / `HttpClient` — no real network requests.

---

## Documentation

| Document | Status |
|----------|--------|
| `app-v2/docs/website-connector.md` | **Created** — execution flow, validation, transport, limitations |
| `app-v2/docs/connector-framework.md` | **Updated** — Website Connector registered, HttpClient implemented |
| `app-v2/docs/endpoints-domain.md` | **Updated** — Part 2 flow, DefaultHttpClient, deferred items |
| `AI_CONTEXT.md` | **Updated** — Website Connector status, 519 tests |

---

## Files Changed

### New — Website Connector

| File | Purpose |
|------|---------|
| `features/connectors/providers/website/website-connector.ts` | Connector implementation |
| `features/connectors/providers/website/website-connector-validation.ts` | Endpoint validation + resolution |
| `features/connectors/providers/website/website-connector-constants.ts` | Keys and defaults |
| `features/connectors/providers/website/__tests__/website-connector.test.ts` | Connector tests |

### New — HttpClient

| File | Purpose |
|------|---------|
| `features/endpoints/http/default-http-client.ts` | DefaultHttpClient implementation |
| `features/endpoints/http/http-client-utils.ts` | URL and content-type utilities |
| `features/endpoints/http/__tests__/default-http-client.test.ts` | HttpClient tests |

### Modified

| File | Change |
|------|--------|
| `features/connectors/register-connectors.ts` | Register WebsiteConnector |
| `features/connectors/index.ts` | Export WebsiteConnector |
| `features/endpoints/index.ts` | Export DefaultHttpClient |
| `data/repositories/registry.ts` | Bootstrap registration (unchanged hook) |

### Documentation

| File | Change |
|------|--------|
| `app-v2/docs/website-connector.md` | New |
| `app-v2/docs/connector-framework.md` | Updated |
| `app-v2/docs/endpoints-domain.md` | Updated |
| `AI_CONTEXT.md` | Updated |

---

## Known Limitations

- No retries, caching, cookies, or authentication
- No JavaScript rendering (SPAs unsupported)
- No HTML parsing or event extraction
- No per-endpoint timeout (uses framework `defaultTimeoutMs`)
- No execution engine, scheduler, worker, or queue integration
- No Endpoint Admin CMS CRUD
- Cancellation prepared in `ConnectorContext.runtime` but not enforced
- Tests mock transport only — no integration tests against live websites

---

## Validation

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** |
| `npm test` (519 tests) | **PASS** |
| `npm run release:check` | **PASS** |
| No HTML parsing | **Confirmed** |
| No normalization | **Confirmed** |
| No event extraction | **Confirmed** |
| No duplicate detection | **Confirmed** |
| No publishing | **Confirmed** |
| No scheduler / worker / queue | **Confirmed** |
| No framework redesign | **Confirmed** |
| Website Connector registered | **Confirmed** (`connectorKey: website`) |

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Website Connector registered in Connector Framework | ✓ |
| HTML retrieved through HttpClient abstraction | ✓ |
| One successful request → exactly one AcquisitionCandidate | ✓ |
| Connector performs transport only | ✓ |
| No HTML parsing | ✓ |
| No event extraction | ✓ |
| No normalization | ✓ |
| No publishing | ✓ |
| No framework redesign | ✓ |

**ER-014 Part 2 is complete.**
