# Phase 4.5.3 — Production Readiness Gate Report

**Date:** 2026-08-01  
**Scope:** Four production-readiness blockers from Phase 4.5.2 (field-trust flag, moderation provenance, price semantics, typecheck split). No new sources, no pipeline redesign.

---

## 1. Legacy vs field-trust comparison result

**Production read-only audit:** `scripts/operations/_sprint453-field-trust-comparison.ts`  
**Artifact:** `docs/real-data/_sprint453_field_trust_comparison.json`

| Metric | Value |
|--------|-------|
| Published events compared | 99 |
| Identical legacy/trust outcomes | 99 |
| Unexpected differences | 0 |
| Potentially destructive | 0 |
| Manual-lock conflicts | 0 |
| **safeToEnable** | **true** |

Comparison replays each event's **primary-source** import candidate (matched by `event.sourceId`) through `importUpdateService` (legacy) vs `fieldTrustMergeService` (trust), with live provenance loaded. ISO date strings normalize before diff (`2026-08-22T15:15:00.000Z` ≡ `...+00:00`).

---

## 2. Unexpected differences found and fixed

| Issue | Resolution |
|-------|------------|
| ISO `Z` vs `+00:00` flagged as unexpected | `field-trust-comparison-service.ts` normalizes instants before compare |
| Wrong import record used when multiple origins on one event | Ops script prefers `import_records.source_id === event.sourceId` |
| Bare `0` / `0 €` treated as free | `event-price-availability-semantics.ts` requires explicit free wording |
| Missing `EXPLICIT_ZERO_FREE_PATTERN` reference | Removed; zero-only prices → `unknown` |

No destructive field regressions found in production replay.

---

## 3. Production feature-flag status

| Setting | Value |
|---------|-------|
| `EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE` | **`true`** (enabled) |
| Documented in | `.env.example` |
| Comparison recommendation | `recommendedFlagValue: "true"` |

**Action required for live deployment:** set `EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE=true` in the production Expo/EAS environment (same variable as staging). Client bundles read this at build time.

---

## 4. Manual-lock validation

- Field-trust merge skips fields where `provenance.selectedSourceId === 'manual_override'`.
- Comparison service reports `blocked_manual_lock` category when locks would diverge.
- Production audit: **0** manual-lock conflicts across 99 events.
- Moderation publish now writes `manual_override` provenance for all approved fields (see §6).

---

## 5. Moderation paths audited

| Path | Provenance before | Provenance after 4.5.3 |
|------|-------------------|------------------------|
| Contributor submit → approve → publish | ❌ direct `save` only | ✅ `writeFromModerationPublish` |
| Contributor request changes / reject | N/A (no publish) | unchanged |
| Import review publish | ✅ `writeFromPublish` | unchanged |
| Import auto-publish | ✅ `writeFromPublish` | unchanged + field-trust when flag on |

**Not in scope (no active path):** organizer-submitted events, community-reported publication — schema supports same writer when added.

---

## 6. Moderation provenance implemented

- `EventFieldProvenanceWriter.writeFromModerationPublish()` — all `PUBLISH_TRACKED_FIELDS` with:
  - `selectedSourceId: manual_override`
  - `selectionReason: moderation_publish_approved:moderator=…:contributor=…`
  - `selectedTier: community`, `confidence: 1`
  - contributor value in `alternatives`
- `AdminEventModerationService.publishContributorEvent()` calls provenance writer + `invalidateConsumerEventCaches()`.
- Registry wires `eventFieldProvenanceWriter` + `eventRepository`.

**Tests:** `sprint453-moderation-provenance.test.ts` (provenance written + lower-trust import blocked).

---

## 7. Free-price semantic contract

**Module:** `src/features/events/domain/event-price-availability-semantics.ts`

| `priceState` | Rule |
|--------------|------|
| `paid` | Parsed currency amount or priced text |
| `free` | Explicit free/kostenlos/gratis/eintritt frei only |
| `unknown` | Missing price, Abendkasse note, price on request |
| `unavailable` | Sold-out / sales-ended price text |

Missing price **≠** free. Bare `0` **≠** free without explicit semantics.

---

## 8. Sold-out semantic contract

| `availabilityState` | Rule |
|---------------------|------|
| `sold_out` | Sold-out text, lifecycle, ticket status, or all phases sold out |
| `limited` | Limited/wenige text or phase labels |
| `available` | On sale / external link / remaining phase available |
| `unavailable` | Sales ended / not available |
| `unknown` | Default |

One sold-out phase does **not** mark whole event sold out if another phase remains available.

---

## 9. Public surfaces migrated to shared semantics

| Surface | Change |
|---------|--------|
| `event-status-resolver.ts` | Uses `resolveEventPriceAvailabilitySemantics` + `toDiscoveryTicketStatus` |
| `discovery-filter-predicates.ts` | `isSemanticallyFreeEvent` for free filter |
| `map-discovery-selectors.ts` | Free-only map filter via shared resolver |
| `canonical-event-projection.ts` | Price display + sold-out from semantics |

Cards, detail, saved, search consume projection/`resolveEventPresentation` — no independent free/sold-out heuristics remain in those paths.

**Color tokens:** `accent` (paid), `success` (free/available), `unavailable` (sold out), `muted` (unknown).

---

## 10. Typecheck errors fixed

| Target | Config | Status |
|--------|--------|--------|
| Application | `tsconfig.app.json` (excludes `scripts/**`, `**/__tests__/**`) | **93 pre-existing errors** remain (Supabase row typing, legacy connector exports) — not introduced by 4.5.3 |
| Operations | `tsconfig.operations.json` (active scripts only, relaxed strictness) | Pulls app via imports; same baseline |
| Fixed in 4.5.3 | `registry.ts` `sourceUrl`, `source-events-admin-service.ts` guards, `format-ticket-price.ts` |

`npm run typecheck` = `typecheck:app` + `typecheck:operations`.

---

## 11. Explicitly excluded historical scripts

See `scripts/operations/HISTORICAL_SCRIPTS.md` — pre-4.5 one-off Bootshaus/Affenkaefig/sprint33 scripts excluded from operations typecheck. Active sprint 4.5+ and `run-*` workers are included.

---

## 12. Production sample validation

Comparison + spot checks (artifact includes Affenkäfig, Bootshaus, Ticket.io, MDMA events):

| Sample | Result |
|--------|--------|
| Affenkäfig events | identical |
| Bootshaus / Ticket.io enrichment | identical |
| TECHNO DAMPFER / Ticket.io shops | identical |
| MDMA (Musik die mich antreibt) | identical |
| Multi-origin (primary-source replay) | identical |

Ticket URLs, descriptions, Mallorca geography: no regressions in comparison. Manual moderation path validated in unit tests.

---

## 13. Full test result

```
Test Files  279 passed (279)
Tests       1380 passed (1380)
```

New: `sprint453-price-availability-semantics`, `sprint453-field-trust-comparison`, `sprint453-moderation-provenance`.

---

## 14. Expo Web result

`npm run build:web` — **passed** (exported to `dist/`).

---

## 15. Remaining blockers before Phase 5

| Blocker | Severity | Notes |
|---------|----------|-------|
| Application typecheck not zero-error | Medium | Requires generated Supabase `Database` types + connector type cleanup (~93 errors, pre-existing) |
| Production env flag rollout | Low | Set `EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE=true` on production build profile |
| Historical ops scripts untyped | Low | Documented exclusion; use `npx tsx` for replay |

**Phase 5 may proceed** on functional gates: field-trust validated, moderation provenance live, semantics unified, **1380/1380** tests green, production comparison clean.

---

## Files added/changed (summary)

- `event-price-availability-semantics.ts`, `field-trust-comparison-service.ts`
- `_sprint453-field-trust-comparison.ts`
- `event-field-provenance-writer.ts` (moderation publish)
- `admin-event-moderation-service.ts`, `registry.ts`
- `tsconfig.app.json`, `tsconfig.operations.json`, `package.json` typecheck scripts
- `.env.example` flag default `true`
