# Generic Source Platform — Phase 4 (Ticket.io Corpus Expansion)

Phase 4 increases real electronic music events by discovering and activating independent Ticket.io shops.

## Delivered

| Area | Implementation |
|------|----------------|
| Expanded corpus | `discovery-corpus-expansion.ts` — sources, seeds, published events, import records |
| Seed registry | `ticket-io-seed-urls.ts` — 10 curated electronic shops (not Bootshaus) |
| Tri-state filter | `electronic-music-relevance.ts` — relevant / irrelevant / uncertain |
| Uncertain routing | `review-step.ts`, `publish-decision-service.ts` — uncertain → needs_review |
| Shop qualification | `ticket-io-shop-qualification.ts` — auto_publish vs manual_review tiers |
| Backend service | `ticket-io-corpus-expansion-service.ts` — discover + activate shops |
| Discovery hardening | Seeds in `discoverTicketIoShops`, Bootshaus excluded, rate limiting |

## Limitations (honest)

- No ticket.io global shop directory API
- No slug enumeration — only URLs from corpus + seeds
- Some seed URLs may be inactive (probe skips them)
- Pagination not required yet for current shops (single-page JSON-LD lists)

## Validation

```bash
# Discovery probe only
npx tsx scripts/operations/_sprint36-discovery-probe.ts

# Republish records blocked by trust threshold (one-time ops)
npx tsx scripts/operations/_sprint36-republish-queued.ts

# Double-sync idempotency across activated shops
npx tsx scripts/operations/_sprint36-sync-validation.ts

# Production status snapshot
npx tsx scripts/operations/_sprint36-status-report.ts
```

### Live results (2026-07-31)

| Metric | Before (Phase 3) | After (Phase 4) |
|--------|------------------|-----------------|
| Canonical events | 69 | 125 (+56) |
| Published events | 63 | 119 |
| Discoverable (frontend/API) | 46 | 102 |
| Ticket.io discoverable | 17 | 73 (+56) |
| Ticket.io shops activated | 1 (Bootshaus enrichment) | 5 expansion + enrichment |
| Origins (expansion shops) | 0 | 56 |

Activated shops: `protontheclub` (12), `lehmannclub` (11), `area51events` (4), `technodampfer` (10), `hmg-concerts` (19).

Double-sync: all shops idempotent (`unchangedCount` stable, `createdCount` 0 on second run).

### Trust threshold fix

New `auto_publish` Ticket.io shops were created with `trustScore: 65`, below the default publish threshold of 70. Records queued correctly but did not auto-publish until trust was raised to 72 and `minTrustScore: 60` was set on `publishPolicy`.

## Out of scope

- Resident Advisor / Raves of Germany (only if Ticket.io insufficient)
- Generic onboarding UI
