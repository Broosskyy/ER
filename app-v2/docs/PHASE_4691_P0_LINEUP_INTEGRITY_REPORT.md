# Phase 4.6.9.1 — P0 Lineup Integrity Report

Generated: 2026-08-03T08:00:41.749Z

## Production repair status

- Total repair mutations across runs: **49**
- Idempotent second pass: **YES**

## Acceptance criteria

- intoTheMadnessNoMdmaOrigins: **PASS**
- intoTheMadnessNoMdmaOverlap: **PASS**
- mdmaStructuredEntriesOk: **PASS**
- mdmaArtistCountOk: **PASS**
- kitkatNoInvalidArtists: **PASS**
- globalNoInvalidArtists: **PASS**

## Preflight

- Invalid artist rows in P0 set: **43**

## Post-repair audit

- Invalid artist rows: **0**
- Into The Madness artist count: **0**
- MDMA overlap on Into The Madness: **0**
- MDMA structured entries: **9** (expected 9)
- MDMA artist count: **18** (expected 18)
- Active MDMA origins on Into The Madness: **0** (expected 0)

## Repair runs

1. **repair-ownership** @ 2026-08-03T08:00:06.237Z — 8 mutations
2. **repair-invalid-artists** @ 2026-08-03T08:00:10.670Z — 41 mutations
3. **repair-ownership** @ 2026-08-03T08:00:27.110Z — 0 mutations
4. **repair-invalid-artists** @ 2026-08-03T08:00:28.139Z — 0 mutations

## Code changes (generic)

- `artist-candidate-quality-gate.ts` — central gate before Artist create/link
- `event-ownership-decision.ts` — ownership evidence + lineup contribution guard
- `duplicate-detection-service.ts` — artist overlap cannot match alone
- `import-publish-lineup-writer.ts` — blocks cross-title lineup writes

## Remaining blockers (not P0)

- P1 single structured writer cutover
- P3 flyer reconciliation for detail-blocked events
- `typecheck:operations` pre-existing `_audit-long-artist-ids.ts` failures (unrelated)
