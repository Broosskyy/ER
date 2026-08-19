# M6.8 Consumer Ticket Truth

## Consumer data path

```
event_tickets (Supabase)
  → event-core-read.ts
  → event-core-mapper.ts (primary ticket)
  → event-core-display.ts + consumer-ticket-safety-gate.ts
  → event-status-resolver.ts
  → EventDetailContent / discovery cards
```

Ticket provenance and `consumerProjection` on `event_sources.raw_payload` are ingestion metadata only. The running app gates CTAs and prices from `event_tickets` via `resolveConsumerTicketPresentation`.

## Safety gate

Active purchase CTAs require `sales_status = available` (or legacy `on_sale`) and a verified HTTPS ticket URL. `availability_unverified`, `sales_ended`, `sold_out`, and `sale_not_started` never expose a purchase CTA.

Consumer status labels are projected in German. Raw enums such as `available` or `availability_unverified` are not rendered. `available` hides the status line.

Numeric prices render only from persisted `event_tickets.price_from_minor`. There is no in-memory admission flag and no `.tmp`/WritePlan/fixture lookup on the consumer path. Unproven amounts must be stored as `null`. CTA may remain active without a price when `sales_status = available` and a verified HTTPS ticket URL exists.

## URL roles

`eventSourceUrl` / official event page, `organizerWebsiteUrl`, `venueWebsiteUrl`, and `ticketUrl` are distinct. The consumer never copies `origin(events.official_url)` onto the organizer. A Bootshaus event page may be labeled as a Bootshaus **source** from its hostname even when the organizer is someone else. That source must not become the organizer website.

## Regular admission pricing

`selectRegularAdmissionOffer` chooses the lowest **purchasable** regular admission tier. Sold-out early tiers, VIP, tables, lockers, unnamed `Admission`, JSON-LD `lowPrice`, and other add-ons are excluded from the public minimum price.

---

## M6.8 discovery — consumer media/lineup mismatch (document only)

**Status:** `M7_REOPENED_CONSUMER_MEDIA_MISMATCH` (outside M6.8 repair scope; requires M7.1 after M6.8 ticket closure)

### Reported symptom

Event **Blacklist & Inurfase pres. ZAAGSTEP by Dr Donk** (`blacklist-inurfase-pres-zaagstep-by-dr-donk`, event id `f560d0f3-1bac-4bae-bf4a-48f8dfdb5f8e`):

- Official flyer shows multiple billing names.
- Running consumer app: **no lineup section**.
- Description shows only the fragment `BLACKLIST & INURFASE pres.`

### Consumer read path (lineup + description)

```
events.description          → EventDetail.description (plain text)
event_lineup.billing_name   → EventDetail.lineup → EventDetailContent lineup block
```

The app does **not** read `event_sources.raw_payload.descriptionClean`, M7 preview JSON, or media OCR output for lineup or description.

### Staging DB state (M6.6 baseline snapshot)

| Field | Value |
|---|---|
| `events.description` | `BLACKLIST & INURFASE pres.` (truncated) |
| `event_lineup` rows | **none** for this event (`lineup: null` in snapshot) |
| `event_sources.raw_payload.descriptionClean` | Full official text including `FULL LINE-UP A-Z` and billing names (Dr Donk, GPF, Invaderz, …) |
| `raw_payload.lineupCount` | `0` |
| `enrichmentGaps` | `lineup_media_required`, `genre_evidence_insufficient` |

### M7 audit state (`app-v2/.tmp/m7-media-audit/`)

| Artifact | Finding |
|---|---|
| `m7-audit-report.json` | `databaseWriteOperations: 0`, `dbUnchanged: true`, `allNoopIdempotent: true`; `event_lineup` count unchanged (91 → 91) |
| `m7-consumer-preview.json` | Preview-only; ZAAGSTEP: `lineupCandidates: []`, `lineupBlocks: []`, `decision: preview_ready` |
| Flyer OCR | Low-confidence / invalid entries rejected; OCR raw text largely unreadable; **no verified billing rows** produced for this event in M7 preview |

ZAAGSTEP is **not** among M7 golden-check events with persisted media lineups (unlike Loonyland, Chris Stussy, Into The Madness, etc. in preview).

### Root-cause assessment

**Yes — aligned with M7 noop + preview-only, not consumer DB path:**

1. **M7 did not persist** verified media/lineup results into `events`, `event_lineup`, or other tables consumed by the app (`databaseWriteOperations: 0`).
2. **M7 preview for ZAAGSTEP did not produce verified lineup billing rows** from the flyer (OCR gaps / rejected candidates); `lineup_media_required` remains.
3. **Consumer shows DB truth:** empty `event_lineup` → no lineup UI; truncated `events.description` → fragment only.
4. Full lineup text exists in **official source payload** (`descriptionClean`) but was never applied to consumer-facing columns.

This is **not** caused by M6.8 ticket-truth work. M6.8 explicitly does not modify event-core, lineup, genres, media, or description fields.

### Required follow-up (M7.1 — after M6.8)

- Re-audit all 30 events over the **real consumer path** (`events` + `event_lineup` + `event_genres`, not `.tmp` previews).
- Controlled staging persistence of verified description + lineup (and genres where evidenced).
- ZAAGSTEP: recover billing names from flyer (improved OCR/layout or official text line-up block) before persist.

### M6.8 scope boundary

- Document and track under `M7_REOPENED_CONSUMER_MEDIA_MISMATCH`.
- **No** M7/media production changes in the M6.8 ticket-truth commit.
