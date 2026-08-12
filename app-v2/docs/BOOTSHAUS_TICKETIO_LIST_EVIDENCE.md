# Bootshaus Ticket.io List Evidence (Golden Path)

## Purpose

When Ticket.io detail pages are PoW-protected, the **shop list** remains the acquisition endpoint for current ticket truth. List entries with concrete event URLs (`https://bootshaus-club.ticket.io/{slug}/`) may enrich official events via the existing golden path — never as event identity or `websiteUrl`.

## Data flow

```
Official connector (verified public evidence)
  → Ticket.io list connector (list-card evidence)
  → matchTicketEvidenceForOfficial()
  → buildCanonicalEventFromVerifiedPublicEvidence()
  → consumer projection
  → noop persistence (preview / apply gate)
```

## Matching priority

1. **Exact outbound** — official page links to the same concrete Ticket.io event URL.
2. **Identical concrete ticket URL** — normalized URL on official and list entry.
3. **Unique identity combination** — title core + calendar day + venue, single candidate only.

Shop roots, calendar roots, app-download, and organizer URLs are never event matches.

## Ticket fields only

List evidence may set: `ticketUrl`, `priceText`, `ticketStatus`, `ticketPhases`, admission products, excluded add-ons, ticket `verifiedAt`.

List evidence must not overwrite official identity, venue, content, genres, or line-up.

## Offline validation

Validated capture (read-only ops input, not committed):

| Field | Value |
|-------|-------|
| Path | `app-v2/.tmp/bootshaus-live-capture.json` |
| SHA-256 | `da034fa207556255ec378699824040f10d7b177fffb0966470c8c8226655d0a0` |
| `verifiedAt` | `2026-08-12T15:14:45.485Z` |
| Official events | 30 |
| Ticket.io list entries | 14 |

Replay runner (temporary, `.tmp`):

```bash
npx tsx .tmp/run-bootshaus-ticketio-offline-replay.ts
```

Output: `app-v2/.tmp/bootshaus-ticketio-offline-replay-result.json`

## Tests

`src/features/import/domain/__tests__/bootshaus-ticketio-list-evidence.test.ts` — list evidence, shop-root rejection, outbound priority, protected fields, admission pricing, idempotent status, conflicts, blockers, golden references 7/7.
