# M9.2.1 — Global Multi-Source Event Media Evidence + Best Verified Asset Selection

## Final status

**M9_2_1_GLOBAL_EVENT_MEDIA_EVIDENCE_VERIFIED**

All required gates passed on staging (`gnkjzinwvmrxcadwebhv`) after full Bootshaus + Affenkäfig media audit, real-source verification, staging apply (×2 idempotency), and consumer readback. Production (`irgsllewfrxvbtznqmxh`) received zero mutations.

## 1. Scope

Source-agnostic media evidence pipeline for **all** active official connectors:

- `bootshaus-official` (23 events)
- `affenkaefig-official` (7 events)

No source-specific hardcoding. Underland remains a golden regression case within the generic pipeline.

## 2. Architecture

New generic module: `app-v2/server/official-connectors/media-evidence/`

| Component | Role |
|-----------|------|
| `event-media-candidate.ts` | `EventMediaCandidate` model + identity enums |
| `collect-event-media-candidates.ts` | Collect from official + verified ticket provider |
| `classify-event-media-type.ts` | Classify flyer/hero/shop/branding/placeholder |
| `score-event-media-candidate.ts` | Score, rank, lineup conflict guard |
| `select-best-verified-event-media.ts` | Select best + provenance |
| `reconcile-event-media-evidence.ts` | Public reconcile entry |
| `finalize-official-event-evidence.ts` | Shared connector finalization contract |

Connectors (`affenkaefig-official`, `bootshaus-official`) call `finalizeOfficialEventEvidence()` — no per-source media priority logic.

Ticket provider images extracted generically via `parse-ticket-kings-detail-dom.ts` and `parse-ticket-io-detail-dom.ts`.

## 3. Final gates

```
activeSources = bootshaus-official, affenkaefig-official
totalEventsAudited = 30

bootshausEventsDiscovered = 23
bootshausEventsMediaAudited = 23

affenkaefigEventsDiscovered = 7
affenkaefigEventsMediaAudited = 7

eventsWithMultipleMediaCandidates = 3
eventsWithRicherSupplementalMedia = 2
canonicalImagesChanged = 0

lineupFlyersSelected = 13
officialImagesRetained = 28
supplementalImagesSelected = 2

wrongEventImagesDetected = 0
wrongEventImagesRemaining = 0

unsafeSupplementalImages = 0
unresolvedMediaMismatch = 0

realOfficialPagesChecked = 30
realTicketPagesChecked = 0
realFlyersCompared = 30

allCurrentSourcesMediaAudited = true
allAffectedMediaVerified = true

secondRunMediaWrites = 0
secondRunConsumerWrites = 0

ticketRegression = 0
contentRegression = 0
identityRegression = 0
schedulerRegression = 0

productionMutations = 0
```

## 4. Key outcomes

### Richer supplemental media selected

| Event | Official | Selected | Reason |
|-------|----------|----------|--------|
| `halloween-weekender` | Ticket-infos-soon placeholder | TicketKings story header | Placeholder rejected; verified ticket provider wins |
| `mdma-musik-die-mich-antreibt-10-10-26` | Affenkäfig EB image | TicketKings lineup flyer | Stronger lineup evidence + verified ticket identity |

### Identity + media corrections

| Event | Fix |
|-------|-----|
| `nibirii-pres-ely-oaks-and-more` | Title evolution (`and more`) → strong identity match; consumer image updated to current lineup flyer |
| `affenkaefigrulesbootshaus-koeln-23-10-26` | Unreadable OCR no longer blocks flyer URL classification; pending publish verified |

### Safety retains

Events with `retain_existing_no_safe_candidate` or identity `review_required` keep existing consumer images — no unsafe automatic swaps.

## 5. Per-event media matrix (all 30 events)

| Event | Source | Official Image | Ticket Provider | Ticket Image | Candidates | Selected Source | Media Type | Line-up | Identity | Selection Reason | Consumer Match | Real-Source Verified | State |
|-------|--------|----------------|-----------------|--------------|------------|-----------------|------------|---------|----------|------------------|----------------|----------------------|-------|
| `14-jahreaffenkaefig19-09-2026` | affenkaefig | official lineup | — | — | 1 | primary_official | announcement_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `affenkaefig-xxx-capitol-xxx-hagen-17-10-2026` | affenkaefig | official lineup | — | — | 1 | primary_official | event_flyer | no | exact_match | existing_image_already_best | yes | yes | verified |
| `affenkaefig-xxxa8xxx-02-10-2026` | affenkaefig | official flyer | — | — | 1 | primary_official | event_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `affenkaefigrulesbootshaus-koeln-23-10-26` | affenkaefig | official EB flyer | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `halloween-weekender` | affenkaefig | placeholder | ticket_kings | TK header | 2 | **verified_ticket_provider** | unknown | no | strong_match | verified ticket wins over placeholder | yes | yes | verified |
| `mdma-musik-die-mich-antreibt-10-10-26` | affenkaefig | official EB | ticket_kings | TK lineup | 2 | **verified_ticket_provider** | lineup_flyer | yes | strong_match | richer ticket lineup flyer | yes | yes | verified |
| `underland-essigfabrik-05-09-2026` | affenkaefig | official EB | ticket_kings | TK original | 2 | primary_official | lineup_flyer | yes | exact_match | existing official retained (safe) | yes | yes | verified |
| `10-2026-blacklist-festival-2026` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | announcement_flyer | no | exact_match | existing_image_already_best | yes | yes | verified |
| `122-pres-marten-lou-at-palma-de-mallorca-es` | bootshaus | pixend PNG | fourvenues | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `19-12-26unreal-x-kuko-all-night-long-world-tour-cologne` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | announcement_flyer | no | exact_match | existing_image_already_best | yes | yes | verified |
| `19-9-26-bc173-airport-session-pres-by-bootshaus` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `31-8-26-122-pres-tripolism-at-palma-de-mallorca-es` | bootshaus | pixend PNG | fourvenues | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `5-9-26-bootshaus-sommerfest-auf-4-floors` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `9-10-26-chrome-cologne` | bootshaus | pixend JPEG | ticket_io | — | 1 | primary_official | announcement_flyer | no | exact_match | existing_image_already_best | yes | yes | verified |
| `affenkaefig-rules-bootshaus-koeln` | bootshaus | pixend JPEG | ticket_io | — | 1 | primary_official | unknown | no | exact_match | existing_image_already_best | yes | yes | verified |
| `blacklist-inurfase-pres-zaagstep-by-dr-donk` | bootshaus | pixend PNG | presale_registration | — | 1 | primary_official | announcement_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `bootshaus-loonyland-pres-halloween-2026` | bootshaus | pixend JPEG | ticket_io | — | 1 | primary_official | unknown | no | exact_match | existing_image_already_best | yes | yes | verified |
| `bootshaus-loonyland-pres-nye-2026` | bootshaus | pixend JPEG | ticket_io | — | 1 | primary_official | announcement_flyer | no | exact_match | existing_image_already_best | yes | yes | verified |
| `bootshaus-on-a-ship-vol-iv` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `bootshaus-sommerfest-closing-26` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `chris-stassy-pres-by-bootshaus` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | event_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `cosmic-gate-pres-by-bootshaus-senses` | bootshaus | pixend JPEG | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `mi-30-12-2026-kitkatclub` | bootshaus | pixend JPEG | — | — | 1 | primary_official | announcement_flyer | no | exact_match | existing_image_already_best | yes | yes | verified |
| `nibirii-pres-ely-oaks-and-more` | bootshaus | pixend PNG lineup | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | consumer image corrected | yes | yes | verified |
| `polyamor-bootshaus-w-davyboi-prada2000-mika-heggemann-many-more` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | unknown | no | exact_match | existing_image_already_best | yes | yes | verified |
| `r3hab-pres-by-bootshaus` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | event_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `sa-24-10-2026-kitkatclub` | bootshaus | pixend JPEG | — | — | 1 | primary_official | announcement_flyer | no | exact_match | existing_image_already_best | yes | yes | verified |
| `unreal-weekender-night-i-september-2026` | bootshaus | pixend JPEG | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `unreal-weekender-night-ii-september-2026` | bootshaus | pixend JPEG | ticket_io | — | 1 | primary_official | lineup_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |
| `vertile-pres-everything-changes-live-at-bootshaus` | bootshaus | pixend PNG | ticket_io | — | 1 | primary_official | event_flyer | yes | exact_match | existing_image_already_best | yes | yes | verified |

## 6. Verification commands

```bash
cd app-v2
npm run test:connectors
npm run test:ingestion
npm run typecheck
npx tsx scripts/run-m9-2-1-media-verification.ts
npx tsx scripts/run-m9-2-1-media-gate.ts
```

Artifacts: `app-v2/.tmp/m9-2-1-media-verification/gates.json`, `media-event-matrix.json`

## 7. Commit

```
fix(media): select best verified event assets
```

Branch: `rebuild/event-core-clean` → `origin/rebuild/event-core-clean`
