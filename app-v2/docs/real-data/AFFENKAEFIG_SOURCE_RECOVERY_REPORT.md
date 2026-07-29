# Affenkäfig Source Recovery Report

Sprint 28.1 — Eternal Rave  
Date: 2026-07-29

## Problem

Sprint 28 assumed `https://affenkaefig.de/events/` as the official source. Live checks returned only *„Diese Domain ist unkonfiguriert.“* with no events or JSON-LD.

## Domains investigated

| Domain / URL | Evidence | Decision |
|--------------|----------|----------|
| `affenkaefig.de` | Parking page, no events | **Rejected** |
| `affenkaefig.de/events/` | Same parking page | **Rejected** |
| `affenkaefig.info` | Active site, tickets, events, WooCommerce | **Official source** |
| `affenkaefig.info/tickets/` | 8 linked future events | **Event list URL** |
| `affenkaefig.info/event/{slug}/` | JSON-LD `Event`, venue, image | **Canonical detail URL** |
| `affenkaefig.info/produkt/...` | 301 → `/event/...` | Alias only |
| `affenkaefig.info/produkt-kategorie/event-tickets/` | 4 WooCommerce products (subset) | Not used as primary list |
| `affenkaefig.info/wp-json/wp/v2/ecm_event` | 10 posts, stable IDs | Alternate discovery (not primary) |

## Technical structure

```
affenkaefig.info (WordPress + WooCommerce + ecm_event CPT)
├── /tickets/                    → HTML list with /event/ links (no event JSON-LD)
├── /event/{slug}/               → Canonical event + Rank Math JSON-LD Event
├── /produkt/{slug}/             → Redirects to /event/{slug}/
└── /wp-json/wp/v2/ecm_event     → REST metadata (id, slug, link)
```

### Sample event JSON-LD (14 Jahre Affenkäfig)

- `@type`: `Event`
- `url`: `https://affenkaefig.info/event/14-jahreaffenkafig19-09-2026/`
- `startDate`: `2026-09-19T00:00:00+02:00`
- `location.name`: `Essigfabrik / Elektroküche`
- `image`: event-specific flyer (`19.09.26_QUADA_LineUP_AK_WEB.jpg`)

## Parser strategy

| Layer | Strategy |
|-------|----------|
| List discovery | `event_detail_page` — extract `/event/` links from `/tickets/` |
| Detail extraction | `json_ld` via new generic `detailStrategy` support |
| External ID | Canonical event URL (`json_ld.url`) |
| ticketUrl | Same as canonical URL (`ticketUrlFallback: eventUrl`) |

No Affenkäfig-specific parser code — configuration + generic `detailStrategy: json_ld` only.

## External ID stability

| Change type | ID stable? |
|-------------|------------|
| Title edit | ✅ (URL slug unchanged) |
| Description edit | ✅ |
| Image swap | ✅ |
| Ticket price change | ✅ |
| Slug/URL change | ❌ (new event — expected) |

WordPress post ID (`ecm_event` e.g. `196303`) is stable but not used as primary external ID to align with public canonical URLs.

## Images

- Event pages ship individual flyers in `wp-content/uploads/2026/...`
- Generic logos (`affenkaefig-logo`, homepage `party1.jpg`) excluded from event extraction path

## Line-up / timetable

- Not present in JSON-LD on sampled events
- UI placeholder path remains valid
- HTML line-up extraction is a future enhancement

## Code changes

| File | Change |
|------|--------|
| `affenkaefig-source.ts` | Domain → `.info`, `event_detail_page` config |
| `html-strategies.ts` | Generic `detailStrategy: json_ld` on detail pages |
| `20260761000000_sprint281_affenkaefig_live_domain.sql` | DB config update, still disabled |
| Live smoke test | Asserts 8+ parsed live events |

## Risks

| Risk | Classification |
|------|----------------|
| Detail fetch latency (8+ HTTP calls) | Non-blocking |
| Bootshaus overlap event 23.10.2026 | Non-blocking — review required |
| Midnight `startDate` without doors | Non-blocking — trust field completeness |
| affenkaefig.de confusion | Non-blocking — documented |

## Decision

**`affenkaefig.info` is the verified official source.**  
`affenkaefig.de` is deprecated/unconfigured and must not be used.

Source remains disabled until controlled staging import.
