# Phase 4.7.2 — Ticket Presentation Truth, Venue Ownership and Flyer Evidence

**Generated:** 2026-08-03  
**Mode:** Read-only preflight (no production repair gates executed)

## Executive results (preflight)

| # | Metric | Before | After (this phase) |
|---|--------|--------|---------------------|
| 1 | Incorrect ticket provider labels | **31** (source-ID based) | **0 in UI projection path** (code fix; no DB repair) |
| 2 | Venue ownership conflicts flagged | **63** | **63** (audit only; Gate B not run) |
| 3 | Events gaining visible price | — | **0** (Gate C not run) |
| 4 | Events gaining explicit availability | — | **0** (Gate C not run) |
| 5 | Sold-out events corrected | — | **0** |
| 6 | Flyer candidates extracted / accepted / review | **93 / 0 / 93** | OCR pending; no auto-publish |
| 7 | Events gaining valid structured lineups | — | **0** (Gate D not run) |
| 8 | Unrelated field mutations | — | **0** (no repair executed) |

## Verdicts

| Area | Status |
|------|--------|
| Ticket provider presentation | **Code complete** — `ticketPlatform` drives UI label; Gate A repair not run |
| Venue ownership | **Audit complete** — Gate B not run |
| Price extraction | **Connector improvements** — TK checkout fetch; Gate C not run |
| Availability and sold-out | **Audit complete** — Gate C not run |
| Flyer evidence pipeline | **Inventory + candidate queue** — Gate D not run |
| Production repair | **not run** |
| Mobile acceptance | **not performed** |

## Ticket provider label fix

**Root cause:** `ticketProviderLabel` was derived from import `sourceId` via `getSourceDisplayLabel()`, so Bootshaus website-sourced events with Ticket.io URLs displayed *"Tickets extern über Bootshaus"*.

**Fix:** `resolveTicketProviderPresentationLabel()` derives label from canonical `ticketPlatform` + purchase URL host. Wired into `projectCanonicalEventFields()` and `toEventDisplayModel()`.

**Examples after code deploy (no DB mutation):**

| Event | Purchase URL | Old label | New label |
|-------|--------------|-----------|-----------|
| LEVI | `bootshaus-tickets.ticket.io/...` | Bootshaus | **Ticket.io** |
| MDMA | `ticketkings.de/event/...` | Affenkäfig | **Ticket Kings** |
| Ship Vol. III | `bootshaus-club.ticket.io/...` | Bootshaus | **Ticket.io** |

`sourceAttributionLabel` remains separate for provenance footer.

## Price evidence (representative)

| Event | Public price found | Persisted | Failure class |
|-------|-------------------|-----------|---------------|
| Sommerfest Elektroküche | **ab 2,50 €** (nacht-manager checkout) | empty | `PRICE_LOST_DURING_NORMALIZATION` |
| MDMA | **ab 2,50 €** (nacht-manager checkout) | empty | `PRICE_LOST_DURING_NORMALIZATION` |
| Ship Vol. III | ab 32,00 € | yes | none |
| LEVI / BC173 / Blacklist | list/metadata varies | mostly empty | `PUBLIC_PRICE_NOT_EXTRACTED` or blocked list |

**Connector changes:** `ticket-kings-public-checkout.ts` fetches public `native_event.php` iframe checkout (not Ticket.io ALTCHA). `parseTicketKingsShopHtml` now emits `priceText` and `ticketOffers[]`.

**Gate C** required to backfill persisted prices for TK events where public checkout exposes prices.

## Venue audit notes

63 flagged rows include:

- `organizer_differs_from_venue` — often legitimate (Bootshaus promotes external venue)
- `external_title_with_default_venue_id` — Mallorca / external gigs still pinned to `venue-bootshaus-koeln`
- `promoter_bootshaus_venue_not_independent` — promoter vs venue conflation

**Blacklist Festival** and **JUNO/Mallorca** require Gate B review before mutation.

## Flyer pipeline

- **108** events inventoried for flyer artwork
- **93** queued as `ocr_pending` (no raw OCR text without approved OCR provider)
- **0** auto-accepted (contract: `autoPublishAllowed: false`)
- Controlled path: `enrichFlyerLineup` → review → `writeCanonicalStructuredLineup` (Gate D)

## Approval gates (not executed)

| Gate | Scope | Status |
|------|-------|--------|
| A | Ticket provider presentation metadata | Pending approval |
| B | Venue ownership | Pending approval |
| C | Price, availability, phases | Pending approval |
| D | Approved flyer lineup candidates | Pending approval |

## Deliverables

- `docs/real-data/_phase472_field_ownership_audit.json`
- `docs/real-data/_phase472_ticket_provider_violations.json`
- `docs/real-data/_phase472_venue_conflicts.json`
- `docs/real-data/_phase472_price_traces.json`
- `docs/real-data/_phase472_availability_traces.json`
- `docs/real-data/_phase472_flyer_inventory.json`
- `docs/real-data/_phase472_flyer_candidates.json`
- `docs/real-data/_phase472_quality_rule_violations.json`
- `docs/real-data/_phase472_before_after.json`

## Commands

```bash
npx tsx scripts/operations/_phase472-ticket-venue-flyer-evidence.ts preflight
npx tsx scripts/operations/_phase472-ticket-venue-flyer-evidence.ts full   # read-only
```

Repair commands (`repair-ticket-presentation`, etc.) abort until explicit gate approval.
