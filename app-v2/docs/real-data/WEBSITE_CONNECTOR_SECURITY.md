# Website Connector Security

Sicherheitsgrenzen für den Website Fetch Layer und alle URL-basierten Operationen (Fetch, Detailseiten, Paginierung).

## Protokoll- und Host-Schutz

| Regel | Implementierung |
|-------|-----------------|
| Nur HTTP/HTTPS | `assertSafeImportUrl()` (bestehend) |
| Localhost blockieren | `localhost`, `127.0.0.1`, `::1` |
| Private Netze blockieren | IPv4/IPv6 private Ranges via Import-URL-Validator |
| Link-local blockieren | 169.254.x.x u. ä. |
| Cloud-Metadata blockieren | `169.254.169.254`, `fd00:ec2::254`, `100.100.100.200` |
| Interne Hostnamen | `*.local`, `*.internal`, `metadata.google.internal` |

Implementierung: `connectors/website/security.ts` + `import-fetch-service.ts`.

## Redirect-Sicherheit

- Redirect-Ziele werden über `assertSafeImportUrl` / `assertSafeWebsiteUrl` erneut validiert
- `maxRedirects: 3` (Default)
- Redirect-Kette in `WebsiteDocument.redirectChain` protokolliert

## Ressourcen-Limits

| Limit | Default | Konfigurierbar |
|-------|---------|----------------|
| Response-Größe | 5 MB | `limits.maxResponseBytes` |
| Timeout | 60 s | `limits.timeoutMs` |
| Pagination-Seiten | 5 | `limits.maxPaginationPages` |
| Detailseiten | 10 | `limits.maxDetailPages` |
| Events pro Lauf | 500 | `limits.maxEventsPerRun` |
| Seiten pro Lauf | 10 | `limits.maxPagesPerRun` |

## Domain-Kontrolle

`eventDetailPage.allowedDomains` schränkt Detailseiten-Fetch auf explizit erlaubte Domains ein. Ohne Konfiguration: gleiche Domain wie Basis-URL (implizit über relative Auflösung).

## Header und Logging

- Request-Header über `sanitizeFetchHeaders()` gefiltert
- Sensible Header (Authorization, Cookie, …) werden nicht gespeichert
- `WebsiteDocument.headers` enthält nur sichere, gefilterte Werte

## HTML-Verarbeitung

- HTML wird **niemals ausgeführt**
- Keine Script-Evaluation
- Kein Headless Browser / Puppeteer / Playwright
- Parsing über statische Regex-/String-Analyse und bestehenden JSON-LD-Parser

## Test-Fixtures

Tests dürfen keine echten Internetverbindungen benötigen:

- `htmlOverride` / `sourceConfig.reference.html` für deterministische Inhalte
- Fixture-URLs verwenden `events.example.com` (RFC 2606), **nicht** `.local` (SSRF-blockiert)

## Fehlerbehandlung

`WebsiteFetchError` mit typisierten Codes:

- `invalid_url`, `timeout`, `network_error`, `response_too_large`, `unsupported_content_type`

Einzelne Detailseiten- oder Extraktionsfehler brechen den Gesamtimport nicht ab.

## Bekannte Grenzen

- DNS-Rebinding bei Redirects: Schutz über URL-Validator pro Hop; kein separates DNS-Pinning
- JavaScript-rendered Seiten werden erkannt (Blocker), aber nicht gerendert
- Kein Certificate-Pinning über Standard-Fetch hinaus
