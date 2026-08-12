# Bootshaus Golden Path — Content Quality Gate

Technical notes for description, lineup, and genre projection in the verified-public-evidence import path.

## Description projection

- Official body text passes through boundary stripping (`description-boundaries`, `stripAffenkaefigDescriptionNoise`).
- Lineup blocks (`Line Up:`, `.MAINFLOOR:`) are removed from consumer descriptions via `stripNonEditorialLineupFromDescription`.
- Inline decorative dividers (▔ blocks) split footer content before boundary classification.
- `description_contaminated` is raised only when a non-empty consumer description would still contain footer, app, merch, address, navigation, or URL residue.

## Lineup projection

Priority:

1. Structured official running-order metadata (filtered for invalid placeholders).
2. Explicit MAINFLOOR / Line-up blocks in official description (including compressed single-line blobs).
3. `pres. by` headliner titles (e.g. CHRIS STUSSY pres. by BOOTSHAUS).
4. Presented-by title artists with compound act preservation (`2 ENGEL & CHARLIE`).

Deduplication uses compact identity keys (spacing and harmless punctuation). Enrichment gaps include `lineup_not_announced`, `lineup_requires_media_extraction`, and explicit lineup quality codes.

## Genre projection

- Structured official genre tags are preferred over text inference.
- Text genres use ontology word-boundary matching only.
- Missing belastbare Evidenz yields `genres_missing` or `genres_requires_media_extraction` without inventing labels.

## Consumer-ready gate

Blocking reasons include `description_contaminated`, `lineup_evidence_lost`, `lineup_duplicate`, and `genres_evidence_lost`. Optional enrichment gaps do not block base identity, date, venue, or URL correctness.
