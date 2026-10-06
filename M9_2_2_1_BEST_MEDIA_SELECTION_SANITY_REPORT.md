# M9.2.2.1 — Best Media Selection Sanity Check

**Status:** `M9_2_2_1_BEST_MEDIA_SELECTION_SANITY_VERIFIED`

**Branch:** `rebuild/event-core-clean`  
**Baseline:** `ab5051f`  
**Staging:** `gnkjzinwvmrxcadwebhv`  
**Production mutations:** `0`  
**M9.3B:** NOT STARTED

---

## 1. Executive Summary

M9.2.1/M9.2.2 gates previously treated **valid event images** as sufficient. Underland exposed a real gap: an **Early-Bird announcement** from Affenkäfig was kept over a **full TicketKings lineup flyer** with 12+ billed artists.

**Root cause (generic, not Underland-specific):**

1. `_EB_` Quada filenames were not classified as announcement/early-bird media; unreadable-OCR fallback even promoted `_eb_` URLs toward flyer types.
2. Stale OCR falsely parsed `EARLY BIRD` marketing text as lineup acts (`ARLY`, `BIRD`), inflating official scores.
3. Verified ticket-provider images were not OCR-enriched for scoring, so richer supplemental flyers scored as `unknown` with zero lineup acts.

**Fix applied:** generic classifier + ticket-image OCR enrichment + cached evidence attachment in candidate collection. Staging reconciled; second run idempotent.

---

## 2. Underland Golden Case — Live Visual Audit

### Candidate A — Affenkäfig Official (was canonical before fix)

| Field | Value |
|-------|-------|
| Source URL | `https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/` |
| Image URL | `https://affenkaefig.info/wp-content/uploads/2026/07/05.09.26_QUADA_EB_ULand_WEB2.jpg` |
| **Classification (corrected)** | **`announcement_flyer`** (Early-Bird marketing; filename `_EB_`) |
| Visible title | UNDERLAND |
| Visible date | 05.09.2026 |
| Visible venue | Essigfabrik / Elektroküche, Siegburger Str. 110 Köln |
| Visible lineup | **None** — large “EARLY BIRD” CTA only |
| Ticket marketing | Prominent Early-Bird phase creative |
| Information density | Low (announcement / phase marketing) |
| Event specificity | High (title, date, venue) |
| Dimensions / quality | 1030×1030, square announcement |
| Identity confidence | exact_match |

**Q: Is this Early-Bird/announcement media?** **Yes** — visually dominated by “EARLY BIRD”; no artist billing.

### Candidate B — TicketKings Verified Supplemental

| Field | Value |
|-------|-------|
| Source URL | `https://ticketkings.de/event/underland-essigfabrik-05-09-2026/` |
| Image URL | `https://ticketkings.de/wp-content/uploads/2026/04/original-20260522-134011-7db369482b94.jpg` |
| **Classification** | **`lineup_flyer`** |
| Visible title | UNDERLAND |
| Visible date | 05.09.2026 |
| Visible venue | Essigfabrik / Elektroküche |
| Visible lineup | **12+ artists** (ACINA, BASSSTØRM, JEYPIEH, KULISCHKIN, MILØ, MIXXR, NIKKEL, OPOSITION, REFLEXX, VERNEX, SICK IMPACT VS RENEX, SITTENLOS VS TERREURSQUAD, …) |
| Ticket marketing | None on flyer (informational lineup creative) |
| Information density | **High** |
| Event specificity | High |
| Dimensions / quality | Full multi-column lineup layout, high resolution |
| Identity confidence | strong_match (ticket_identity_verified) |

**Q: Is TicketKings image a fuller lineup flyer?** **Yes.**

### Scoring Outcome

| Question | Answer |
|----------|--------|
| Which should win per generic M9.2.1 scoring? | **TicketKings lineup flyer** |
| Which won before fix? | Affenkäfig EB (`existing_image_already_best`, false `lineup_flyer`) |
| Which wins after fix? | **TicketKings lineup flyer** (`verified_ticket_provider;lineup_flyer;score≈146`) |
| Why did official win before? | EB misclassified as lineup + OCR phantom acts + ticket image unscored |
| Consumer verified after fix? | **Yes** |

---

## 3. Multi-Candidate Events (full audit, not sample)

`multiCandidateEventsAudited = 3`

| Event | Candidate A | Class A | Candidate B | Class B | Selected Before | Best Verified | Selected After | Reason | Consumer Verified |
|-------|-------------|---------|-------------|---------|-----------------|---------------|----------------|--------|-------------------|
| underland-essigfabrik-05-09-2026 | Affenkäfig EB JPG | announcement_flyer | TicketKings lineup JPG | lineup_flyer | Affenkäfig EB | TicketKings lineup | TicketKings lineup | EB penalty + ticket OCR lineup richness | yes |
| mdma-musik-die-mich-antreibt-10-10-26 | Affenkäfig EB JPG | announcement_flyer | TicketKings LineUP JPG | lineup_flyer | TicketKings (already) | TicketKings LineUP | TicketKings LineUP | Lineup flyer beats EB announcement | yes |
| halloween-weekender | Affenkäfig “Ticket-infos-soon” placeholder | decorative_image | TicketKings header JPG | unknown (1 act OCR) | TicketKings (already) | TicketKings header | TicketKings header | Placeholder rejected; verified ticket media wins | yes |

```
multiCandidateEventsWithWrongSelection = 0
validButInferiorCanonicalImages = 0
wrongMediaClassifications = 0
wrongEventImagesRemaining = 0
allSelectedMediaAreBestVerifiedCandidates = true
underlandBestMediaVerified = true
```

---

## 4. Canonical Event / Count Model

```
activeCanonicalEvents = 31
canonicalEventsMissingMediaAudit = 0
```

| Metric | Value | Meaning |
|--------|-------|---------|
| M9.2.1 `totalEventsAudited` | 31 | One media audit row per **source binding preview** (Affenkäfig + Bootshaus lists combined) |
| M9.2.1 `bootshausEventsMediaAudited` | 24 | Bootshaus-official connector discoveries |
| M9.2.1 `affenkaefigEventsMediaAudited` | 7 | Affenkäfig-official connector discoveries |
| M9.2 `bootshausEventsVerified` | 25 | Bootshaus **consumer readback** events rendered (DB-backed display surface) |
| M9.2 Affenkäfig verified | 6 + 1 review_required | Identity review on dual-source rules event; 0 unresolved mismatches |

**Why 25 Bootshaus verified vs 24 media-audited?**

These measure different layers:

- **Media audit (24)** counts Bootshaus-official **connector preview keys** in the combined matrix.
- **Consumer verified (25)** counts events the Bootshaus **consumer read path** renders from staging DB (includes venue-visible events whose primary ingestion binding may be another connector but still surface on Bootshaus).

Not a missing audit: `24 + 7 = 31` covers every active source binding row. The +1 on consumer readback is cross-surface visibility, not a skipped media audit.

**Dual-source example:** `Underland` has `source_count = 2` in staging inventory (Affenkäfig + ticket provenance). Media audit appears once under Affenkäfig-official; consumer may surface through multiple read paths.

---

## 5. Generic Code Changes

| File | Change |
|------|--------|
| `classify-event-media-type.ts` | `_EB_`/early-bird URL + OCR text → `announcement_flyer`; removed `_eb_` from unreadable flyer promotion |
| `collect-event-media-candidates.ts` | Attach cached/reparsed OCR for ticket-provider images; lineup act count from ticket OCR |
| `enrich-official-evidence.ts` | `enrichVerifiedTicketProviderMediaImage()` — OCR enrich supplemental ticket flyers |
| `finalize-official-event-evidence.ts` | Run ticket-image OCR before media reconciliation |
| `event-media-selection.test.ts` | EB classification + Underland-style selection regression |

No Underland hardcoding.

---

## 6. Staging Apply + Idempotency

```
Affenkäfig gate:
  firstRunConsumerWrites = 1   (Underland canonical image → TicketKings lineup flyer)
  secondRunConsumerWrites = 0
  productionMutations = 0

M9.2.1 media verification (post-fix):
  wrongEventImagesRemaining = 0
  unresolvedMediaMismatch = 0
  supplementalImagesSelected = 3
  secondRunMediaWrites = 0
  secondRunConsumerWrites = 0
  productionMutations = 0
```

---

## 7. Tests

| Suite | Result |
|-------|--------|
| `test:connectors` | 187 passed |
| `test:ingestion` | 80 passed |
| `typecheck` | pass |
| `git diff --check` | pass |

---

## 8. Completion Gates

| Gate | Status |
|------|--------|
| `multiCandidateEventsAudited = 3` | ✅ |
| `multiCandidateEventsWithWrongSelection = 0` | ✅ |
| `validButInferiorCanonicalImages = 0` | ✅ |
| `wrongMediaClassifications = 0` | ✅ |
| `wrongEventImagesRemaining = 0` | ✅ |
| `allSelectedMediaAreBestVerifiedCandidates = true` | ✅ |
| `underlandBestMediaVerified = true` | ✅ |
| `activeCanonicalEvents = 31` | ✅ |
| `canonicalEventsMissingMediaAudit = 0` | ✅ |
| `productionMutations = 0` | ✅ |
| `secondRunMediaWrites = 0` | ✅ |

**M9.3B NOT STARTED.**
