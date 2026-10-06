# M9.3B.2D Artist & Genre Intelligence Report

Generated: 2026-09-11T22:43:10.380Z  
Branch: `rebuild/event-core-clean` @ `6ad9c32773d3daf5a0ee44059661bf6456893a03`  
Staging: `gnkjzinwvmrxcadwebhv` (only target)  
Production: `irgsllewfrxvbtznqmxh` (not mutated)

**Status: M9_3B_2D_ARTIST_GENRE_INTELLIGENCE_VERIFIED**

---

## Summary

M9.3B.2D extends M9.3B.2C with a reusable **Artist Genre Intelligence** layer: provenance-backed artist profiles, multi-source evidence providers, taxonomy-aware consensus, lineup-weighted event genre derivation, and a staging orchestrator with dry-run / apply / idempotency gates.

| Metric | Before | After apply |
|--------|--------|-------------|
| Events with genre | 22 / 34 | **23 / 34** |
| Genre coverage | 64.7% | **67.6%** |
| Recoverable after intelligence | 1 | **0** |
| Still unresolved | 12 | **11** |
| Production mutations | — | **0** |

**Recovered via artist intelligence:** `14 Jahre Affenkäfig` → **Techno** (lineup consensus from classified artists TIEFUNDTON + TOMMY LIBERA, HIGH confidence).

---

## Architecture (extends B.2C, does not replace)

| Module | Purpose |
|--------|---------|
| `artist-genre-intelligence/types.ts` | `ArtistGenreProfile`, `ArtistGenreEvidence`, metrics |
| `artist-identity.ts` | Safe normalized identity + headliner extraction |
| `artist-evidence-providers.ts` | Historical event + event-description providers |
| `external-metadata-provider.ts` | MusicBrainz + Discogs bounded fetch |
| `artist-genre-consensus.ts` | Multi-source artist profile consensus |
| `artist-profile-store.ts` | Refreshable file cache (`.tmp/m9-3b-2d-artist-genre-cache/`) |
| `lineup-genre-consensus.ts` | Weighted lineup / headliner event genre consensus |
| `discovery-confidence-policy.ts` | EXPLICIT/HIGH/MEDIUM searchable policy |
| `genre-unresolved-baseline.ts` | Pre/post unresolved forensics |
| `artist-intelligence-service.ts` | Orchestrates providers + consensus |
| `run-m9-3b-2d-artist-genre-intelligence.ts` | Staging dry-run / apply orchestrator |

B.2C modules (`genre-taxonomy`, `genre-evidence`, `genre-coverage-audit`, search recall, ticket/lineup safety) are **extended**, not replaced.

---

## Artist Intelligence Metrics

| Counter | Value |
|---------|-------|
| `artistsEvaluated` | 147 |
| `artistsClassified` | 35–44 (post-cache refresh) |
| `artistProfilesCreated` | 114 (initial external pass) |
| `artistCacheEntries` | 126 |
| `artistEvidenceRecords` | 493 |
| `artistGenreConflicts` | 81 (taxonomy-incompatible multi-genre profiles withheld) |
| `eventsRecoveredByArtistIntelligence` | 1 |
| External provider requests (initial pass) | 405 (300 success / 105 failure) |

---

## QA Anchor Status (post-apply)

| Event | Genre | Reason if unresolved |
|-------|-------|---------------------|
| **14 Jahre Affenkäfig** | **Techno** ✓ | Lineup consensus applied |
| **Chris Stussy** | unresolved | `ARTIST_METADATA_MISSING` — profile has no publishable canonical genres after MB/Discogs + description pass |
| **Deborah de Luca** | unresolved | `ARTIST_METADATA_MISSING` — ticket boilerplate only; no artist genre evidence |
| **MDMA** | unresolved | 0/7 lineup artists classified |
| **Bootshaus on a Ship IV** | unresolved | 0/5 lineup artists classified |
| **MI KitKat 30.12** | unresolved | No lineup; no artist evidence |
| **Affenkäfig CAPITOL Hagen** | unresolved | Lineup not announced (`Folgt` rejected) |
| **Sara Landry** | Hard Techno, Techno ✓ | Unchanged; 1 feed card |

---

## Safety & Recertification

| Gate | Result |
|------|--------|
| `productionMutations` | 0 |
| `genreRecoverableAfter` (post-apply) | 0 |
| Search false negatives (recoverable) | 0 |
| `consumerParityFailures` | 0 |
| `goldenRegressionFailures` | 0 |
| `duplicateGroups` | 0 |
| Sara rendered cards | 1 |
| Ticket regressions | 0 |
| Idempotent re-run (23→23 genres, recoverable=0) | ✓ |

---

## Discovery Confidence Policy

- **EXPLICIT / HIGH / MEDIUM** → searchable narrow genres
- **LOW / UNRESOLVED** → not promoted to consumer genre
- Event field authority preserved: explicit event evidence beats artist inference

---

## Remaining Gaps (documented, not hardcoded)

11 events remain genre-unresolved after artist intelligence exhaustion. Dominant reasons:

- `ARTIST_METADATA_MISSING` — underground/regional artists absent from MusicBrainz/Discogs or profiles marked `CONFLICT`
- `LINEUP_INCOMPLETE` — no verified lineup for consensus
- No unsupported broad "Electronic" fallback applied

Chris Stussy / Deborah de Luca require stronger artist evidence acquisition (e.g. improved Discogs auth, additional verified promoter bios) — architecture supports this via `ArtistEvidenceProvider` boundary without event-specific rules.

---

## Artifacts

`artifacts/m9-3b-2d-artist-genre-intelligence/`

---

## Next Step

Manual Android QA on staging required.

**STOP** — do not proceed to M9.3B.3, ticket.io Germany expansion, Rausgegangen, scheduler, or production.
