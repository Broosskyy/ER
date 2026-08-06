# Phase 4.6.3 Part 1 — Data Quality Fixes Report

Generated during implementation of lineup, description, merge, and ticket URL improvements.

## 1. Lineup fixes

- Shared placeholder filter: `src/features/events/domain/lineup-artist-quality.ts`
  - Rejects Organization, Artists, Line-up, Support, Special Guests, etc.
- Applied at import normalization, lineup extraction, and ticket.io sanitization
- Multi-source merge uses `pickBetterArtistNames` (length + union, no downgrade)
- Publish lineup writer unions artist IDs across enrichment passes

## 2. Description normalization

- Single pipeline: `src/features/import/domain/canonical-description-normalizer.ts`
- Wired into import normalizer, publish mapper, and public display normalizer
- Strips Place/Date/Start metadata lines, escaped `\n`, HTML entities, emoji spam

## 3. Multi-origin merge

- `merge-strategy.ts`: `artistNames` uses quality-aware `pickBetterArtistNames`
- `import-event-field-mapper.ts`: descriptions normalized at publish; ticket URL uses `pickBestTicketUrl` across candidates

## 4. Ticket URL

- Search/query URLs scored low (`search_page_not_event`)
- `pickBestTicketUrl` considers existing, candidate, metadata, eventUrl, originalLink

## 5. Import coverage audit

Run: `npx tsx scripts/operations/_phase463-import-coverage-audit.ts`

Output: `docs/real-data/_phase463_import_coverage_audit.json`

## 6. Remaining gaps

- Ticket.io detail offers still blocked in production → ticket phases empty
- Title-only Ticket.io list lineups may not create structured `event_artists` until detail fetch works
- Bootshaus Sommerfest short description may need source-specific detail pass

## 7. Tests added

- `lineup-artist-quality.test.ts`
- `canonical-description-normalizer.test.ts`
- Extended `import-lineup-from-record.test.ts`
