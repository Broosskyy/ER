# Phase 4.4 — Event Data Integrity, Source Merge Audit & Canonical Field Repair

Generated: 2026-08-01  
Production audit artifact: `docs/real-data/_sprint44_field_integrity_audit.json`

## Executive Summary

Phase 4.4 investigated description loss, multi-origin merge behavior, and canonical field integrity across all active production sources. The investigation is **evidence-based** — no production mutation was performed.

**Primary finding:** Bootshaus website events never received descriptions at the connector level (`maxDetailPages: 0`). Ticket.io enrichment added prices/tickets but could not supply descriptions from list JSON-LD (`N/A`). Historical repair runs **cleared** placeholder descriptions to empty strings via `resolveFillOnlyText`, making descriptions disappear in the UI.

**Phase 4.4 code fix:** `resolveFillOnlyText` and `resolvePrimaryDescriptionUpdate` now **never downgrade** existing text. Title-derived artists are included in canonical lineup projection when structured lineup is missing.

---

## 1. Root Cause of Lost Descriptions

### Evidence chain (Bootshaus cluster)

| Stage | PLAY! Open Air | Evidence |
|-------|----------------|----------|
| Website connector | No description | `source-bootshaus-koeln`: `maxDetailPages: 0`, no `descriptionSelector` (Sprint 13 seed + live DB) |
| Normalization | N/A stripped | `EventNormalizer` drops ticket.io placeholder descriptions |
| Import record | No meaningful description | Audit: `importPlaceholderOnly` for 18/20 traced samples |
| Ticket.io enrichment | Price/ticket added | `priceText: "Tickets ab 18,00 Euro"`, `ticketUrl` from ticket.io |
| Merge (enrichment) | Fill-only path | `buildEnrichmentAdminEvent` — description unchanged when incoming empty |
| **Historical repair bug** | **N/A → ''** | `resolveFillOnlyText('N/A', undefined)` returned `''` before Phase 4.4 |
| Canonical event | Empty/placeholder | Audit: 18/20 traced samples `publishedPlaceholder` |
| Projection | Hidden if placeholder | `sanitizeEventDescription` strips N/A/empty |
| Frontend | No description shown | `sanitizedDescription` undefined |

### Contrasting source: Affenkäfig

`Sommerfest Elektroküche` retains full HTML description end-to-end because `source-affenkaefig` has `maxDetailPages: 50` and fetches detail pages.

### Recovery assessment

| Source | Recoverable from import records? |
|--------|----------------------------------|
| Bootshaus website events | **No** — import records contain no meaningful description |
| Affenkäfig website events | **Yes** — descriptions present in normalized_payload |
| Ticket.io-only shops | **Only when detail fetch ran** — list JSON-LD is `N/A` |

Git history confirms Bootshaus website config had `maxDetailPages: 0` since `20260744000000_sprint13_production_integration.sql`. Descriptions visible in early testing likely came from fixture HTML or manual seeds, not live detail fetch.

---

## 2. Root Cause of Missing Genres

- Bootshaus list connector does not extract genres (`genreNames` not in html_selector config).
- Ticket.io list rows expose genre in overview text (`GENRE DRUM AND BASS`) but genre is not mapped to `genreNames` on all shops.
- `events.genre_id` is single-value legacy field; multi-genre `genres[]` on consumer model depends on import mapping which is sparse for ticket.io-only events.
- **No merge downgrade** — genres were never populated at source, not erased by enrichment.

---

## 3. Root Cause of Missing Lineups

| Cause | Evidence |
|-------|----------|
| Website list-only import | No artist extraction on Bootshaus list page |
| Ticket.io list JSON-LD | `performer: "Unbekannt"` on list; detail fetch required for lineup |
| `event_artists` not written | Bootshaus website publish path did not create lineup rows |
| Title parser limitation | `122 pres. JUNO @ Palma` → `JUNO @ Palma de Mallorca (ES` (over-capture) |

**Phase 4.4 fix:** `resolveKnownArtistNames` now falls back to title-derived artists for projection when structured lineup is empty. Events with title artists no longer show `lineupCompleteness: none`.

---

## 4. Root Cause of Missing Venue Data

- Bootshaus external-location events (Mallorca, etc.): fixed in Phase 4.3.4 geography repair — audit shows 0 `wrongBootshausExternalVenue` remaining.
- Ticket.io-only events: venue from JSON-LD `location.name` — present but `venueId` often unset (suggested venue, not linked entity).
- Ticket.io `auto_publish` shops use shop defaults when event location is generic.

---

## 5. Root Cause of Wrong Merges

| Pattern | Cause | Status |
|---------|-------|--------|
| Ticket.io overwriting website description | Would occur if `behavior: auto_publish` on enrichment source | Bootshaus ticket.io correctly set to `enrichment` |
| Placeholder cleared to empty | `resolveFillOnlyText` N/A-clear branch | **Fixed Phase 4.4** |
| Price parity mismatch | `formatDisplayPriceText` vs raw `priceText` | 12 parity issues in audit (display formatting, not data loss) |
| Provider "Externe Quelle" | Unknown ticket URL host mapping | 12 events — label mapping gap |

---

## 6. Field Ownership Matrix

Implemented in `src/features/events/domain/source-field-ownership-matrix.ts`.

| Field | Website | Ticket.io | Merge rule |
|-------|---------|-----------|------------|
| description | ★★★★★ | ★★★☆☆ | never_downgrade |
| venueName | ★★★★★ | ★★☆☆☆ | owner_wins |
| ticketUrl | ★★☆☆☆ | ★★★★★ | owner_wins |
| priceText | ★☆☆☆☆ | ★★★★★ | fill_only |
| lineup | ★★★★☆ | ★★★★☆ | highest_quality |
| imageUrl | ★★★★☆ | ★★★☆☆ | highest_quality |
| genres | ★★★☆☆ | ★★☆☆☆ | never_downgrade |

Existing `FIELD_OWNERSHIP_RULES` in `field-ownership-policy.ts` remains the runtime tier authority. The new matrix adds per-source-type ratings for audit/documentation.

---

## 7. Description Recovery Results

Production read-only scan (114 published events, 20 validation samples):

| Metric | Count |
|--------|-------|
| Published meaningful descriptions | 2 |
| Published placeholder/empty | 18 |
| Import records with recoverable description | 2 (Affenkäfig cluster) |
| Import placeholder only | 18 |
| Projection hiding meaningful DB text | 0 |

**Conclusion:** Bulk description recovery for Bootshaus events is **not possible** from existing import records. Recovery requires re-fetching Bootshaus event detail pages (connector config change + re-import) or successful Ticket.io detail HTML fetch.

---

## 8. Ticket.io Info Tab Analysis

### Structure (from fixtures + adapter code)

| Source | Description | Lineup | Availability |
|--------|-------------|--------|--------------|
| List JSON-LD | `N/A` placeholder | `performer: Unbekannt` | Price overview text |
| Detail HTML JSON-LD | Real description | `performer[]` array | `offers[]` with phases |
| HTML lineup section | — | `<ul class="event-lineup">` | — |

### Info tab accessibility

- **JSON-LD embedded in detail page HTML:** Accessible — `parseTicketIoDetailHtml` extracts description, performers, offers (see `ticket-io-proton-shockone-detail-enriched.html` fixture).
- **Separate Info tab XHR:** Not implemented; not probed against live anti-bot in this phase.
- **List-only fetch:** Cannot access Info tab content — detail page fetch required.
- **PoW/bot protection:** `isTicketIoPowChallengePage` detected and blocks parse — documented blocker.

### Recommendation

Extend connector to ensure detail fetch runs for all managed ticket.io shops (within rate limits). Info tab content is available via the same detail HTML when not blocked by PoW. No ToS bypass required for JSON-LD already in page source.

---

## 9. Canonical Merge Validation

Expected merge for Bootshaus Website + Ticket.io enrichment:

| Field | Expected owner | Production status |
|-------|----------------|-------------------|
| Description | Website | Missing at source — not a merge failure |
| Ticket URL | Ticket.io | ✅ Present |
| Prices | Ticket.io | ✅ Present |
| Venue | Website | ✅ Bootshaus default / explicit geography |
| Organizer | Website | Defaults applied |
| Image | Highest quality | List image from website |

Affenkäfig + Ticket Kings: description preserved through full pipeline ✅

---

## 10. Production Validation (sample events)

| Event | Description | Lineup | Ticket/Price |
|-------|-------------|--------|------------|
| PLAY! Open Air | Empty (no source) | Title-derived (Phase 4.4) | ✅ ticket.io |
| Bootshaus Sommerfest | Empty | Partial | ✅ |
| Elektroküche Sommerfest | ✅ meaningful | Partial | ✅ Affenkäfig |
| WESTBAM SAVE THE RAVE | Placeholder | ✅ title artists | ✅ |
| TECHNO DAMPFER | Placeholder | ✅ 1 lineup row | ✅ |
| Affenkäfig A8 | Empty | Empty | ✅ |

Full traces: `_sprint44_field_integrity_audit.json` → `sampleTraces[]`

---

## 11. Regression Results

```
✓ sprint44-field-integrity.test.ts — 6/6
✓ sprint431-ticket-io-production-repair.test.ts — 5/5 (updated never-downgrade)
✓ sprint433-canonical-projection.test.ts — 10/10
```

### Code changes (Phase 4.4)

| File | Change |
|------|--------|
| `ticket-io-repair.ts` | `resolveFillOnlyText` never downgrades |
| `import-update-service.ts` | `resolvePrimaryDescriptionUpdate` never clears placeholder |
| `canonical-event-projection.ts` | Title-derived artist fallback |
| `source-field-ownership-matrix.ts` | Explicit per-field matrix |
| `_sprint44-field-integrity-audit.ts` | Read-only production trace |

---

## 12. Remaining Limitations

1. **Bootshaus website detail fetch disabled** — descriptions cannot appear without enabling `maxDetailPages` + description selector on event detail URLs.
2. **Ticket.io list-only shops** — Lehmann, Area51, Technodampfer, HMG use `auto_publish` without guaranteed detail enrichment.
3. **Title artist parser** — `122 pres. JUNO @ Palma` over-captures location suffix; needs parser refinement.
4. **Genre mapping** — ticket.io overview genre text not mapped to `genreNames`.
5. **Historical empty descriptions** — require safe repair plan apply (Phase 4.3 repair orchestrator) after detail re-fetch, not bulk SQL.
6. **Provider label gaps** — 12 events show "Externe Quelle" for unmapped ticket hosts.

---

## Success Criteria Status

| Criterion | Status |
|-----------|--------|
| Evidence-based root cause | ✅ Documented with production traces |
| No source downgrades another | ✅ Fixed in merge layer (Phase 4.4) |
| Field-based trust | ✅ Matrix + existing tier policy |
| Lineup priority | ✅ Title-derived fallback in projection |
| No new platforms/sources | ✅ |
| Tests green | ✅ |

**Next recommended step (out of Phase 4.4 scope):** Enable Bootshaus website detail page fetch and re-import via read-only repair plan — not production apply in this phase.
