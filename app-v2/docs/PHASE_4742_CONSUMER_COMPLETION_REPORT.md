# Phase 4.7.4.2 — Consumer Completion Report

Generated: 2026-08-03T20:28:30.000Z

## Executive summary

Phase 4.7.4.2 closes the consumer gap between canonical ticket data and mobile/API presentation. Evidence-backed Ticket.io repairs were applied (Unreal Weekender prices, availability backfill, sold-out corrections). Consumer projection was extended for ticket badges, gallery activation from `flyer_url`, and a fullscreen flyer viewer on Event Detail.

## Before → after

| Metric | Before | After |
|---|---:|---:|
| Canonical/display price | 68 | **70** |
| Ticket badges projected | 36 | **89** |
| Explicit availability | 36 | **89** |
| Sold-out state | 0 | **2** |
| Gallery active | 93 | 93 |
| Consumer projection issues | 0 | **0** |

## Workstream A — Ticket.io price completion (APPLIED)

| Event | Evidence | After |
|---|---|---|
| Unreal Weekender Night II | `ab 45,00 €` list_overview_row | price + on_sale + phases |
| Unreal Weekender Night I | `ab 45,00 €` list_overview_row | price + on_sale + phases |

Pass 2: **0 mutations** (idempotent).

## Workstream B — Availability completion (APPLIED)

- **51** events received `ticket_status: on_sale` from explicit list JSON-LD / presale evidence
- Sold-out candidates excluded from availability pass (Moonbootica, Ship Vol. III)
- Palma shop-root events received `on_sale` from shop-level JSON-LD — availability only, no price fabrication

## Workstream C — Sold-out completion (APPLIED)

| Event | Before | After | Evidence |
|---|---|---|---|
| Bootshaus on a Ship Vol. III | external_link / available | **sold_out** | list JSON-LD sold-out |
| TECHNO DAMPFER Düsseldorf w/ Moonbootica | unknown | **sold_out** | list JSON-LD sold-out |

Palma shop-root sold-out signals remain **review_required** (shop-level JSON-LD, not event-specific).

## Workstream D — Badge projection (APPLIED — code only)

Representative validation — all show badges:

| Event | Price | Badge |
|---|---|---|
| Ship Vol. III | ab 32,00 € | sold_out |
| BC173 | ab 23,00 € | on_sale |
| Sommerfest | ab 11,90 € | available |
| MDMA | ab 34,90 € | available |
| Affenkäfig | ab 19,90 € | available |
| Proton Stuttgart | ab 10,00 € | available |

Changes: `ticket-badge-projection.ts`, extended `EventTicketStatus` (on_sale, presale, coming_soon, waitlist), canonical availability wired into `event-status-resolver.ts`.

## Workstream E — Phase verification

Structured `ticket_phases` preserved for all representative events (Ship Vol. III, BC173, Sommerfest, MDMA, Unreal Weekender I/II). No flattening applied.

## Workstream F — Flyer media experience (APPLIED — code)

`FlyerGalleryViewer` on Event Detail hero tap:

- Fullscreen modal
- Swipe gallery + pagination
- Double-tap zoom (scale levels 1×/2×/3×)
- Share + save/download
- Long-press action sheet

## Workstream G — Gallery activation (APPLIED — code)

- `flyerUrl` mapped to consumer `Event` type
- `buildConsumerGalleryImageUrls()` projects `flyer_url` + `image_url` without duplicates
- `galleryImageUrls` active on `EventDisplayModel`

Note: **0** events currently have distinct `flyer_url` ≠ `image_url` in production; projection path is ready when flyers diverge.

## Workstream H — Venue verification

Read-only re-run: no venue mutations. Representative events (Blacklist Festival, Mallorca shop-root, Ship events) unchanged.

## Domain safety

- Backup: `_phase4742_repair_backup.json`
- Forbidden fingerprints verified (lineup, URLs, venue, images, attributes unchanged)
- Repair pass 2: ticketio **0**, soldout **0** mutations
- Availability pass excludes sold-out repair IDs after fix

## Tests & validation

| Check | Result |
|---|---|
| `typecheck:app` | Pass |
| phase4742 consumer tests | Pass |
| `build:web` | Pending final run |

## Artifacts

- `docs/real-data/_phase4742_ticket_completion.json`
- `docs/real-data/_phase4742_availability_validation.json`
- `docs/real-data/_phase4742_soldout_validation.json`
- `docs/real-data/_phase4742_badge_validation.json`
- `docs/real-data/_phase4742_phase_validation.json`
- `docs/real-data/_phase4742_flyer_validation.json`
- `docs/real-data/_phase4742_gallery_validation.json`
- `docs/real-data/_phase4742_api_mobile_validation.json`
- `docs/real-data/_phase4742_before_after.json`
- `docs/real-data/_phase4742_repair_runs.json`

## Commands

```bash
npx tsx scripts/operations/_phase4742-consumer-completion.ts audit
npx tsx scripts/operations/_phase4742-consumer-completion.ts repair-ticketio
npx tsx scripts/operations/_phase4742-consumer-completion.ts repair-availability
npx tsx scripts/operations/_phase4742-consumer-completion.ts repair-soldout
npx tsx scripts/operations/_phase4742-consumer-completion.ts verify-consumer
```
