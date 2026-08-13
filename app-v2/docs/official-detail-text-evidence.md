# Official detail text evidence

Bootshaus official event pages expose lineup and description inside `.event-description-content`
paragraph blocks. Detail enrichment now routes through `extractEventDescription()` instead of
scoring generic `main`/`article` blobs that picked up navigation chrome (`">Line-Up"`).

## Path

```
Official detail HTML
  → extractDescriptionBoundariesFromHtml (paragraph blocks)
  → extractOfficialDetailTextEvidence
  → mapOfficialRawToVerifiedEvidence (lineupContentBlocks + description)
  → Golden builder → content quality gate → consumer preview
```

## Rules

- Section headers (`MAINFLOOR`, `LINE-UP`, `STAGE`, …) are never published as artists.
- Compound billing (`&`, `x`, `b2b`, `vs.`) is preserved; `2 ENGEL & CHARLIE` stays one act.
- Lineup chrome descriptions and contaminated `runningOrder` metadata are ignored.
- Genres only from structured tags or explicit `Genres:` blocks; otherwise `genres_missing`.
- Optional `sourceMetadata.officialDetailHtml` enables offline replay when list capture
  descriptions are chrome-only.

## Module

`src/features/import/domain/official-detail-text-evidence.ts`
