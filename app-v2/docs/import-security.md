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

Import tables and sources remain admin-only via RLS (`is_admin()`). Sprint 12D extends role-based access:

| Role | Capabilities |
|------|-------------|
| `viewer` | Read sources, jobs, records, logs, audit |
| `editor` | Edit records (no final review decision) |
| `reviewer` | Edit, approve, reject, duplicate |
| `source_manager` | Manage sources, test, start imports |
| `admin` / `owner` | Full access |

Role is read from JWT `app_metadata.role`. Local dev admin (`admin@eternalrave.app`) maps to `owner`.

Permission checks occur in `ImportOperationsService` and `ImportReviewService` via `assertPermission()`. UI button visibility is not a security boundary.

## Audit Logging (Sprint 12D)

`import_audit_logs` records:

- Source created/updated/activated/deactivated/tested
- Import manually started
- Record edited/approved/rejected/marked duplicate

Audit entries store actor ID, action, entity type/ID, and safe summary. No secrets or full raw payloads.

## Concurrency Protection (Sprint 12D)

Review actions use optimistic locking on `import_records.updated_at`. Conflicts return `IMPORT_CONCURRENCY_CONFLICT`.

Active import jobs per source are limited to one (`pending` or `running`) via unique partial index.

## Service Role

No service role keys in client code. All admin operations use authenticated user sessions with RLS.

## Network Architecture

```
Adapter → ImportFetchService → fetch (HTTP GET only)
```

Direct `fetch()` calls outside `ImportFetchService` are prohibited for import adapters. Enforced by code review and architecture — all Sprint 12B adapters use the central service.
