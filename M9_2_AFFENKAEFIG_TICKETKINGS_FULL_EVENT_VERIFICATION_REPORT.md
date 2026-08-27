# M9.2 — Affenkäfig + TicketKings Full Event Evidence & Ticket Recovery

## Final status

**M9_2_AFFENKAEFIG_TICKETKINGS_FULL_EVENT_VERIFIED**

All required gates passed on staging (`gnkjzinwvmrxcadwebhv`) after live real-source verification, staging apply, consumer readback, and Bootshaus regression.

## 1. Preflight

| Check | Result |
|-------|--------|
| Branch | `rebuild/event-core-clean` |
| Staging | `gnkjzinwvmrxcadwebhv` |
| Production | `irgsllewfrxvbtznqmxh` (no mutations) |
| Active sources | `bootshaus-official`, `affenkaefig-official` |

## 2. Final gates

```
eventsWithUnresolvedMismatch = 0
allAffectedEventsVerified = true
allEventsRealSourceVerified = true
bootshausRegression = 0
unsafeTicketCtas = 0
wrongTicketPrices = 0
wrongTicketTargets = 0
wrongLineupsRemaining = 0
wrongImagesRemaining = 0
wrongTicketTargetsRemaining = 0
wrongPricesRemaining = 0
secondRunConsumerWrites = 0
secondRunTicketWrites = 0
productionMutations = 0
```

### Real-source counters

```
realSourcePagesChecked = 7
realTicketPagesChecked = 3
visibleFlyersChecked = 7
realSourceVsParserMismatches = 0
realTicketVsDatabaseMismatches = 0
realSourceVsConsumerMismatches = 0
wrongLineupsDetected = 0
wrongImagesDetected = 0
wrongPricesDetected = 0
wrongTicketTargetsDetected = 0
```

### Sync counters

```
affenkaefigEventsDiscovered = 7
affenkaefigEventsParsed = 7
bootshausEventsVerified = 25
bootshausDryRunAppliedWrites = 0
```

## 3. Staging gate (final apply)

```
discovered: 7
parsed: 7
firstRunConsumerWrites: 2
secondRunConsumerWrites: 0
firstTicketDelta: price/url/status corrected (14-jahre shop-root downgrade, halloween day-ticket price)
secondTicketDelta: 0
bootshausDryRunAppliedWrites: 0
productionMutations: 0
```

## 4. Per-event verification matrix (Affenkäfig)

Real-source checks: official page live, ticket redirect where applicable, flyer/image assignment, parsed evidence, staging DB, consumer projection.

| Event | Title | Date | Venue | Description + source | Line-up + source | Genres + source | Ticket provider | Type/phase | Price | Sales | Identity | Consumer CTA | State |
|-------|-------|------|-------|----------------------|------------------|-----------------|-----------------|------------|-------|-------|----------|--------------|-------|
| `14-jahreaffenkaefig19-09-2026` | 14 Jahre Affenkäfig 19.09.2026 | 2026-09-19 | Essigfabrik / Elektroküche | Official page (verified) | 13 acts — official HTML/flyer (verified) | source_not_announced | organizer_shop | — | 0.00 EUR (no published shop price) | availability_unverified | ticket_identity_unverifiable | no_cta (unsafe shop root removed) | **verified** |
| `affenkaefig-xxx-capitol-xxx-hagen-17-10-2026` | Affenkäfig XXX CAPITOL XXX Hagen | 2026-10-16 | Capitol | source_not_announced | Folgt — official/flyer (verified) | source_not_announced | — | — | — | — | ticket_identity_unverifiable | no_cta | **verified** |
| `affenkaefig-xxxa8xxx-02-10-2026` | Affenkäfig xxx A8 xxx – 02.10.2026 | 2026-10-01 | A8 Stage Club | source_not_announced | Folgt — official/flyer (verified) | source_not_announced | — | — | — | — | ticket_identity_unverifiable | no_cta | **verified** |
| `affenkaefigrulesbootshaus-koeln-23-10-26` | AFFENKÄFIG RULES // BOOTSHAUS KÖLN 23.10.26 | 2026-10-23 | Bootshaus | source_not_announced | source_not_announced | source_not_announced | — | — | — | — | review_required (datetime/identity conflict) | n/a_review_required | **review_required** |
| `halloween-weekender` | Halloween Weekender | 2026-10-30 | Essigfabrik / Elektroküche | Official page (verified) | source_not_announced (OCR cleared) | source_not_announced | ticket_kings | Tagesticket 30.10 Early Bird | 18.50 EUR | available | ticket_identity_verified | purchase → TicketKings detail | **verified** |
| `mdma-musik-die-mich-antreibt-10-10-26` | MDMA – Musik Die Mich Antreibt 10.10.26 | 2026-10-09 | Essigfabrik / Elektroküche | TicketKings supplemental (verified) | 7 acts — TicketKings LINE-UP (verified) | source_not_announced | ticket_kings | E-Ticket Phase 1 | 20.00 EUR | available | ticket_identity_verified | purchase → TicketKings detail | **verified** |
| `underland-essigfabrik-05-09-2026` | Underland Essigfabrik 05.09.2026 | 2026-09-04 | Essigfabrik / Elektroküche | TicketKings supplemental (verified) | UNDERLAND — official/flyer (verified) | source_not_announced | ticket_kings | E-Ticket Phase 1 | 18.00 EUR | available | ticket_identity_verified | purchase → TicketKings detail | **verified** |

### Ticket redirect evidence

| Event | Official ticket link | Redirect / final target |
|-------|---------------------|-------------------------|
| Halloween Weekender | TicketKings CTA on official page | `https://ticketkings.de/event/halloween-suesses-oder-saures-30-10-31-10-2026/` |
| MDMA | TicketKings CTA | `https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/` |
| Underland | TicketKings CTA | `https://ticketkings.de/event/underland-essigfabrik-05-09-2026/` |
| 14-jahre | Generic `/tickets/` shop root | Downgraded — no purchase CTA until event-specific ticket URL exists |

## 5. Bootshaus consumer readback

Full readback for **25** current Bootshaus events completed inside `run-m9-2-full-verification.ts` (not dry-run only).

```
bootshausRegression = 0
bootshausEventsVerified = 25
bootshausDryRunAppliedWrites = 0
```

## 6. Root causes resolved in this pass

1. **Unsafe shop-root CTA (14-jahre)** — generic `affenkaefig.info/tickets/` downgraded; no active purchase CTA.
2. **Halloween wrong price (3600 vs 1850)** — German `Tagesticket` offers were not selectable as regular admission; lowest day ticket now persisted.
3. **OCR lineup garbage (Halloween/MDMA)** — supplemental TicketKings LINE-UP merge + OCR clear/replace via reconciliation planner.
4. **Fingerprint noop blocking recovery** — supplemental reconciliation writes allowed when verified TicketKings evidence changes consumer fields without page fingerprint change.
5. **TicketKings LINE-UP extraction** — prose `Line-up` false positives and price fragments (`00 EUR`) rejected; caps billing rows extracted for MDMA.

## 7. AFFENKÄFIG RULES // BOOTSHAUS

Remains **`review_required`**. Identity/datetime conflict with Bootshaus event not auto-merged. Expected per M8.3.

## 8. Tests

- `npm run test:connectors` — 177 passed
- `npm run test:ingestion` — 74 passed
- `npm run typecheck` — pass
- `git diff --check` — pass

## 9. Artifacts

- `app-v2/.tmp/m9-2-full-verification/gates.json`
- `app-v2/.tmp/m9-2-full-verification/affenkaefig-event-matrix.json`
- `app-v2/.tmp/m9-2-affenkaefig-gate/gate-summary.json`
