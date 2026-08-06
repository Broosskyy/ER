# Architecture — Ticket Price & Presentation Contract

## Normalized ticket price model

Provider-independent canonical shape consumed by API/ViewModel:

| Field | Purpose |
|-------|---------|
| `displayPriceText` | Compact consumer summary (`ab X €`, exact, or empty) |
| `minimumPrice` / `maximumPrice` | Numeric admission range (add-ons excluded) |
| `currency` | ISO-4217 |
| `availability` / `soldOut` | Public availability state |
| `ticketPhases` | Distinct admission phases only |
| `admissionProducts` | Normalized checkout rows |
| `checkoutUrl` | Provider checkout (may differ from CTA) |
| `consumerCtaUrl` | Public ticket destination |
| `provider` | Ticket.io, Ticket Kings, etc. |
| `evidence` | Source, surface, freshness, confidence, review state |

## Evidence rules

1. Event-specific evidence only — no shop minimum borrowing
2. Admission products only — Flex/postage/add-ons excluded
3. Sold-out ≠ zero price
4. Checkout URL independent from consumer CTA
5. Empty evidence cannot clear valid price
6. Stale evidence cannot outrank fresh evidence
7. Raw connector objects never reach consumer layer

## Consumer presentation rules

### Header (`EventHero` / `TicketPriceLabel`)

- At most one compact summary
- `ab X €` when verified minimum exists
- Exact `X €` when single fixed admission price
- No price when not verified
- Sold-out badge instead of `0 €`

### Ticket section (`EventTicketSection`)

- Provider + availability + meaningful phase cards
- One price per distinct admission phase
- **No** standalone section price when phase cards carry the same amount
- **No** subtotal/total without in-app cart selection
- **No** repeated identical blocks

### Phase handling

| Case | Render |
|------|--------|
| Single admission phase | One phase card; no subtotal/total |
| Multiple phases | Each phase once; no aggregate total without cart |
| No phases, verified minimum | One simple price line in section OR header only |
| No verified price | Provider + CTA only |

## Implementation boundary

| Layer | Responsibility |
|-------|----------------|
| **Data** | Persist price/phases from verified public evidence; admission classification |
| **Consumer UI** | Suppress redundant surfaces; never fabricate prices |

## Module map

| Module | Role |
|--------|------|
| `ticket-kings-public-checkout.ts` | Nacht-Manager admission extraction |
| `ticket-io-price-evidence.ts` | Ticket.io list/JSON-LD evidence |
| `canonical-ticket-read.ts` / `canonical-ticket-writer.ts` | Canonical persistence |
| `ticket-phase-consumer-bridge.ts` | Phase → ViewModel (duplicate source) |
| `event-detail-view-model.ts` | Section composition |
| `ticket-price-presentation-contract.ts` | Contract + duplicate detection |

## Planned generic UI fix (Preview B)

1. `toEventTicketSectionViewModel` — omit `priceLabel` when `ticketTypes.length > 0`
2. `toTicketSummaryViewModel` — return `undefined` for external CTA / single-phase / identical subtotal=total
3. `TicketSummary` — render only when cart selection exists (future-safe guard)
