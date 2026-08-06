# Architecture Pipeline Diff

Generated: 2026-08-04T14:32:31.367Z

## Why similar Events produce different consumer results

All Events traverse the same code paths. Divergence occurs when **earlier pipeline stages supply different evidence**, causing per-field merge decisions to produce different canonical snapshots.

### Reference pipeline (Ship Vol. III)

| Stage | Decision |
|-------|----------|
| Source | 3 origins: bootshaus.tv + ticket.io |
| Normalization | ticket.io emits event slug + price; description has LINEUP block |
| Merge | Event-specific ticket URL beats shop root; price from ticket origin |
| Persistence | 4 structured B2B entries, price_text, sold_out |
| Projection | Full gallery, sold_out badge, 8 artists |

## First divergence stage counts (representative Events)

- **Persistence**: 42
- **Source**: 20
- **Merge**: 19
- **Projection**: 12
- **ViewModel**: 12
- **Connector**: 4

## Architecture findings

### multi_origin_field_merge

Events with 2+ import origins merge fields independently per SOURCE_FIELD_OWNERSHIP_MATRIX — not holistically like Ship

- Code: `merge-strategy.ts + source-field-ownership-matrix.ts`
- Affected: Underland, Sommerfest Elektroküche, MDMA 10.10, MDMA F2F, PROTON Stuttgart, Affenkäfig, Unreal Weekender II

### ticket_io_list_without_price

Ticket.io list connector omits priceText for some shops; detail blocked by ALTCHA

- Code: `ticket-platform/normalize-ticket-event.ts, ticket-io-field-quality.ts`
- Affected: none

### shop_root_fallback

When event-specific ticket.io slug missing, shop root wins per FIELD_FALLBACK_CHAINS ticketUrl

- Code: `field-fallback-priority.ts, canonical-ticket-selection.ts`
- Affected: none

### structured_lineup_gap

Structured lineup requires explicit import evidence; compatibility-only persists when writer skipped

- Code: `canonical-structured-lineup-writer.ts, lineup-projection-integrity.ts`
- Affected: none

### ocr_not_configured

Flyer images stored but OCR provider returns pending_external — lineup from flyer blocked

- Code: `flyer-ocr-provider.ts ExplicitTextFlyerOcrProvider`
- Affected: LEVI, Underland, Sommerfest Elektroküche, MDMA F2F, Affenkäfig, Unreal Weekender I, Blacklist Festival, Technodampfer Köln

### garbage_artist_filter

Title-slug garbage artists persist in DB but filtered from consumer ViewModel

- Code: `lineup-compatibility-projection.ts, artist-candidate-quality-gate.ts`
- Affected: none

### badge_projection_conservative

Attribute badges exclude reviewRequired types; ticket badges need availability semantics

- Code: `event-attribute-badge-projection.ts, ticket-badge-projection.ts`
- Affected: LEVI, Underland, Sommerfest Elektroküche, MDMA 10.10, MDMA F2F, PROTON Stuttgart, Affenkäfig, Unreal Weekender I, Unreal Weekender II, Blacklist Festival, Palma (TRIPOLISM), Technodampfer Köln

### enrichment_duplicate_venue_bleed

Enrichment duplicate approvals inherit primary origin venue when external event

- Code: `import-utils isEnrichmentDuplicateApproval, merge-strategy venueName`
- Affected: none

## Per-Event first divergence

- **LEVI** (NIGHTSWITHUS presents LEVI): first divergence **Persistence** — 8 domain diffs
- **Underland** (Underland Essigfabrik 05.09.2026): first divergence **Merge** — 9 domain diffs
- **Sommerfest Elektroküche** (Sommerfest Elektroküche 08.08.2026): first divergence **Merge** — 10 domain diffs
- **MDMA 10.10** (MDMA – Musik Die Mich Antreibt 10.10.26): first divergence **Merge** — 10 domain diffs
- **MDMA F2F** (MDMA- Musik Die Mich Antreibt xxx F2F & B2B xxx EDITION): first divergence **Merge** — 10 domain diffs
- **PROTON Stuttgart** (M.D.M.A xxx PROTON xxx STUTTGART): first divergence **Merge** — 10 domain diffs
- **Affenkäfig** (AFFENKÄFIG RULES // BOOTSHAUS KÖLN): first divergence **Merge** — 8 domain diffs
- **Unreal Weekender I** (Unreal Weekender Night I - September 2026): first divergence **Persistence** — 9 domain diffs
- **Unreal Weekender II** (Unreal Weekender Night II - September 2026): first divergence **Merge** — 9 domain diffs
- **Blacklist Festival** (Blacklist Festival 2026): first divergence **Persistence** — 8 domain diffs
- **Palma (TRIPOLISM)** (122 pres. TRIPOLISM @ Palma de Mallorca (ES)): first divergence **Persistence** — 9 domain diffs
- **Technodampfer Köln** (TECHNO DAMPFER Köln w/ Saltysis): first divergence **Persistence** — 9 domain diffs