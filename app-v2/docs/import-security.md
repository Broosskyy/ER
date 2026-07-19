# Import Security (Sprint 12B)

## SSRF Protection

`ImportFetchService.assertSafeImportUrl()` blocks:

| Category | Examples |
|---|---|
| Localhost | `localhost`, `*.localhost`, `127.0.0.0/8`, `0.0.0.0` |
| Private IPv4 | `10.x`, `192.168.x`, `172.16-31.x`, `169.254.x` |
| Private IPv6 | `fc00::/7`, `fe80::/10`, `::1` |
| Dangerous protocols | `file://`, `ftp://`, `data:`, `javascript:` |

Only `http:` and `https:` are permitted. Redirect targets are re-validated (max 3 redirects).

## Response Limits

| Setting | Default | Config key |
|---|---|---|
| Max response size | 5 MB | `importConfig.maxResponseBytes` |
| Timeout | 60 s | `importConfig.timeoutMs` |
| Max redirects | 3 | `importConfig.maxRedirects` |
| Retry attempts | 2 | `importConfig.retryCount` |

## Secret Management

- API keys **never** stored in `source_config` or database fields
- Header values resolved from `IMPORT_API_HEADER_*` environment variables
- `sanitizeFetchHeaders()` strips Authorization, Cookie, API key headers from outbound logs
- `ImportLoggingService` redacts patterns matching api_key, password, token, secret

## Logging Rules

Never log:

- Authorization headers
- Cookies
- API keys / tokens
- Full response bodies

Safe to log:

- URL (without credentials)
- HTTP status
- Content-Type
- Byte count
- Structured error codes

## Content Safety

- JSON-LD: only `application/ld+json` script blocks parsed — no HTML execution
- XML: parsed via `fast-xml-parser` — no XPath/JS from config
- CSV: no formula execution — prefix sanitization for export safety
- No `eval`, `new Function`, or dynamic scripting anywhere in import pipeline

## Access Control

Import tables and sources remain admin-only via RLS (`is_admin()`). No service role keys in client code.

## Network Architecture

```
Adapter → ImportFetchService → fetch (HTTP GET only)
```

Direct `fetch()` calls outside `ImportFetchService` are prohibited for import adapters. Enforced by code review and architecture — all Sprint 12B adapters use the central service.
