# Phase 4.6.9 — Global Lineup Pipeline Audit

Generated: 2026-08-03T09:43:55.308Z

**Mode: READ-ONLY** — no production mutations performed.

## Executive summary

- Published events traced: **108**
- Structured/legacy mismatches: **14**
- Cross-event contamination suspects: **0**
- Events with prose/blob artists: **1**
- Events with collapsed names: **1**
- Pipeline healthy (no current failure): **49**

## Top root causes (incorrect/incomplete events only)

- `C_DETAIL_SOURCE_INACCESSIBLE`: 38
- `D_RAW_SOURCE_INSUFFICIENT`: 13
- `R_SOURCE_NO_LINEUP`: 7
- `G_DESCRIPTION_AS_LINEUP`: 1

## Key findings

### Into The Madness / MDMA contamination
**Root cause: `B_CROSS_EVENT_STATE_LEAKAGE` at stage 9 (multi-origin event matching).**

Event `evt-1785339386612-rjr91mv` (Into The Madness Pre-Party) carries MDMA Ticket Kings import records:
- `source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt` in originIds
- `sourceExternalIds` include `ticketkings.de/event/mdma-musik-die-mich-antreibt-...` (3×) alongside correct Bootshaus URLs
- `rawDescriptionSnippet` is the MDMA event copy (“MDMA- Musik Die Mich Antreibt… Line Up: DYSTOPIA F2F VALKYRIE…”)
- 100% structured artist overlap with MDMA canonical event `evt-1785389054496-ns9b6la` (18 shared artists)

The wrong Source payload was matched/published onto the Pre-Party canonical Event; parser output is internally consistent with MDMA Source evidence, not Bootshaus Pre-Party evidence.

### KitKatClub description-as-artist
**Root cause: `G_DESCRIPTION_AS_LINEUP` at stage 6/11.** Venue description HTML (`&bdquo;`, `&ldquo;`, prose sentences) ingested as flat `artistNames` when list-page detail lacks structured lineup sections. Quality gate `isLineupPlaceholderArtist` does not reject prose fragments. Same description fingerprint shared across two KitKat dates (22.08 and 24.10).

### Bootshaus collapsed B2B
**Vol. III (repaired):** structured 4×B2B entries correct via flyer evidence. **Vol. IV:** collapsed API artist blob with admission text (`G_DESCRIPTION_AS_LINEUP` / `E_HTML_STRUCTURE_LOST` compound) — whitespace collapse in HTML-to-text before billing segmentation; no structured persistence.

### Import/repair oscillation
Multiple import records per event + dual writers (`import-publish-lineup-writer` flat fallback vs structured writer) can alternate flat 5-artist collapsed state with 8-artist structured state.

## Pipeline stages

1. **Source configuration** — `sources table / connector registry` (read_only)
6. **Connector parser** — `connectors/website/processor, ticket-platform adapters` (read_only)
7. **Normalized candidate** — `import/normalization/event-normalizer` (read_only)
8. **Import Record persistence** — `import-repository-impl` (writes_db)
11. **Artist candidate validation** — `events/domain/lineup-artist-quality` (read_only)
12. **Artist resolution** — `import/services/import-title-lineup-resolver` (writes_db)
13. **Structured lineup merge** — `import/services/import-structured-lineup-from-record` (read_only)
14. **Structured persistence** — `import/services/import-publish-structured-lineup-writer` (writes_db)
16. **Legacy compatibility projection** — `events/services/event-lineup-service.replaceStructuredLineupFromImport` (writes_db)
17. **Event repository projection** — `data/datasources/supabase/supabase-datasource` (read_only)
20. **Event Detail UI rendering** — `components/event-detail/LineupSection` (read_only)

## Minimum fix plan

See `docs/real-data/_phase469_minimum_fix_plan.json` for ordered P0–P3 generic fixes.

## Deliverables

- `_phase469_global_event_trace_matrix.json`
- `_phase469_cross_event_contamination.json`
- `_phase469_invalid_artist_entities.json`
- `_phase469_structured_legacy_mismatches.json`
- `_phase469_parser_path_inventory.json`
- `_phase469_writer_path_inventory.json`
- `_phase469_representative_traces.json`
- `_phase469_root_cause_counts.json`
