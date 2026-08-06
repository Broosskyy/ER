# Phase 4.6.7 — Lineup Segmentation & Canonical Artist Integrity

Generated: 2026-08-02T22:25:00.000Z

## 1. Segmentation audit

Pipeline traced end-to-end:

| Stage | Module | Failure mode addressed |
|-------|--------|----------------------|
| Text | source HTML / description | Missing line breaks collapsed adjacent artists |
| Description parser | `lineup-text-parser.ts` | Section stop at `Running Order`, `▔` blocks, `Location` |
| Lineup parser | `lineup-text-parser.ts` | Per-line tokenization before billing expansion |
| Tokenizer | `lineup-billing-parser.splitLineupTextIntoLines` | `<br>`, block elements preserved (no `stripHtml` collapse) |
| Billing parser | `lineup-billing-parser.ts` | B2B / F2F / VS pairs expanded; chained b2b rows flattened |
| Artist normalization | `lineup-artist-quality.ts` | Collapsed names rejected; billing pairs expanded |
| Canonical projection | `import-publish-lineup-writer.ts` | Collapsed canonical fallback expansion; no empty wipe |
| Consumer projection | existing `event_artists` path | Repair rewrites from expanded import/description lineup |

**Primary failure stage before fix:** billing parser + canonical projection (collapsed strings stored as single `artists.name`).

## 2. Billing parser improvements

- `lineup-billing-parser.ts` — generic B2B/F2F/VS splitting, chained inline b2b rows, HTML line breaks, Live/Support/Hosted-by filtering, mixed-case glue repair (`camelCase` boundaries only; billing tokens protected).
- `lineup-text-parser.ts` — line-based segmentation, comma fallback after billing expansion, section boundary hardening.
- `lineup-artist-quality.ts` — `isCollapsedLineupArtistName` treated as invalid placeholder.
- `import-lineup-from-record.ts` — structured lineup entry expansion, description lineup fallback, title inference (`presents LEVI`).
- `import-publish-lineup-writer.ts` — expands collapsed canonical artists instead of wiping lineup.

## 3. Artist integrity repair

Controlled repair (no global reimport):

| Pass | Events touched | Notes |
|------|----------------|-------|
| Pass 1 | 15 | Collapsed canonical + import/description richer lineups |
| Pass 2 | 0–2 | Idempotent on stable events; edge cases with partial import overlap |

Caches invalidated after each pass via `invalidateConsumerEventCaches`.

## 4. Representative events

### Sommerfest Elektroküche
- **Status:** 14 core artists preserved; 2 duplicate artifacts (`HYPNO TIZED`, `STIMU LATE`) from intermediate repair — requires one targeted re-repair from import payload (no lineup regression in import layer).
- **Canonical count:** 16 (import: 14)

### Bootshaus on a Ship Vol. III
- **Status:** Partial — description lineup recovered (7 entries) from glued `LINEUP:` block; all-caps glue without spaces (`COLLINSOLIVER`, `IDENTITYDAVE`) still needs list/detail re-enrichment or multiline source text.
- **Target:** Brandon, Sam Collins, Oliver Magenta, Lost Identity, Dave Replay, Emin, Alukes, Makla

### MDMA
- **Status:** Collapsed F2F/B2B strings split into **18 individual artists** (was 9 collapsed entities).
- **Remaining:** `KARAM USTA` / `GREEKZ` should be `KARAMUSTA` / `GREEKZ` after next ticket-kings reimport with updated parser.

### LEVI
- **Status:** **Pass** — exactly one artist (`LEVI`) via title inference; no placeholder.

## 5. Before/after metrics

| Metric | Before | After |
|--------|--------|-------|
| Published events | 108 | 108 |
| Complete lineups | 82 | 82 |
| Single-artist events | 42 | 42 |
| Invalid artist entities (event-level) | 0 | 0 |
| Broken billing relationships (event-level) | 0 | 0 |
| Avg artists / event | 4.09 | 4.28 |
| Canonical artist count | 319 | 335 |
| Collapsed artist entities (catalog) | 23 | 23* |

\*Catalog entities retain historical collapsed names until orphaned-artist cleanup; event lineups no longer reference them where repair succeeded.

## 6. Remaining blockers

1. **Glued all-caps pairs without spaces** in Bootshaus descriptions (`COLLINSOLIVER`) — safe heuristic split risks false positives on legitimate names (`HYPNOTIZED`); needs source reimport with multiline HTML or list-detail enrichment.
2. **Sommerfest duplicate artifacts** — one targeted repair from import record recommended.
3. **Ticket.io detail ALTCHA** — still blocks detail HTML lineup for some events (out of 4.6.7 scope).
4. **23 legacy collapsed `artists` rows** — catalog cleanup pass recommended (do not delete artists still linked elsewhere).

## Artifacts

- `docs/real-data/_phase467_artist_integrity.json`
- `docs/real-data/_phase467_lineup_repairs.json`
- `docs/real-data/_phase467_lineup_backup.json`
- `docs/real-data/_phase467_metrics_before.json`
- `docs/real-data/_phase467_metrics_after.json`

## Tests run

- `typecheck:app` ✓
- `typecheck:operations` ✓
- Phase 4.6.7 lineup segmentation tests ✓
- Lineup / projection / artist-quality tests ✓
- `build:web` + `validate:build-output` ✓
