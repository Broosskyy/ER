# Source Onboarding Security

## SSRF protection

All submitted URLs pass through `normalizeSubmittedSourceUrl()` which delegates to `assertSafeImportUrl()` (shared with import fetch).

### Blocked

- `localhost` and loopback
- Private IP ranges (RFC1918, link-local, etc.)
- Non-HTTP(S) protocols (`file://`, `ftp://`, etc.)
- Cloud metadata endpoints

## Redirect policy

Discovery fetch (`fetchDiscoveryDocument`) validates **each redirect target** with `assertSafeImportUrl()` (SSRF re-check per hop). Maximum redirects: 5.

## HTTPS preference

HTTP URLs are normalized to HTTPS when safe.

## Config safety

- Declarative configs are JSON only — `validateDeclarativeSourceConfig` rejects patterns suggesting executable code.
- No `eval`, no function strings in stored configuration.

## Admin authorization

`SourceOnboardingService.discoverFromUrl` requires `canManageSources(role)`.

## Duplicate sources

Known hostnames (from existing `sources.baseUrl`) short-circuit to `review_required` without fetching.

## Known limits

Discovery performs a single-page probe for the wizard; full crawl and credential flows are out of scope for Sprint 33.
