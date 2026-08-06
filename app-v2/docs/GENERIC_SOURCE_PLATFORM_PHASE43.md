# Eternal Rave — Phase 4.3: Ticket.io Data Quality

## Root causes

| Symptom | Root cause | Fix |
|---------|------------|-----|
| Description "N/A" | Ticket.io list JSON-LD ships literal `"description":"N/A"`; normalizer and publish stored it verbatim | Placeholder sanitization in adapter + `EventNormalizer` + publish |
| Missing lineup | JSON-LD `performer: "Unbekannt"`; full lineup only on detail pages; auto-publish never wrote `event_artists` | Detail parser + title extraction + import publish lineup writer |
| Missing ticket prices in UI | `priceAmount` extracted but no `price_text` column / `Event.priceText` mapping | `price_text` migration + list overview parsing + publish mapping |
| Wrong ticket URLs | Mostly correct from JSON-LD; occasional merge onto wrong canonical via weak duplicate match | URL validation on ingest + normalized URL duplicate matching |
| Duplicate events | Same real event published twice when duplicate score < 70 across origins | Normalized ticket URL matching in duplicate detection |
| Missing images | JSON-LD `image` present on list pages — generally imported; gaps when event blocked or scope-filtered | No code regression; existing image URL path retained |

## Pipeline changes

1. **List enrichment** (`ticket-io-list-enrichment.ts`) — genre from overview row, `Tickets from X Euro` → `ab X,00 €`
2. **Detail enrichment** (`ticket-io-detail-parser.ts`) — lineup, description, multi-offer prices (best-effort; POW blocks live bot fetch)
3. **Title artists** (`ticket-io-title-artists.ts`) — `pres.`, `w/`, `ft.`, `x` patterns
4. **Placeholder filter** (`ticket-io-field-quality.ts`) — `N/A`, `Unbekannt`, POW page detection
5. **Publish lineup** (`import-publish-lineup-writer.ts`) — writes lineup on auto-publish when artists matched
6. **Schema** — `events.price_text` column (migration `20260770000000_sprint43_ticket_io_data_quality.sql`)
7. **Frontend** — hide `N/A` descriptions; remove duplicate datetime secondary row; Ticket.io source label

## SHOCKONE regression

With detail HTML available (fixture or future POW bypass):

- SHOCKONE, T!mb, Not Fair, Kyuuti, MC Haze extracted
- Description from detail JSON-LD
- `ab 12,00 €` from in-stock Regular offer (Early Bird sold out ignored for min price)
- Ticket URL `https://proton-the-club.ticket.io/hyHJr2xd/`

From list-only (production today without detail access):

- SHOCKONE from title (`pres.`)
- Price from list overview + JSON-LD offer
- Genre from list info row (Proton shops)
- No `N/A` description

## Remaining limitations

- **Ticket.io detail pages** return Altcha POW challenge to `EternalRave-SourceBot` — full lineup/description requires detail HTML via fixture, manual snapshot, or future authenticated fetch
- **Admin quality UI** — provenance exists in backend; dedicated quality panel actions (merge, rerun extraction) not expanded in this sprint
- **Safe repair script** — use existing import job re-run; dedicated idempotent repair orchestrator not added (re-run import twice should be stable via hash + reconciliation)

## Tests

`src/features/aggregation/connectors/ticket-platform/__tests__/sprint43-ticket-io-data-quality.test.ts` — 6 tests

Full suite: **1283/1283 passing**

## Validation checklist

- [ ] Re-run Ticket.io import for proton, lehmann, area51, technodampfer, hmg
- [ ] Verify SHOCKONE public detail: lineup, price, no N/A
- [ ] Verify second import run produces no additional changes
