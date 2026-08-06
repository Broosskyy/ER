# TicketKings — Acquisition Contract (Read-Only Analysis)

> **⚠️ DEPRECATED (2026-07-30):** Ticket Kings is no longer a strategic data source for Eternal Rave. Affenkäfig events are fully covered via the official website source. This document is retained as historical technical reference. See [TICKET_KINGS_DEPRECATION_PLAN.md](./TICKET_KINGS_DEPRECATION_PLAN.md).

**Sprint:** 30 — Analysis only, no implementation  
**Analyzed:** 2026-07-30  
**Domain:** `ticketkings.de` (not `ticket-king.de` — latter returns 500)

---

## Platform Overview

TicketKings (`ticketkings.de`) is a German ticket shop / promoter platform built on **WordPress + The Events Calendar (Tribe Events)**. Affenkäfig uses TicketKings as its primary ticket vendor — all Affenkäfig live events link to `ticketkings.de/event/{slug}/`.

---

## URL Topology

| Pattern | Example | Role |
|---------|---------|------|
| Home | `https://ticketkings.de/` | Marketing + coming events teaser |
| Event list | `https://ticketkings.de/events/` | List discovery |
| Category list | `https://ticketkings.de/events/kategorie/{cat}/` | Filtered discovery |
| Event detail | `https://ticketkings.de/event/{slug}/` | Detail + embedded checkout |
| iCal feed | `webcal://ticketkings.de/?post_type=tribe_events&ical=1` | Calendar export |
| Embedded checkout | `https://nacht-manager.de/ticketing/native_event.php?id={n}` | iframe widget |

---

## List Discovery

### Observed Structure (`/events/`)

- WordPress Tribe Events list view
- Grouped by month headers (`### August 2026`)
- Per event: title, date, location, lineup text, price range
- "Mehr laden" / pagination via list views
- Category taxonomy: `club`, `sold-out-warteliste`, etc.

### List Discovery Contract

```yaml
listDiscovery:
  strategy: html_selector | ical_feed
  entryUrls:
    - "https://ticketkings.de/events/"
    - "https://ticketkings.de/events/kategorie/{category}/"
  itemSelector: ".tribe-events-calendar-list__event-row (TBD)"
  fields:
    title: heading link text
    date: tribe event date meta
    venueLabel: location string
    priceRange: ticket price text
    detailUrl: event permalink
  pagination:
    type: tribe_list_pagination
    nextSelector: ".tribe-events-c-nav__next"
  alternateFeed:
    type: ical
    url: "webcal://ticketkings.de/?post_type=tribe_events&ical=1"
```

---

## Detail Discovery

### Observed Structure (sample: `testeventflo`, Affenkäfig organizer block)

| Section | Content |
|---------|---------|
| Title | Event name |
| Date | `Beginn: 19 Apr. 2025 @ 22:00 CEST` |
| End | `Ende: 20 Apr. 2025 @ 06:00 CEST` |
| Entry | Price / "Kostenlos" |
| Category | Tribe taxonomy |
| Website | External organizer URL |
| Venue | Name, address, Google Maps embed |
| Organizer | Name, email, website link |
| Tickets | Embedded Night Manager iframe |
| Calendar export | Google Calendar, iCal, Outlook |

### Embedded Checkout (Night Manager)

TicketKings embeds `nacht-manager.de` ticketing widgets:

```javascript
widgetBaseSrc: "https://nacht-manager.de/ticketing/native_event.php?id=30&embed=1&..."
```

**Implication:** `externalId` should prefer TicketKings event URL; store `nacht-manager` numeric ID in `sourceMetadata.checkoutProviderId` for price/availability enrichment.

---

## JSON-LD

- WordPress/Yoast sitemap present
- Tribe Events may emit Event schema on detail pages (not confirmed in blocked fetch)
- **Primary strategy:** HTML parsing of Tribe markup + optional iCal for dates

---

## Canonical URLs

| Field | Canonical |
|-------|-----------|
| `externalId` | `https://ticketkings.de/event/{slug}/` |
| `eventUrl` | Same |
| `ticketUrl` | Same (checkout embedded on page) |
| Slug stability | Date-based slugs e.g. `sommerfest-elektrokueche-20-06-2026` |

**Slug drift risk:** Affenkäfig website slug (`sommerfest-elektrokueche-08-08-2026`) differs from TicketKings slug (`sommerfest-elektrokueche-20-06-2026`). URL matching alone is insufficient — use `day-venue` + title keys.

---

## Images

- Event posters on list cards (observed in Affenkäfig import: images from affenkaefig.info, not ticketkings)
- TicketKings detail pages may have featured image (TBD)
- Enrichment: prefer official website image via multi-source merge

---

## Organizer & Venue

| Field | Example (Affenkäfig test event) |
|-------|-------------------------------|
| `organizerName` | Affenkäfig |
| `organizerEmail` | kontakt@affenkaefig.info |
| `venueName` | Artheater / Essigfabrik |
| `venueAddress` | Ehrenfeldgürtel 127, 50823 Köln |

---

## Ticket Information

| Field | Availability |
|-------|--------------|
| Price range | On list (`17,50€ – 24,00€`) |
| Sold out | Category `sold-out-warteliste`, page text |
| Checkout | Night Manager embed |
| Currency | EUR |

---

## Timezone

- Explicit `CEST` / `CET` in detail blocks
- Contract: normalize to `Europe/Berlin`

---

## External IDs

| ID Type | Example | Notes |
|---------|---------|-------|
| URL slug | `mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition` | Primary |
| Tribe post ID | WordPress internal | In HTML/RSS |
| Night Manager ID | `30`, `31` | Checkout only |

---

## Robots & Rate Limits

**ticketkings.de/robots.txt:**

```
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Sitemap: https://ticketkings.de/sitemap_index.xml
```

**Recommended limits:**

| Parameter | Value |
|-----------|-------|
| Requests/minute | 15 |
| iCal poll interval | 6–12 hours |
| Detail concurrency | 3 |

---

## Acquisition Contract (Machine-Readable Sketch)

```yaml
platform: ticket_king
version: 1
detection:
  hostPatterns:
    - "^ticketkings\\.de$"
    - "^www\\.ticketkings\\.de$"
  frameworkSignals:
    - "tribe_events"
    - "nacht-manager.de/ticketing"

listDiscovery:
  type: tribe_events_list
  urlTemplate: "https://ticketkings.de/events/"
  parser: html_selector
  alternateFeed:
    type: ical
    url: "https://ticketkings.de/?post_type=tribe_events&ical=1"

detailDiscovery:
  urlTemplate: "https://ticketkings.de/event/{slug}/"
  parser: html_selector
  embeddedCheckout:
    provider: nacht_manager
    idPattern: "native_event.php?id={id}"

normalization:
  timezoneDefault: Europe/Berlin
  externalIdStrategy: canonical_url

trust:
  defaultScore: 68
  publishMode: manual_review
  ownershipType: partner

matching:
  preferKeys:
    - url:ticketUrl
    - day-venue
    - title-city
```

---

## Eternal Rave Cross-Reference (Affenkäfig)

All Affenkäfig published events already reference TicketKings URLs in `ticketUrl`:

| Affenkäfig Event | TicketKings URL |
|------------------|-----------------|
| Sommerfest Elektroküche | `ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/` |
| MDMA F2F & B2B | `ticketkings.de/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/` |
| Underland Essigfabrik | `ticketkings.de/event/underland-essigfabrik-05-09-2026/` |
| MDMA 10.10.2026 | `ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/` |
| AFFENKÄFIG RULES @ Bootshaus | `bootshaus-club.ticket.io/B3jK8aPC/` (ticket.io, not TicketKings) |

TicketKings would discover **most Affenkäfig events** via organizer's shop. Cross-match to `affenkaefig.info` via `day-venue` + title (duplicate_score ~94 observed in production).
