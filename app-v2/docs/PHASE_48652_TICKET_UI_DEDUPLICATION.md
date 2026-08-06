# Phase 4.8.6.5.2 — Generic Ticket Price UI Deduplication

Consumer presentation only. No Event, ticket-phase, provenance, or source writes.

## Problem

The same verified ticket price was rendered up to five times on Event Detail:

- header (`EventHero` / `TicketPriceLabel`)
- standalone ticket-section price (`EventTicketSection.priceLabel`)
- phase-card price (`TicketTypeCard`)
- subtotal (`TicketSummary`)
- total (`TicketSummary`)

There is no in-app cart or quantity selection, so subtotal/total were always redundant.

## Solution

Centralized resolver: `src/features/events/formatting/resolve-consumer-ticket-presentation.ts`

### Presentation model

| Field | Rule |
|-------|------|
| `headerPriceLabel` | Compact summary: `ab X €`, exact price, sold-out badge, or absent |
| `sectionPriceLabel` | Absent when phases exist; absent when header already shows price |
| `ticketTypes` | Deduped admission phases, one price per card |
| `summary` / `showSummary` | Only when `mode === 'native'` **and** `hasCartSelection === true` |
| `availabilityLabel` | From canonical ticket availability |
| `providerLabel` | External provider label when CTA URL exists |
| `cta` | Canonical CTA label |

### Wired through

- `toEventHeroViewModel` → `headerPriceLabel`
- `toEventTicketSectionViewModel` → section fields + `showSummary`
- `EventTicketSection` → renders `TicketSummary` only when `showSummary`
- `toTicketSummaryViewModel` → requires `{ forCartCheckout: true }`
- `toTicketTypeViewModels` → strips diagnostic `surface:` notes from consumer text

## Acceptance events

| Event | ID | Expected |
|-------|-----|----------|
| Underland | `evt-1785389049895-4mb7dub` | Header `ab 15,00 €`, one Early Bird phase, no summary |
| Sommerfest Elektroküche | `evt-1785389055557-ux20897` | Header `ab 15,00 €`, one Phase 3 card |
| BC173 | `evt-1785339410908-9691748` | Header `ab 23,00 €`, one Admission card |
| R3HAB | `evt-1785339421539-k3swcrl` | Header `ab 23,90 €`, no section duplicate |
| Bootshaus Sommerfest | `evt-1785339391167-tfaixrr` | Header `ab 11,90 €`, normalized text |
| MDMA | `evt-1785389052337-0gv1iz1` | Header `ab 34,90 €`, no raw Euro duplicate |
| LEVI | `evt-1785339383539-0lxvjlp` | CTA only, no price, no placeholder |

## Ops (read-only)

```bash
npm run audit-phase48652
```

Commands: `audit-rendering`, `build-presentation-model`, `validate-acceptance-events`, `verify-visual-layout`, `readiness`, `before-after-matrix`, `report`, `full`

Artifacts:

- `docs/real-data/_phase48652_render_inventory.json`
- `docs/real-data/_phase48652_before_after_matrix.json`
- `docs/real-data/_phase48652_acceptance_events.json`
- `docs/real-data/_phase48652_visual_verification.json`
- `docs/real-data/_phase48652_readiness.json`

## Tests

```bash
npx vitest run src/features/events/formatting/__tests__/resolve-consumer-ticket-presentation.test.ts
```

## Rollback

Revert `resolve-consumer-ticket-presentation.ts` wiring in `event-detail-view-model.ts` and `ticket-phase-consumer-bridge.ts`.
