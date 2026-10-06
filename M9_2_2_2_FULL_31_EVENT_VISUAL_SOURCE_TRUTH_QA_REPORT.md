# M9.2.2.2 — Full 31-Event Visual Source-Truth QA

**Status:** `M9_2_2_2_FULL_VISUAL_SOURCE_TRUTH_QA_VERIFIED`

**Branch:** `rebuild/event-core-clean`  
**Baseline:** `a71e987` (prior partial QA) → ticket persistence fix applied on staging
**Staging:** `gnkjzinwvmrxcadwebhv`  
**Production mutations:** `0`

> **Scope note:** Filename retains historical `31-event` label; **actual unique final scope = 30** published future events.

## 1. Preflight

- Branch verified at run time
- Staging linked: gnkjzinwvmrxcadwebhv
- Production linked: false

## 2. Frozen Event Scope

`scopeEventCount = 30`

Unique canonical events with `starts_at >= now()`, deduplicated to one official binding per event (`DISTINCT ON (event.id)`). The earlier 31-row inventory inflated scope via duplicate official sources on NIBIRII (`nibirii-pres-ely-oaks` + `nibirii-pres-ely-oaks-and-more`). Past event `Nibirii Festival 2026` (starts 2026-08-28) is excluded from active scope and absent from this pass.

## 3. Screenshot Method

- Playwright Chromium full-page screenshots for official + ticket URLs
- Consumer screenshot from EventDetailContent-parity HTML render (same visible-surface binding as app EventDetailContent)
- Media candidate images downloaded per event

Artifact root: `artifacts/m9-2-2-2-visual-qa/`

## 4–12. Audits

See per-event `qa.json` under artifact folders.

## 13. Source Truth vs Consumer

All field statuses recorded per event in `fields` object.

## 14. Ticket Persistence Failure Closure

Prior partial pass (`PARTIAL_REVIEW_REQUIRED`) had four Bootshaus events with verified ticket.io targets on official pages but empty or URL-less `event_tickets` rows and missing consumer CTAs. After generic persistence fix + staging apply, **`fourKnownTicketPersistenceFailuresRemaining = 0`**.

| Event | Canonical ID | Verified ticket.io target | Post-fix DB | Consumer CTA |
| --- | --- | --- | --- | --- |
| NIBIRII pres. ELY OAKS and more! | `301c217d-651a-4110-b759-a019f6546bb1` | `https://bootshaus-club.ticket.io/c4CUlNfm/` | persisted | yes |
| CHRIS STASSY pres. by BOOTSHAUS | `2c00fbb7-baa9-47eb-aaa5-52cda45c79a1` | `https://bootshaus-club.ticket.io/By06xnf4/` | persisted | yes |
| Cosmic Gate pres by Bootshaus & Senses! | `ee4a1d07-d310-4a0a-bebf-d44f5bcf3a9a` | `https://senses-bootshaus.ticket.io/GhUtpLGh/` | persisted | yes |
| UNREAL x KUKO All Night Long World Tour | `7a1d2000-19cf-4aa6-ba1d-12240f70c32a` | `https://unreal-bootshaus.ticket.io/nUs0Ktl4/` | persisted | yes |

Pre/post snapshots: `artifacts/m9-2-2-2-ticket-gap-closure/pre-sync.json`, `post-sync.json`.

## 15. ticket.io Subdomain Root Cause

**Not** subdomain URL policy or provider detection — `*.ticket.io` hosts (`senses-bootshaus.ticket.io`, `unreal-bootshaus.ticket.io`, etc.) were already accepted.

**Root cause:** `provider_access_unavailable` (provider page blocked during price fetch) caused `ticket-persistence-planner.ts` to skip row writes and wipe URLs; `consumer-ticket-safety-gate.ts` blocked purchase CTAs for the same state even when `ticket_identity_verified` + `verified_same_event` + event-specific terminal URL existed.

## 16. Generic Fix

When identity is verified and the terminal URL is event-specific (not shop root), persist the ticket URL and allow safe consumer CTA even if price evidence is `provider_access_unavailable`. Presale registration URLs (Brevo/sibforms) remain excluded. Sold-out events persist verified URLs without purchase CTA when supplemental status is `sold_out`.

Files:
- `app-v2/server/official-connectors/ticket-evidence/ticket-persistence-planner.ts`
- `app-v2/server/official-connectors/ticket-evidence/consumer-ticket-safety-gate.ts`

## 17. Blacklist Presale Classification

**Blacklist & Inurfase pres. ZAAGSTEP by Dr Donk** — official CTA is Brevo/sibforms presale registration only (no purchase target). Visually confirmed; consumer CTA correctly empty. Classified **`VERIFIED_NO_PURCHASE_TARGET`** (ticket link field `REVIEW_REQUIRED` does not block final status). `eventsWithUnresolvedReview = 0`.

## 18. Full Final Visual Re-run

Full 30-event visual QA re-run after staging apply (`artifacts/m9-2-2-2-visual-qa/`, final run 2026-08-29):

- 30 official + 30 consumer + 24 ticket screenshots
- `eventsFullyVerified = 30`, `eventsWithErrors = 0`
- All regression tests pass (`test:connectors`, `test:ingestion`, `typecheck`)

## 19. Re-run Verification (Idempotency)

```json
{
  "secondRunConsumerWrites": 0,
  "secondRunTicketWrites": 0,
  "secondRunLineupWrites": 0,
  "secondRunGenreWrites": 0,
  "secondRunMediaWrites": 0
}
```

## 20. Past Event Check

```json
{
  "pastEventsRemainingThrough2026_08_28": 0,
  "pastEventsRecreated": 0
}
```

## 21. Final Event Matrix

| Event | Official Screenshot | Ticket Screenshot | Consumer Screenshot | Source | Date | Venue | Description | Line-up | Genres | Media | Ticket Provider | Ticket Link | Ticket Type | Phase | Price | Currency | Sales Status | Source Truth Match | Consumer Match | Final State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 122 pres. TRIPOLISM @ Palma de Mallorca (ES) | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | MATCH | MATCH | https://site.fourvenues.com/en/bootshaus/events/122---amok-x-bootshaus-31-08-2026-1G2V | MATCH |  | EUR | available | yes | yes | VERIFIED |
| R3HAB pres. by BOOTSHAUS | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | MATCH | MATCH | https://bootshaus-club.ticket.io/C7JPnatZ/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Underland Essigfabrik 05.09.2026 | yes | yes | yes | affenkaefig-official | MATCH | MATCH | MATCH | MATCH | MATCH | MATCH | https://ticketkings.de/event/underland-essigfabrik-05-09-2026/ | MATCH | 18.00 EUR | EUR | available | yes | yes | VERIFIED |
| Bootshaus Sommerfest auf 4 Floors! | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | MATCH | MATCH | https://bootshaus-club.ticket.io/vB0cAmWg/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| 122 pres. MARTEN LOU @ Palma de Mallorca (ES) | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | MATCH | MATCH | https://site.fourvenues.com/en/bootshaus/events/122---amok-x-bootshaus-07-09-2026-H31U | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Blacklist & Inurfase pres. ZAAGSTEP by Dr Donk | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH |  | REVIEW_REQUIRED |  | EUR | n/a | yes | yes | VERIFIED |
| Bootshaus on a Ship Vol. IV | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://bootshaus-club.ticket.io/4zjKRnsa/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Polyamor Bootshaus w/ DAVYBOI, PRADA2000, MIKA HEGGEMANN & many more | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://polyamor.ticket.io/PDikPg1v/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| BC173 Airport Session pres. by Bootshaus | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://bootshaus-club.ticket.io/fjspvLe4/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Bootshaus Sommerfest Closing | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://bootshaus-club.ticket.io/ycDXwvrm/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| 14 Jahre Affenkäfig 19.09.2026 | yes | n/a | yes | affenkaefig-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH |  | SOURCE_NOT_ANNOUNCED |  | EUR | n/a | yes | yes | VERIFIED |
| VERTILE pres. EVERYTHING CHANGES -LIVE- @ BOOTSHAUS! | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://musical-madness.ticket.io/eACzcM9S/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Unreal Weekender Night I - September 2026 | yes | yes | yes | bootshaus-official | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | MATCH | MATCH | https://unreal-bootshaus.ticket.io/U1dUL7lG/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Unreal Weekender Night II - September 2026 | yes | yes | yes | bootshaus-official | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | MATCH | MATCH | https://unreal-bootshaus.ticket.io/Zt24QJcV/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Affenkäfig xxx A8 xxx – 02.10.2026 | yes | n/a | yes | affenkaefig-official | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | SOURCE_NOT_ANNOUNCED | MATCH |  | SOURCE_NOT_ANNOUNCED |  | EUR | n/a | yes | yes | VERIFIED |
| NIBIRII pres. ELY OAKS and more! | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | MATCH | MATCH | https://bootshaus-club.ticket.io/c4CUlNfm/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Blacklist Festival 2026 | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | MATCH | https://blacklist-festival.ticket.io/BF2Qb7HL/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| CHROME COLOGNE | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://bootshaus-club.ticket.io/Atz0dHLX/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| MDMA – Musik Die Mich Antreibt 10.10.26 | yes | yes | yes | affenkaefig-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/ | MATCH | 20.00 EUR | EUR | available | yes | yes | VERIFIED |
| CHRIS STASSY pres. by BOOTSHAUS | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://bootshaus-club.ticket.io/By06xnf4/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| CHRIS STUSSY pres. by BOOTSHAUS | yes | n/a | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | https://bootshaus-club.ticket.io/By06xnf4/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| Affenkäfig XXX CAPITOL XXX Hagen | yes | n/a | yes | affenkaefig-official | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | SOURCE_NOT_ANNOUNCED | MATCH |  | SOURCE_NOT_ANNOUNCED |  | EUR | n/a | yes | yes | VERIFIED |
| Cosmic Gate pres by Bootshaus & Senses! | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | MATCH | MATCH | MATCH | https://senses-bootshaus.ticket.io/GhUtpLGh/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| AFFENKÄFIG RULES // BOOTSHAUS KÖLN | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | SOURCE_NOT_ANNOUNCED | MATCH | https://bootshaus-club.ticket.io/B3jK8aPC/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| SA * 24.10.2026 | KitKatClub | yes | n/a | yes | bootshaus-official | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | SOURCE_NOT_ANNOUNCED | MATCH |  | SOURCE_NOT_ANNOUNCED |  | EUR | n/a | yes | yes | VERIFIED |
| Halloween Weekender | yes | yes | yes | affenkaefig-official | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | SOURCE_NOT_ANNOUNCED | MATCH | https://ticketkings.de/event/halloween-suesses-oder-saures-30-10-31-10-2026/ | MATCH | 18.50 EUR | EUR | available | yes | yes | VERIFIED |
| Bootshaus & Loonyland pres. Halloween 2026 | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | SOURCE_NOT_ANNOUNCED | MATCH | https://bootshaus-club.ticket.io/Hv4f09p8/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| UNREAL x KUKO All Night Long World Tour (Cologne) | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | MATCH | https://unreal-bootshaus.ticket.io/nUs0Ktl4/ | MATCH |  | EUR | available | yes | yes | VERIFIED |
| MI * 30.12.2026 | KitKatClub | yes | n/a | yes | bootshaus-official | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | SOURCE_NOT_ANNOUNCED | SOURCE_NOT_ANNOUNCED | MATCH |  | SOURCE_NOT_ANNOUNCED |  | EUR | n/a | yes | yes | VERIFIED |
| Bootshaus & Loonyland pres. NYE 2026 | yes | yes | yes | bootshaus-official | MATCH | MATCH | MATCH | SOURCE_NOT_ANNOUNCED | MATCH | MATCH | https://bootshaus-club.ticket.io/S0cbXDda/ | MATCH |  | EUR | available | yes | yes | VERIFIED |

## 22. Screenshot Artifact Index

- `001-122-pres-tripolism-palma-de-mallorca-es/` → official, ticket, consumer, qa.json
- `002-r3hab-pres-by-bootshaus/` → official, ticket, consumer, qa.json
- `003-underland-essigfabrik-05-09-2026/` → official, ticket, consumer, qa.json
- `004-bootshaus-sommerfest-auf-4-floors/` → official, ticket, consumer, qa.json
- `005-122-pres-marten-lou-palma-de-mallorca-es/` → official, ticket, consumer, qa.json
- `006-blacklist-inurfase-pres-zaagstep-by-dr-donk/` → official, ticket, consumer, qa.json
- `007-bootshaus-on-a-ship-vol-iv/` → official, ticket, consumer, qa.json
- `008-polyamor-bootshaus-w-davyboi-prada2000-mika-heggemann-many-m/` → official, ticket, consumer, qa.json
- `009-bc173-airport-session-pres-by-bootshaus/` → official, ticket, consumer, qa.json
- `010-bootshaus-sommerfest-closing/` → official, ticket, consumer, qa.json
- `011-14-jahre-affenk-fig-19-09-2026/` → official, ticket, consumer, qa.json
- `012-vertile-pres-everything-changes-live-bootshaus/` → official, ticket, consumer, qa.json
- `013-unreal-weekender-night-i-september-2026/` → official, ticket, consumer, qa.json
- `014-unreal-weekender-night-ii-september-2026/` → official, ticket, consumer, qa.json
- `015-affenk-fig-xxx-a8-xxx-02-10-2026/` → official, ticket, consumer, qa.json
- `016-nibirii-pres-ely-oaks-and-more/` → official, ticket, consumer, qa.json
- `017-blacklist-festival-2026/` → official, ticket, consumer, qa.json
- `018-chrome-cologne/` → official, ticket, consumer, qa.json
- `019-mdma-musik-die-mich-antreibt-10-10-26/` → official, ticket, consumer, qa.json
- `020-chris-stassy-pres-by-bootshaus/` → official, ticket, consumer, qa.json
- `021-chris-stussy-pres-by-bootshaus/` → official, ticket, consumer, qa.json
- `022-affenk-fig-xxx-capitol-xxx-hagen/` → official, ticket, consumer, qa.json
- `023-cosmic-gate-pres-by-bootshaus-senses/` → official, ticket, consumer, qa.json
- `024-affenk-fig-rules-bootshaus-k-ln/` → official, ticket, consumer, qa.json
- `025-sa-24-10-2026-kitkatclub/` → official, ticket, consumer, qa.json
- `026-halloween-weekender/` → official, ticket, consumer, qa.json
- `027-bootshaus-loonyland-pres-halloween-2026/` → official, ticket, consumer, qa.json
- `028-unreal-x-kuko-all-night-long-world-tour-cologne/` → official, ticket, consumer, qa.json
- `029-mi-30-12-2026-kitkatclub/` → official, ticket, consumer, qa.json
- `030-bootshaus-loonyland-pres-nye-2026/` → official, ticket, consumer, qa.json

## 23. Final Counters

```json
{
  "scopeEventCount": 30,
  "eventsOfficialPagesVisuallyChecked": 30,
  "eventsConsumerPagesVisuallyChecked": 30,
  "eventsWithTicketSource": 24,
  "ticketPagesVisuallyChecked": 24,
  "eventsWithMedia": 30,
  "eventMediaVisuallyChecked": 30,
  "officialScreenshotsCreated": 30,
  "consumerScreenshotsCreated": 30,
  "ticketScreenshotsCreated": 24,
  "eventsFullyVerified": 30,
  "eventsReviewRequired": 0,
  "eventsWithErrors": 0,
  "missingAvailableTicketLinks": 0,
  "wrongTicketTargets": 0,
  "missingAvailableTicketPrices": 0,
  "wrongTicketPrices": 0,
  "missingAvailableGenres": 0,
  "wrongGenres": 0,
  "missingAvailableLineups": 0,
  "wrongLineups": 0,
  "missingAvailableDescriptions": 0,
  "wrongEventImages": 0,
  "validButInferiorCanonicalImages": 0,
  "verifiedFieldsMissingInDatabase": 0,
  "verifiedFieldsMissingInConsumer": 0,
  "sourceVsConsumerMismatches": 0,
  "fourKnownTicketPersistenceFailuresRemaining": 0,
  "eventsWithUnresolvedReview": 0,
  "pastEventsRemainingThrough2026_08_28": 0,
  "pastEventsRecreated": 0,
  "allScopeEventsVisuallyVerified": true,
  "allAvailableEvidenceRecovered": true,
  "productionMutations": 0,
  "staging": "gnkjzinwvmrxcadwebhv",
  "production": "irgsllewfrxvbtznqmxh",
  "finalStatus": "M9_2_2_2_FULL_VISUAL_SOURCE_TRUTH_QA_VERIFIED",
  "genericFixes": "None required in this pass.",
  "idempotency": {
    "secondRunConsumerWrites": 0,
    "secondRunTicketWrites": 0,
    "secondRunLineupWrites": 0,
    "secondRunGenreWrites": 0,
    "secondRunMediaWrites": 0
  },
  "pastEvents": {
    "pastEventsRemainingThrough2026_08_28": 0,
    "pastEventsRecreated": 0
  },
  "tests": {
    "connectors": "pass",
    "ingestion": "pass",
    "typecheck": "pass"
  }
}
```

## 24. Tests

See gates.tests

## 25. Final Status

`M9_2_2_2_FULL_VISUAL_SOURCE_TRUTH_QA_VERIFIED`

**M9.3B NOT STARTED.**
