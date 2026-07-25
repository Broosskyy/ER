# Website Connector — Architecture Notes

**Epic:** ER-014 Part 2  
**Scope:** First production connector. HTTP transport and raw HTML acquisition only.

## Position in the stack

```
Source (ER-012)
  ↓
Endpoint (website — ER-014 Part 1)
  ↓
Website Connector (ER-014 Part 2)
  ↓
HttpClient (DefaultHttpClient)
  ↓
AcquisitionCandidate (raw HTML)
  ↓
Review → Approval → Event (existing import pipeline)
```

The Website Connector owns **transport and raw acquisition only**. It does not parse HTML, normalize payloads, detect duplicates, create Events, or publish content.

## Explicit responsibilities

| Owns | Does not own |
|------|--------------|
| Endpoint validation (website type, connectorKey, URL, enabled, config) | HTML parsing, DOM inspection, link extraction |
| HTTP GET via `HttpClient` | Event extraction, normalization |
| HTTP response validation (status, content-type) | Duplicate detection, review, publishing |
| Raw HTML acquisition | Scheduler, worker, queue |
| One `AcquisitionCandidate` per successful request | Database writes |

## Execution flow

```
ConnectorFrameworkService.executeConnector()
  → WebsiteConnector.execute(context)
      1. validateWebsiteConnectorConfiguration(context)
      2. resolveWebsiteEndpoint(context)
      3. httpClient.request({ url, timeoutMs, headers, ... })
      4. build AcquisitionCandidate with raw HTML
      5. return ConnectorResult (success | failure)
```

### Logging events

Structured via `ConnectorContext.log()`:

| Code | Level | When |
|------|-------|------|
| `WEBSITE_EXECUTE_START` | info | Execution begins |
| `WEBSITE_VALIDATION_FAILED` | warning / error | Endpoint or config validation fails |
| `WEBSITE_REQUEST_START` | info | HTTP request dispatched |
| `WEBSITE_RESPONSE_RECEIVED` | info | Valid HTTP response received |
| `WEBSITE_TRANSPORT_FAILED` | error | Network, timeout, or HTTP error |
| `WEBSITE_EXECUTE_COMPLETE` | info | Successful completion |

No `console.log` usage.

## Endpoint validation

Before any HTTP request, `validateWebsiteConnectorConfiguration()` checks:

- Endpoint reference present (`context.endpoint.id`)
- URL present and valid (`http` / `https` only)
- Endpoint type is `website`
- `connectorKey` matches `website`
- Endpoint is enabled
- Timeout configuration is positive and finite
- `requiresJavaScriptRendering` is not enabled (unsupported in Part 2)

Validation errors return through `ConnectorValidationResult` and map to `ConnectorErrorDetail` with category `configuration`.

## HTTP transport

`WebsiteConnector` uses the injected `HttpClient` abstraction — it never calls `fetch` directly.

`DefaultHttpClient` (`features/endpoints/http/default-http-client.ts`):

| Capability | Behaviour |
|------------|-----------|
| Methods | `GET`, `HEAD` |
| Timeout | `AbortController` + `timeoutMs` from resolved endpoint |
| Redirects | Manual follow; `followRedirects` + `maxRedirects` from endpoint config |
| Redirect safety | Loop detection via visited URL set; max redirect count enforced |
| Status codes | Accepts `200` only; rejects `4xx` and `5xx` |
| Content types | Validates against `acceptedContentTypes` before returning body |
| Headers | Request headers forwarded; response headers captured |

**Not implemented:** retries, caching, cookies, authentication, browser automation.

### Supported content types

- `text/html` (primary)
- `application/xhtml+xml` (optional)

All other content types are rejected with `HTTP_CONTENT_TYPE`.

## AcquisitionCandidate output

Exactly **one** candidate per successful request:

```typescript
{
  externalId: endpointId,
  sourceUrl: response.finalUrl,
  rawPayload: {
    html: response.body,        // opaque — not inspected
    contentType: response.contentType,
    status: response.status,
  },
  metadata: {
    endpointId, sourceId, connectorKey,
    request: { url, method, timeoutMs, followRedirects, maxRedirects },
    response: { status, contentType, contentLength, finalUrl, durationMs },
    retrievedAt: ISO timestamp,
  },
}
```

`normalizedPayload` is **not** populated. No Events are created.

## Diagnostics

`ConnectorResult.diagnostics` includes transport metadata only:

- `httpStatus`
- `contentType`
- `contentLength`
- `finalUrl`
- `requestDurationMs`

No parsing diagnostics.

## Error mapping

| Failure | HttpClient code | Connector category |
|---------|-----------------|-------------------|
| Invalid URL | `HTTP_INVALID_URL` | `configuration` |
| Unsupported content type | `HTTP_CONTENT_TYPE` | `configuration` |
| HTTP 4xx / 5xx | `HTTP_STATUS` | `connectivity` |
| Redirect loop / limit | `HTTP_REDIRECT_LIMIT` | `connectivity` |
| Network failure | `HTTP_NETWORK` | `connectivity` |
| Timeout | `HTTP_TIMEOUT` | `timeout` |

Mapping via `mapHttpClientErrorToConnectorDetail()`.

## Registration

Registered in `features/connectors/register-connectors.ts` and executed via `ConnectorExecutionEngine` (ER-014 Part 3).

```typescript
registry.register({
  connectorKey: 'website',
  displayName: 'Website Connector',
  version: '1.0.0',
  supportedEndpointTypes: ['website'],
  create: () => new WebsiteConnector(sharedHttpClient),
});
```

Bootstrap hook: `registerConnectors(connectorRegistry)` in `data/repositories/registry.ts`.

## Configuration

Website endpoint config (`WebsiteEndpointConfig`):

| Field | Default | Purpose |
|-------|---------|---------|
| `userAgent` | `EternalRave-WebsiteConnector/1.0` | Request User-Agent header |
| `followRedirects` | `true` | Enable redirect following |
| `maxRedirects` | `5` | Maximum redirect hops |
| `acceptedContentTypes` | `text/html`, `application/xhtml+xml` | Allowed response types |
| `requiresJavaScriptRendering` | — | Rejected in Part 2 |

Timeout resolves from connector framework settings (`defaultTimeoutMs`) until per-endpoint timeout is added.

## Known limitations

- No retries or backoff
- No caching or conditional requests
- No cookies or session management
- No authentication (Basic, Bearer, OAuth)
- No JavaScript rendering (SPAs requiring JS execution are unsupported)
- No pagination or incremental sync
- No real network requests in tests (mocked `HttpClient` / `fetch`)
- Timeout not yet configurable per endpoint (uses framework default)

## Tests

| Suite | Coverage |
|-------|----------|
| `default-http-client.test.ts` | GET success, 4xx/5xx, content-type, redirects, redirect loops, timeout, invalid URL |
| `website-connector.test.ts` | Validation, execution, candidate shape, error mapping, logging, diagnostics, HttpClient options |

All tests use mocked transport — no real HTTP.

## Related documentation

- `app-v2/docs/connector-framework.md` — ER-013 framework
- `app-v2/docs/endpoints-domain.md` — ER-014 endpoint model
- `docs/ER-014_PART2_WEBSITE_CONNECTOR_COMPLETION_REPORT.md` — completion report
