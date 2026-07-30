# Ticket.io — Acquisition Contract (Read-Only Analysis)

**Sprint:** 30 — Analysis only, no implementation  
**Analyzed:** 2026-07-30  
**Method:** Public HTTP fetch, Bootshaus production cross-reference

---

## Platform Overview

ticket.io is a German white-label ticketing SaaS. Each organizer receives a dedicated shop subdomain. Eternal Rave already references ticket.io indirectly: Bootshaus events link to `bootshaus-club.ticket.io`, and Affenkäfig's Bootshaus co-event uses `bootshaus-club.ticket.io/B3jK8aPC/`.

---

## URL Topology

| Pattern | Example | Role |
|---------|---------|------|
| Marketing site | `https://www.ticket.io/` | WordPress marketing (not event data) |
| Organizer shop index | `https://{shop}.ticket.io/` | List discovery |
| Alternate shop host | `https://{shop}-club.ticket.io/` | Bootshaus uses this variant |
| Event detail | `https://{shop}.ticket.io/{eventId}/` | Detail discovery |
| Short event ID | `B3jK8aPC`, `c14rzpcg` | Opaque slug, not sequential |

**Bootshaus live shop:** `https://bootshaus-club.ticket.io/`  
**Affenkäfig on Bootshaus:** `AFFENKÄFIG RULES // BOOTSHAUS KÖLN` listed on shop index (2026-10-23)

---

## List Discovery

### Observed Structure (bootshaus-club.ticket.io)

- HTML table/list of upcoming events
- Per row: title, date (`Sa. 01.08.2026`), time, location, price from (`ab X,XX Euro`)
- CTA links to detail pages (not exposed in markdown fetch; inferred from table structure)
- **No pagination observed** on shop index (single scrollable list)
- Events span months ahead (verified through Jan 2027)

### List Discovery Contract

```yaml
listDiscovery:
  strategy: html_selector | embedded_json
  entryUrl: "https://{shopSlug}.ticket.io/"
  itemSelector: "table row | .event-row (TBD via HTML inspection)"
  fields:
    title: text
    date: localized German date
    time: localized time
    venueLabel: location_on field
    priceFrom: confirmation_number field
    detailUrl: href on row/CTA
  pagination:
    type: none | cursor (unknown)
    nextPageSelector: null
```

---

## Detail Discovery

### Observed (public samples + search results)

- Event title in `<h1>`
- Date/time in German locale
- Venue address block (street, PLZ, city, country)
- Ticket tiers table: phase name, date, quantity selector, unit price
- Legal disclaimer: ticket.io is **not** the organizer; issuer named explicitly
- Organizer block: e.g. `Bootshaus Cologne GmbH, Auenweg 173, 51063 Köln`

### Detail Fetch Risk

Direct fetch of `https://bootshaus-club.ticket.io/B3jK8aPC/` returned **403 Forbidden** from automated client. Production connector must:

- Use realistic User-Agent and rate limiting
- Respect robots.txt (currently permissive on www.ticket.io)
- Consider headless fetch only if HTML parsing required

### JSON-LD

- ticket.io marketing site uses WordPress/Yoast (sitemap present)
- Event shop pages: **JSON-LD not confirmed** in automated fetch (403 blocked detail inspection)
- ticket.io backstage offers integration snippets (per their marketing) — likely optional Event schema for organizers
- **Contract assumption:** primary strategy `html_selector` on shop pages; `json_ld` as optional enhancement when present

---

## Canonical URLs

| Field | Canonical |
|-------|-----------|
| `externalId` | Full detail URL OR `{shopSlug}/{eventId}` |
| `eventUrl` | `https://{shop}.ticket.io/{eventId}/` |
| `ticketUrl` | Same as eventUrl (shop IS checkout) |
| `originalLink` | Same |

Normalize: strip query params, enforce trailing slash policy per platform.

---

## Images

- Not visible on list fetch (text-only markdown)
- Detail pages likely include poster/banner (TBD in implementation phase)
- Fallback: inherit from official website source via multi-source merge

---

## Organizer & Venue

| Field | Source on Page |
|-------|------------------|
| `organizerName` | Legal disclaimer block |
| `venueName` | `location_on` / address section |
| `venueAddress` | Street + PLZ + city |
| `cityName` | Parsed from address |

---

## Ticket Information

| Field | Availability |
|-------|--------------|
| `priceAmount` | Per-tier minimum ("ab X Euro") |
| `priceCurrency` | EUR (implicit) |
| `ticketUrl` | Shop URL |
| Availability | Quantity selectors imply stock state |
| Phases | Multiple tiers (Early Bird, Phase 1, Locker add-ons) |

---

## Timezone

- Dates shown in German local time (CET/CEST)
- Contract: normalize to `Europe/Berlin` (not `UTC+02:00` offset strings)

---

## External IDs

| ID Type | Example | Stability |
|---------|---------|-----------|
| Event slug | `B3jK8aPC` | Stable per event |
| Shop slug | `bootshaus-club` | Stable per organizer |
| Full URL | Best for `externalId` | Stable |

---

## Robots & Rate Limits

**www.ticket.io/robots.txt:**

```
User-agent: *
Disallow: /wp/wp-admin/
Allow: /wp/wp-admin/admin-ajax.php
Sitemap: https://www.ticket.io/sitemap_index.xml
```

Shop subdomains (`*.ticket.io`): no separate robots.txt observed; treat as crawl-friendly with conservative rate limits.

**Recommended limits:**

| Parameter | Value |
|-----------|-------|
| Requests/minute | 10–20 per shop |
| Concurrent detail fetches | 2–3 |
| Backoff on 403/429 | Exponential, max 15 min |

---

## Acquisition Contract (Machine-Readable Sketch)

```yaml
platform: ticket_io
version: 1
detection:
  hostPatterns:
    - "^[a-z0-9-]+\\.ticket\\.io$"
    - "^[a-z0-9-]+-club\\.ticket\\.io$"
  pathPatterns:
    - "^/[A-Za-z0-9]+/?$"

listDiscovery:
  type: shop_index
  urlTemplate: "https://{shopSlug}.ticket.io/"
  parser: html_selector

detailDiscovery:
  urlTemplate: "https://{shopSlug}.ticket.io/{eventId}/"
  parser: html_selector
  fallbackParser: json_ld

normalization:
  timezoneDefault: Europe/Berlin
  externalIdStrategy: canonical_url
  ticketUrlStrategy: same_as_event_url

trust:
  defaultScore: 70
  publishMode: manual_review
  ownershipType: partner

matching:
  preferKeys:
    - url:ticketUrl
    - day-venue
    - external
```

---

## Eternal Rave Cross-Reference

| Affenkäfig Event | ticket.io Presence |
|------------------|-------------------|
| AFFENKÄFIG RULES @ Bootshaus (2026-10-23) | Listed on `bootshaus-club.ticket.io` shop index |
| Other Affenkäfig events | Not on Bootshaus shop; separate organizer shops unknown |

Ticket.io would **not** discover most Affenkäfig events unless a dedicated Affenkäfig shop exists. Bootshaus co-events would match via `day-venue` + title similarity.

---

## Implementation Notes (Future)

1. Register source with `sourceType: ticket_platform`, `category: ticket_platform`
2. `sourceConfig.platform: ticket_io`, `shopSlug: bootshaus-club`
3. Do **not** hardcode Bootshaus — use admin-registered shop slug
4. Implement generic `ticket_platform` connector with platform adapter pattern
