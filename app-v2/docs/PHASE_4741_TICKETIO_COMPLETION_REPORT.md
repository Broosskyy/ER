# Phase 4.7.4.1 — Ticket.io Completion Report

Generated: 2026-08-03T19:42:00.000Z

## Executive summary

Workstream 1 closes Ticket.io price, availability, sold-out, and provider presentation for all 76 published Ticket.io events across 11 observed shop hosts. Gate C2 (BC173) was applied and verified idempotent. All remaining price, availability, and sold-out corrections are captured as read-only approval previews — no automatic backfill beyond BC173.

**Critical fix during audit:** baseline list fetches used `https://{slug}/` instead of `https://{slug}.ticket.io/`, which blocked list evidence discovery. Corrected in `_phase4741-ticketio-completion.ts`.

## Acceptance matrix (after BC173 repair)

| State | Count |
|---|---:|
| `complete_price_and_availability` | 64 |
| `shop_root_without_event_id` | 6 |
| `availability_only` | 3 |
| `event_not_on_accessible_list` | 1 |
| `public_evidence_absent` | 2 |

No `unknown` or `incorrect` acceptance states.

### Before → after (BC173 repair)

| Metric | Before (broken list URL) | After (fixed + BC173) |
|---|---:|---:|
| Public price evidence | 0 | 72 |
| Canonical price | 63 | 64 |
| Explicit availability | 20 | 20 |
| `complete_price_and_availability` | 18 | 64 |

## Gate C2 — BC173 repair (APPLIED)

| Field | Value |
|---|---|
| Event | `evt-1785339410908-9691748` — Bootshaus pres. BC173 (let's get loco) |
| Slug | `BcDqml12` |
| Evidence | `list_overview_row` — `ab 23,00 €` (`Tickets ab 23,00 Euro`) |
| Before | `ticketStatus: external_link`, no price |
| After | `priceText: ab 23,00 €`, `ticketStatus: on_sale`, admission phase from list |
| Pass 2 | **Idempotent** (0 mutations) |
| Forbidden domains | Unchanged (lineup, URLs, attributes, etc.) |

Artifact: `docs/real-data/_phase4741_bc173_repair.json`

## Price backfill preview (approval required)

**2** evidence-backed candidates with exact event slug match and missing canonical price (BC173 excluded — already repaired):

1. Unreal Weekender Night II — `ab 45,00 €` (`unreal-bootshaus.ticket.io/Zt24QJcV/`)
2. Unreal Weekender Night I — `ab 45,00 €` (`unreal-bootshaus.ticket.io/U1dUL7lG/`)

Both show waitlist labels on accessible list; planned mutation includes price + `on_sale` status only.

The prior assessment count of 9 `ticket_io_public_list_price_canonical_absent` included **6 shop-root Palma events** where list minimum (`ab 3,00 €`) is not event-specific — excluded from slug-matched backfill preview per domain safety rules.

Artifact: `docs/real-data/_phase4741_price_backfill_preview.json`

## Availability preview (approval required)

- **56** events with canonical `unknown` availability
- **53** have explicit list-level evidence inferable (primarily `json_ld_instock_with_price_on_accessible_list`)
- **3** remain without inferable evidence (shop-root, blocked lists, or absent from list)

Artifact: `docs/real-data/_phase4741_availability_preview.json`

## Sold-out preview (approval required)

**8** mismatches where public list evidence shows `sold_out` but canonical does not:

| Event | Evidence surface | Current canonical | Note |
|---|---|---|---|
| TECHNO DAMPFER Düsseldorf w/ Moonbootica | list_json_ld | unknown | Registered shop — safe candidate |
| Bootshaus on a Ship Vol. III | list_json_ld | `available` / `external_link` | Explicit mismatch — high confidence |
| 5× Palma shop-root (122 pres. …) | list_json_ld on shop root | unknown | **Review required** — sold-out signal may be shop-level JSON-LD, not event-specific |

Artifact: `docs/real-data/_phase4741_soldout_preview.json`

## Shop-root matrix (6 Palma/JUNO events)

All 6 `bootshaus.ticket.io` shop-root events classified **`official_page_only`** — each has a `bootshaus.tv` official page; purchase URL remains shop root. No slug fabrication.

Artifact: `docs/real-data/_phase4741_shop_root_matrix.json`

## Unregistered shop readiness profiles (no activation)

| Host | Events | List accessible | Price strategy | Detail blocker | Risk |
|---|---:|---|---|---|---|
| `blacklist-festival.ticket.io` | 1 | No (ALTCHA) | list_overview_row | ALTCHA | medium |
| `polyamor.ticket.io` | 1 | No (ALTCHA) | list_overview_row | ALTCHA | medium |
| `unreal-bootshaus.ticket.io` | 2 | **Yes** | list_overview_row | ALTCHA | medium |
| `bootshaus-tickets.ticket.io` | 1 | No (ALTCHA) | list_card_html | ALTCHA | medium |

Artifact: `docs/real-data/_phase4741_unregistered_shop_profiles.json`

## Provider presentation

All 76 events verified:

- Provider label: **Ticket.io**
- No shared mapping defects (`presentationIssues: 0`)
- Price and availability sourced from canonical read only

## Observed shop hosts (11)

`area51events`, `blacklist-festival`, `bootshaus-club`, `bootshaus-tickets`, `bootshaus`, `hmg-concerts`, `lehmannclub`, `polyamor`, `proton-the-club`, `technodampfer`, `unreal-bootshaus`

## Commands

```bash
npx tsx scripts/operations/_phase4741-ticketio-completion.ts full          # read-only audit
npx tsx scripts/operations/_phase4741-ticketio-completion.ts repair-bc173  # Gate C2 (applied)
npx tsx scripts/operations/_phase4741-ticketio-completion.ts preview-prices
npx tsx scripts/operations/_phase4741-ticketio-completion.ts preview-availability
npx tsx scripts/operations/_phase4741-ticketio-completion.ts preview-soldout
```

## Tests and validation

| Check | Result |
|---|---|
| `typecheck:app` | Pass |
| `typecheck:operations` | Unrelated failure (`_audit-long-artist-ids.ts`) |
| ESLint (4741 files) | Warnings only (import order) |
| Ticket.io + phase4741 tests | **Pass** (19/19 targeted) |
| Full ticket-platform Vitest | 69/70 pass; 1 unrelated Ticket Kings failure |
| `build:web` | Pass |
| `validate:build-output` | Pass |

## Artifacts

- `docs/real-data/_phase4741_ticketio_baseline.json`
- `docs/real-data/_phase4741_bc173_repair.json`
- `docs/real-data/_phase4741_bc173_repair_backup.json`
- `docs/real-data/_phase4741_price_backfill_preview.json`
- `docs/real-data/_phase4741_availability_preview.json`
- `docs/real-data/_phase4741_soldout_preview.json`
- `docs/real-data/_phase4741_shop_root_matrix.json`
- `docs/real-data/_phase4741_unregistered_shop_profiles.json`
- `docs/real-data/_phase4741_acceptance_matrix.json`
- `docs/real-data/_phase4741_repair_runs.json`

## Pending approvals (out of scope for auto-repair)

1. **Price backfill** — 2 Unreal Weekender events
2. **Availability backfill** — 53 events with explicit list evidence
3. **Sold-out correction** — 8 candidates (5 shop-root require review)
