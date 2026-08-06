# Phase 4.7.2 — Ticket.io Price Coverage & Attribute Audit

Generated: 2026-08-03 (read-only global audit)

## Executive Summary

| Metric | Count |
|---|---|
| Ticket.io published events | 76 |
| Canonical price present | 63 |
| UI price visible | 63 |
| Public list price evidence (traced representatives + failures) | 10 |
| Repairable without ALTCHA bypass (Gate C2) | **2** |
| Externally blocked (detail ALTCHA, no list price) | 0 in traced failures |
| Sold-out public evidence | 2 |
| Affenkäfig/MDMA published events | 9 |
| Attribute gaps with explicit evidence | 1 (`schema_column_missing`) |

**No production data was modified.** Gate C2 and Gate E require separate approval.

## Part A — Ticket.io Findings

### Strategy registry (enabled shops)

| Shop | Strategy | List rows | Extraction OK / Fail |
|---|---|---:|---|
| lehmannclub.ticket.io | `json_ld_list_offer` | 10 | 9 / 0 |
| technodampfer.ticket.io | `list_overview_row` | 12 | 9 / 0 |
| bootshaus-club.ticket.io | `list_card_html` | 15 | 15 / 2 |
| area51events.ticket.io | `json_ld_list_offer` | 4 | 4 / 0 |
| hmg-concerts.ticket.io | `list_overview_row` | 21 | 19 / 0 |
| proton-the-club.ticket.io | `json_ld_list_offer` | 7 | 7 / 0 |

Detail pages are ALTCHA-blocked across shops; list JSON-LD + `tio-overview-tickets-from` card rows are the primary evidence surfaces.

### Failure classification (first stage)

| Class | Count |
|---|---|
| `LIST_PRICE_AVAILABLE_NOT_EXTRACTED` | 2 |

Root cause for BC173: modern `list_card_html` parser was not wired into the production adapter (`parseAllTicketIoListRowContexts` now added).

### Representative traces

| Event | Public price | Canonical | Failure |
|---|---|---|---|
| Ship Vol. III | yes | yes | `NONE` |
| LEVI (Lehmann) | yes | yes | `NONE` |
| BC173 (let's get loco) | **ab 23,00 €** (list) | **missing** | `LIST_PRICE_AVAILABLE_NOT_EXTRACTED` |
| Blacklist Festival | not in current source matrix | — | not linked to enabled Ticket.io source |
| Unreal Weekender I/II | — | — | not in current published Ticket.io corpus |
| Lehmann / Proton / Technodampfer / Area51 / HMG | yes | yes | `NONE` |

### Quality rule highlights

- `ticket_io_shop_root_without_event_slug` — events pointing at `https://bootshaus.ticket.io/` without event slug
- `ticket_io_public_list_price_canonical_absent` — shop-root events where list shows unrelated minimum prices
- `ticket_io_explicit_sold_out_canonical_mismatch` — Technodampfer sold-out list evidence vs canonical status

## Part B — Attribute / Badge Findings

### Semantics enforced

- **Canonical attributes**: indoor/outdoor/open_air/festival/age/doors/floors (parser exists)
- **Ticket state badges**: available/sold_out/presale (canonical ticket domain)
- **Editorial badges**: not inferred from source metadata

### Schema / projection gap

Only `age_restriction` and `doors_open_at` persist to `events`. Parser output for `floor_count`, `event_attributes`, `venue_environment` is **metadata-only** — blocked at `schema_column_missing`.

Event Detail shows age via info row; **no attribute badge chips** in view model.

### Affenkäfig / MDMA

9 published events traced. Sommerfest Elektroküche has explicit multi-floor evidence in description but no canonical column → `schema_column_missing` (Gate E proposes migration, not data repair).

## Gate Previews

### Gate C2 (ticket price/availability) — 1 unique event, 2 trace duplicates removed

| Event | Evidence | Planned `price_text` |
|---|---|---|
| Bootshaus pres. BC173 (let's get loco) | list `ab 23,00 €` | `ab 23,00 €` |

### Gate E (attributes) — 1 event

| Event | Blocker |
|---|---|
| Sommerfest Elektroküche | `floor_count` / `event_attributes` schema migration required |

## Artifacts

- `docs/real-data/_phase4721_ticketio_source_matrix.json`
- `docs/real-data/_phase4721_ticketio_price_traces.json`
- `docs/real-data/_phase4721_ticketio_failure_classes.json`
- `docs/real-data/_phase4721_attribute_source_matrix.json`
- `docs/real-data/_phase4721_affenkäfig_mdma_attribute_traces.json`
- `docs/real-data/_phase4721_attribute_schema_projection.json`
- `docs/real-data/_phase4721_quality_rule_violations.json`
- `docs/real-data/_phase4721_gate_c2_preview.json`
- `docs/real-data/_phase4721_gate_e_preview.json`

## Commands

```bash
npx tsx scripts/operations/_phase4721-ticketio-and-attribute-audit.ts full
npm run audit-phase4721
```

Subcommands: `audit-ticketio`, `audit-attributes`, `audit-affenkaefig-mdma`, `quality-audit`, `preview-gate-c2`, `preview-gate-e`, `report`

## Code delivered

- `ticket-io-list-card-enrichment.ts` — modern shop list-card parser
- `ticket-io-price-evidence.ts` — multi-surface discovery + failure classification
- `ticket-io-price-strategy-registry.ts` — extended strategy types
- `ticket-io-adapter.ts` — uses `parseAllTicketIoListRowContexts`
- Tests: `phase4721-ticket-io-price-evidence.test.ts`, `phase4721-textual-attribute-parser.test.ts`
