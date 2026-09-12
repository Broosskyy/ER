# M9.3B.2E Discovery-to-Genre Evidence Fusion Report

Generated: 2026-09-12T13:44:02.656Z  
Status: **M9_3B_2E_DISCOVERY_GENRE_EVIDENCE_FUSION_REVIEW_REQUIRED**

## Executive Summary

B.2E delivers the generic **discovery-to-genre evidence fusion** architecture, domain classification separation, discovery signal bridge, weighted fusion engine, expanded artist evidence providers, and full staging orchestration with artifacts.

The **≥95% classification gate is not met** after exhaustive dry-run evaluation:

| Metric | Value |
|--------|-------|
| Eligible events | 34 |
| With genre (before) | 23 (67.6%) |
| Recoverable via fusion (dry-run) | 5 |
| Projected after apply | 28 (82.4%) |
| Required for ≥95% | 33 |
| Still unresolved | 6 |

Staging **apply was not executed** in this session (requires explicit approval). Run:

```bash
cd app-v2
npx tsx scripts/run-m9-3b-2e-discovery-genre-evidence-fusion.ts --apply
```

Then re-run without `--apply` for idempotency verification.

## Architecture Delivered

### New module: `discovery-genre-fusion/`

- `discovery-signal-bridge.ts` — rebuilds relevance + genre candidates from staging snapshots + M9.3B.1a artifacts; preserves strong/weak signals
- `domain-classification.ts` — `ELECTRONIC_HIGH` / `ELECTRONIC_MEDIUM` / `AMBIGUOUS` / `NON_ELECTRONIC` + `WEAK_IMPORT_QUALIFICATION` detection
- `event-genre-fusion.ts` — weighted authority fusion (not majority voting); shop-only rejection; series inheritance from classified siblings
- `event-series-evidence.ts` — KitKat, Affenkäfig, Halloween series keys
- `discovery-provenance-audit.ts` — reverse-audit all 34 events
- `unresolved-reverse-audit.ts` — deep audit of unresolved events

### Extended modules

- `genre-evidence.ts` — integrates fusion via `GenreFusionContext`
- `artist-intelligence-service.ts` — headliner priority, unresolved-only external fetch, Wikipedia + official-web fallback
- `external-metadata-provider.ts` — Discogs-only path, name variants, case normalization
- `wikipedia-artist-provider.ts`, `official-artist-web-provider.ts` — bounded additional evidence
- `artist-identity.ts` — headliner extraction for pure-artist titles, `toArtistSearchName()`

### Orchestrator

`app-v2/scripts/run-m9-3b-2e-discovery-genre-evidence-fusion.ts`

Artifacts: `artifacts/m9-3b-2e-discovery-genre-evidence-fusion/`

## Recoverable Events (5)

| Event | Projected genre(s) | Method |
|-------|-------------------|--------|
| Affenkäfig xxx A8 | Techno | Event series (Affenkäfig) |
| Affenkäfig CAPITOL Hagen | Techno | Event series |
| AFFENKÄFIG RULES Bootshaus | Techno | Event series |
| Bootshaus Halloween 2026 | Techno | Halloween series |
| MI KitKat 30.12 | Tech House, Techno | KitKat series (SA sibling) |

## Remaining Unresolved (6)

| Event | Blocker | Next evidence needed |
|-------|---------|---------------------|
| Bootshaus on a Ship IV | Complete lineup; 0 artist profiles resolved | External metadata for lineup acts; bootshaus.tv page genres empty |
| Polyamor Bootshaus | Complete lineup; weak import qualification | Artist profiles (DAVYBOI has Trance via MB when fetched) |
| BC173 Airport Session (MOGUAI) | Headliner MOGUAI — MB/Wikipedia intermittent | Reliable MOGUAI profile (Techno/Progressive House) |
| MDMA 10.10.26 | 7-act lineup; 0 classified artists | Full lineup external pass + description signals |
| CHRIS STUSSY | Headliner; MB/Discogs/Wikipedia/official web all empty | Bootshaus event page editorial or structured ticket metadata |
| DEBORAH DE LUCA | Headliner; MB works as "Deborah de Luca" (Techno) but uppercase/cache miss | Apply title-case search + external pass with rate-limit spacing |

## QA Anchors (post dry-run)

| Anchor | Domain | Genres (DB) | Fusion projection |
|--------|--------|-------------|-------------------|
| 14 Jahre Affenkäfig | ELECTRONIC_HIGH | Techno | Techno ✓ |
| Sara Landry | ELECTRONIC_HIGH | Hard Techno, Techno | Hard Techno ✓ |
| SA KitKat | ELECTRONIC_HIGH | Tech House, Techno | Tech House, Techno ✓ |
| MI KitKat | ELECTRONIC_MEDIUM | — | Tech House, Techno (recoverable) |
| Deborah de Luca | ELECTRONIC_MEDIUM | — | — (blocked) |
| Chris Stussy | ELECTRONIC_MEDIUM | — | — (blocked) |
| MDMA | AMBIGUOUS | — | — (blocked) |
| Bootshaus on a Ship IV | ELECTRONIC_MEDIUM | — | — (blocked) |

## Safety Gates (dry-run)

- `productionMutations`: 0
- `duplicateGroups`: 0
- `consumerParityFailures`: 0
- `ticketRegressionFailures`: 0
- `knownWrongGenreAssignments`: 0
- Sara rendered cards: 1

## Tests

```
vitest run server/official-connectors/shared/discovery-genre-fusion/__tests__/
vitest run server/official-connectors/shared/artist-genre-intelligence/__tests__/
```

16 tests passing.

## Recommended Next Steps

1. **Staging apply** the 5 recoverable classifications (`--apply`)
2. **External unresolved pass** with rate-limit backoff for the 6 remaining events
3. **Persist discovery evidence** into `event_sources.raw_payload` at import time (architectural follow-up)
4. **Bootshaus editorial recovery** for headliner-only events where official pages lack genre markup
5. Re-run B.2E until `eventsWithGenreAfter >= 33`
