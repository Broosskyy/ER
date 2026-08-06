# Platform Access Investigation — Resident Advisor and Raves of Germany

Date: 2026-08-01  
Scope: read-only technical and operational investigation. No accounts, automated bypasses, sources, connectors, or production records were created.

## Decision

Both platforms require an official API, feed, or written partnership before Eternal Rave can ingest and republish event data.

Resident Advisor is the preferred future integration candidate if written access is obtained because it has broader Germany and Europe coverage, stable-looking numeric event/venue/promoter URL identifiers, and materially stronger lineup and genre value. This is not authorization to implement a connector.

## Resident Advisor

Evidence:

- [robots.txt](https://ra.co/robots.txt) restricts multiple protected routes and named automated bots.
- [Terms, section 4.4](https://ra.co/terms) prohibit automated commercial extraction and unauthorized bots, spiders, crawlers, and scrapers without a written agreement.
- Germany listing pattern: `https://ra.co/events/de/{city}`; example [Berlin club listings](https://ra.co/events/de/berlin/club).
- Detail, venue, and promoter patterns expose numeric identifiers: `/events/{id}`, `/clubs/{id}`, `/promoters/{id}`.
- [RA submission guidance](https://support.ra.co/article/12-submitting-events) documents public-event workflows but no data API.
- [RA ticket widget documentation](https://support.ra.co/article/7-ticket-widget) supports a promoter's own widget, not platform-wide data ingestion.

Technical result:

- Direct automated reads encountered Cloudflare blocking. No bypass was attempted.
- Listings are dynamic/infinite-scroll; no documented pagination, public event API, supported JSON-LD contract, rate limit, or change feed was found.
- Public pages can expose title, date, venue, lineup, descriptions, genres, media, price and ticket information, but completeness is not guaranteed.

Recommendation: **official API/partnership required**.

Partnership request requirements: Germany/Europe discovery rights, a documented API/feed, field and media license, stable ID guarantee, attribution, rate limits, update/deletion semantics, and cancellation handling.

## Raves of Germany

Evidence:

- [robots.txt](https://www.ravesofgermany.com/robots.txt) allows ordinary crawl paths but this is not a content or automation license.
- [Terms](https://www.ravesofgermany.com/terms) limit downloads to personal, non-commercial use and reserve copying, distribution, and derivative rights.
- Public event URLs follow `/event/{opaque-id}+{slug}`; example [event page](https://www.ravesofgermany.com/event/UCfyTZQNUV2JEiftWM35D+unreal-x-sesh-rso-berlin-valley).
- The public home listing is client-rendered and returns a loading shell to a static request.
- [Imprint](https://www.ravesofgermany.com/imprint) identifies a partnership contact.

Technical result:

- No documented API/feed, pagination/load-more contract, schema, ID-stability guarantee, rate limit, or structured-data contract was found.
- Event-detail field coverage could not be safely verified from the static response.
- Explicit URL onboarding is technically plausible but still requires rights to extract, store, and republish data.

Recommendation: **official API/partnership required**.

## Comparative next-step

Do not implement either connector now. Seek authorization from Resident Advisor first. If RA supplies a documented, licensed API/feed, implement it as an enrichment-capable `SourceModule` using the shared CanonicalImportEvent pipeline. Otherwise, retain both platform registry entries as non-production placeholders and do not crawl them.
