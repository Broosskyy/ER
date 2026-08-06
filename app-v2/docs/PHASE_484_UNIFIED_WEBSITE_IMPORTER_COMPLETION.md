# Phase 4.8.4 — Unified Official Website Importer Completion

**Status:** Complete (implementation only — not integrated)  
**Importer version:** `phase484-unified-website-v1`  
**Date:** 2026-08-05  
**Production mutations:** `0`

## Objective

Complete the Unified Official Website Importer so it is functionally complete and provider-independent, capable of replacing legacy detail extraction once integrated in Phase 4.8.5.

This phase did **not**:

- integrate the importer into the production pipeline
- activate scheduling
- replace the legacy `club_website` connector
- publish canonical changes
- perform production writes

## Delivered Capabilities

| Capability | Module | Notes |
|---|---|---|
| Event list discovery | `list-discovery.ts` + provider adapters | Generic link crawl driven by adapter config |
| Detail-page extraction | `detail-extraction.ts` | Orchestrates all detail fields |
| HTML body extraction | `description-extraction.ts` | Prefers `.event-description-content`, ECM, Tribe body |
| Description normalization | `canonical-description-normalizer` + boilerplate strip | Shared with publish path |
| Footer removal | `description-boilerplate.ts` | Age restriction, venue footer, app/merch promo |
| Ticket HTML CTA | `ticket-extraction.ts` | Explicit CTA > JSON-LD Offer > self-referential embed |
| JSON-LD fallback | `json-ld-parser` via detail extraction | Venue, dates, coordinates, organizer |
| OG fallback | `html-meta.ts` + description chain | Only when body absent |
| Gallery extraction | `gallery-extraction.ts` | OG image + gallery selectors |
| Genres | Provider adapters | Bootshaus tag container; TicketKings categories |
| Venue / coordinates | JSON-LD | When present on public page |
| Organizer / promoter relationships | `relationship-extraction.ts` | Adapter-resolved labels + JSON-LD |
| Source-role evidence | `evidence-assembler.ts` | `sourceRole` on every `FieldEvidenceCandidate` |
| Relationship candidates | `relationship-extraction.ts` | Organizer, promoter, venue, official_page |
| Extraction diagnostics | End-to-end | Short meta rejection, contamination, stale ticket |

## Architecture

```
src/features/import/unified-website/
  unified-website-importer.ts   # orchestrator → UnifiedImportResult
  detail-extraction.ts
  description-extraction.ts
  description-boilerplate.ts
  ticket-extraction.ts
  gallery-extraction.ts
  list-discovery.ts
  provider-adapters.ts          # Bootshaus, Affenkäfig, TicketKings configs only
  relationship-extraction.ts
  evidence-assembler.ts
```

The legacy pilot entry point (`official-website-pilot.ts`) now delegates to `runUnifiedWebsiteImport()` for backward compatibility with Phase 4.8.x shadow tooling.

## Description Policy

1. Prefer visible event body (`.event-description-content`, ECM, Tribe) over `og:description`.
2. Strip venue boilerplate: decorative dividers, age restriction, venue address footer, mobile app / merchandise links.
3. Reject widget-contaminated Tribe bodies (embedded Night Manager checkout) rather than publishing script markup.
4. Never derive ticket URLs from descriptive prose.

## Ticket Policy

Priority chain:

1. Explicit HTML ticket CTA (`nav-ticket-btn`, `.ecm-event-single__ticket-button`, `.ticket.io` anchors)
2. JSON-LD `Offer.url`
3. Self-referential TicketKings event page URL (when the official website **is** the checkout page)

Promotional links (`bit.ly`, merch) are never accepted.

## Validation

Validated against all **8 Gold Standard Website Events** using captured Phase 4.8.2 live evidence HTML where available.

| Artifact | Path |
|---|---|
| Feature matrix | `docs/real-data/_phase484_feature_matrix.json` |
| Capability report | `docs/real-data/_phase484_capability_report.json` |
| Remaining gaps | `docs/real-data/_phase484_remaining_gaps.json` |
| Ops script | `scripts/operations/_phase484-unified-website-importer.ts` |

```bash
node --import tsx scripts/operations/_phase484-unified-website-importer.ts report
```

**Results:**

- 8 / 8 gold-standard events validated
- 0 unintentional gaps
- `productionMutationsInThisRun: 0`
- `allGapsResolved: true`

## Intentional Remaining Gaps

These are by design and documented in `_phase484_remaining_gaps.json`:

- **Lineup / price** — ticket platform surfaces, not official website HTML
- **Widget-contaminated Tribe descriptions** — rejected instead of publishing checkout embed markup
- **Stale Affenkäfig ticket URLs** — public page lists outdated TicketKings slug; importer correctly surfaces what the page shows
- **Cross-shop ticket URLs** — Affenkäfig pages may list TicketKings while gold-standard ticket is ticket.io

## Next Phase (4.8.5)

- Register unified importer in `SourceConnectorRegistry`
- Bridge `UnifiedImportResult` → `FieldTrustMergeService`
- Strangler migration off legacy `websiteProcessor`
- Controlled production shadow before cutover
