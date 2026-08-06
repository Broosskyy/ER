# Phase 4.6.9.3 — Canonical Projection & API Truth Report

Generated: 2026-08-03T08:44:38.850Z

## 1. Projection inventory

| Surface | Module | Source fields | Fallback order | Structured | Primary artist | Title inference |
|---------|--------|---------------|----------------|------------|----------------|-----------------|
| Event repository load | `supabase-datasource.mapSupabaseEventRow` | `event_lineup_entries`, `event_artists` | structured → compatibility → empty | Yes | **No** | **No** |
| Display model / feed | `canonical-event-projection` | `lineupEntries`, `artists` | structured names → compatibility → empty | Yes | **No** | **No** |
| Event Detail UI | `event-detail-view-model` | `lineupEntries`, `knownArtistNames` | billing rows → known names → TBA | Yes | **No** | **No** |
| Search / discovery | `buildEventSearchIndex` | `event.artists` (canonical load) | repository canonical read | Yes | **No** | **No** |
| Admin editor | `event-lineup-service` | structured + flat tables | admin sections | Yes | **No** | **No** |

Full machine-readable inventory: `docs/real-data/_phase4693_projection_inventory.json`

## 2. Canonical read path

**Shared service:** `readCanonicalLineup()` in `features/events/domain/canonical-lineup-read.ts`

1. `event_lineup_entries` (+ entry artists) — authoritative
2. `event_artists` — compatibility only, quality-gated
3. explicit empty lineup

**Forbidden at read time:**
- `events.artist_id` / primary artist join
- title inference (`extractArtistsFromEventTitle`)
- description/HTML prose
- collapsed API blobs (filtered via quality gate)

## 3. API cleanup

| Change | Location |
|--------|----------|
| Removed `artist_id` lineup fallback | `mapSupabaseEventRow`, `mapEventRowToDomain` |
| Removed title-inference from `resolveKnownArtistNames` | `canonical-event-projection.ts` |
| Event detail no longer falls back to raw `lineup`/`artists` arrays | `event-detail-view-model.ts` |
| Billing rows filter invalid artist names | `lineup-billing-display.ts` |
| Structured entry projections sanitized at read | `canonical-lineup-read.ts` |

## 4. Representative events

| Event | API ↔ UI aligned | API artists |
|-------|------------------|-------------|
| Sommerfest | Yes | 14 SOLO |
| MDMA | Yes | 18 (9 B2B entries) |
| LEVI | Yes | 1 (title-inferred structured) |
| Bootshaus on a Ship III | Yes | 8 |
| Bootshaus on a Ship IV | Yes | empty (was prose primary) |
| Into The Madness | Yes | empty |
| Blacklist Festival | **No** | 44 (parser artifacts in structured) |
| Vision Ekstase | Yes | empty |
| PURE TECHNO | Yes | empty |
| KitKatClub | Yes | empty |

## 5. Controlled repair

| Pass | Mutations |
|------|-----------|
| Pass 1 | **7** (cleared stale `events.artist_id` prose blobs) |
| Pass 2 | **0** (idempotent) |

Cleared primary artist on: CHROME COLOGNE, MDMA Proton Stuttgart, Bootshaus Sommerfest, AFFENKÄFIG, Bootshaus on a Ship IV, BC173 Airport Session, Sommerfest Closing.

## 6. Before / after metrics

| Metric | Before | After |
|--------|--------|-------|
| Published events | 108 | 108 |
| API prose violations | 0 | **0** |
| Primary artist fallbacks | 7 | **0** |
| Structured lineup events | 72 | 72 |
| Compatibility-only events | 0 | 0 |
| Empty lineup events | 36 | 36 |
| API/UI projection mismatches | 18 | 18* |

\*Remaining mismatches are structured data quality issues (invalid names still in DB entries but filtered differently between flat list vs billing row expansion). Representative events all pass except Blacklist Festival.

## 7. Remaining evidence blockers (pre-4.7)

1. **Blacklist Festival** — 44 structured entries contain parser artifacts (`ON:MODE....MORE TBA`, HTML entities); needs evidence-backed re-extraction, not projection repair
2. **Bootshaus on a Ship IV** — no structured evidence; detail page blocked
3. **Vision Ekstase / PURE TECHNO** — detail blocked; no lineup evidence
4. **LOONYLAND** — duplicate artist entity variant (`SPADA FORA` vs `SPADAFORA`); entity merge required
5. **~18 events** — structured DB contains title-fragment artist names that pass partial gate but fail API/UI alignment; fixed at read for consumers, DB cleanup deferred to evidence repair

## 8. Flyer reconciliation recommendation (Phase 4.7)

- Use accepted flyer evidence as **structured candidate input only** via import pipeline
- Never inject flyer/title/description text into API read fallbacks
- Blocked detail pages (Vision Ekstase, PURE TECHNO, Bootshaus Vol IV) are primary candidates for flyer reconciliation
- After flyer acceptance, writes go through `writeCanonicalStructuredLineup` only; reads through `readCanonicalLineup` only

## Ops script

`scripts/operations/_phase4693-projection-truth.ts`

Commands: `inventory | audit | repair | cache-check | report | full`
