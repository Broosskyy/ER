# Phase 4.6.9 — Flyer Reconciliation and Billing Display

Generated: 2026-08-03T07:20:33.950Z

## 1. Artist identity evidence policy

- `artist-identity-evidence.ts` ranks verified canonical, alias, structured text, official flyer, description, title, weak OCR
- Minor spelling variations may be corrected by official flyer when confidence is high
- Ambiguous conflicts route to review instead of silent overwrite

## 2. KARAMUSTA versus KARAMUSTAN

- Ticket Kings textual spelling: KARAMUSTA
- Official MDMA flyer spelling: KARAMUSTAN
- Resolution: rename canonical display to KARAMUSTAN, preserve KARAMUSTA as alias

## 3. Official flyer eligibility

- Attached by official origin, event poster/hero, visible billing, identity match, stored hash and provenance

## 4. Image extraction method

- Curated official flyer text via `enrichFlyerLineup` contract (no new paid OCR provider)
- Idempotent on content hash

## 5. Bootshaus billing reconstruction

- 4 B2B pairs from official flyer evidence
- Collapsed website text retained as insufficient provenance
- Ticket.io ALTCHA blocker retained on import metadata

## 6. Confidence/review decisions

- High-confidence accepted flyer evidence written via structured import repair
- Low-confidence OCR never auto-published

## 7. Structured merge result

- Flyer entries authoritative when reviewState=accepted
- `event_lineup_entries` stores billing boundaries

## 8. Compatibility projection

- `event_artists` derived from structured entries

## 9. Projection/API

- `lineupEntries[]` + flat `artists[]` exposed

## 10. Public billing display

- `LineupSection` renders `billingRows` with `BillingLineupCard`
- SOLO rows unchanged; B2B/F2F from `billingRelation`

## 11. Admin review support

- `FlyerEvidenceAdminSection` for extraction preview and conflicts
- `StructuredLineupAdminSection` for billing edits

## 12. Production repair

- Passes: 5
- Idempotent: NO

## 13. Representative validation

- Sommerfest Elektroküche: PASS — 14 entries, 14 artists
- LEVI: PASS — 1 entries, 1 artists
- MDMA: PASS — 9 entries, 18 artists
- Bootshaus on a Ship Vol. III: PASS — 4 entries, 8 artists

## 14. Tests/build

- Unit tests for identity policy, flyer parsing, billing display, repair idempotency

## 15. Mobile validation

- Representatives passing: 4/4

## 16. Remaining blockers

- Re-run repair to 0 mutations and re-validate representatives
