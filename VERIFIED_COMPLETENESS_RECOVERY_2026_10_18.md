# Eternal Rave — Verified Completeness Recovery — 2026-10-18

## Scope

Controlled consumer-data recovery against the live Eternal Rave staging project `gnkjzinwvmrxcadwebhv`.

This pass was based on:
- current consumer-visible staging rows,
- the read-only existing-event recovery preview from GitHub Actions run `39101575913`,
- fresh primary venue / promoter / ticket pages,
- explicit pre-write and post-write database guards.

No scheduler was enabled. No new events were imported. No production database was touched.

## Pre-apply baseline

- events: 122
- venues: 75
- event_sources: 192
- event_lineup: 432
- event_genres: 204
- event_tickets: 68

## Ticket recovery applied

Exactly 10 previously ticketless events received one current consumer ticket row and one provenance source row:

1. #MittWochenende by Beats x Bass x Cologne at Odonien
   - ticket.io
   - 12.00 EUR
   - available
2. Wintergarden Halloween w/ Ben Klock, Beste Hira, Gerd Janson a.m.
   - Dockland / Stagedates
   - 18.00 EUR
   - available
3. Feiern wie früher - nur früher! — Kassel
   - Graf Karl / Stagedates
   - 23.00 EUR
   - available
4. 11.11 – 14 STUNDEN ELEKTRONISCHER KARNEVAL IM REINEKE FUCHS
   - embedded Rausgegangen ticketing on the official Reineke event page
   - 8.00 EUR current regular ticket
   - available
5. KYTES — Wiesbaden
   - exact Eventim tour stop
   - 34.85 EUR
   - available
6. KYTES — Karlsruhe
   - Tollhaus official ticket shop
   - 34.90 EUR
   - available
7. KYTES — Rostock
   - exact Eventim tour stop
   - 34.90 EUR
   - available
8. KYTES — Hannover
   - exact Eventim tour stop
   - 34.90 EUR
   - available
9. KYTES — Münster
   - Sputnikhalle official event + exact Eventim tour stop
   - 34.90 EUR
   - available
10. KYTES — Essen
    - exact Eventim tour stop
    - 34.90 EUR
    - available

## Canonical corrections applied

### Wintergarden Halloween

The current primary source identifies Dockland as the event start / primary venue and Fusion as the continuation later in the night.

Applied:
- primary venue: `Dockland`
- address: `Am Hawerkamp 29a, 48155 Münster`
- organizer: `Dockland GmbH`
- `Gerd Janson a.m.` corrected to `Gerd Janson`
- lineup expanded with:
  - Greta Perola
  - Accul
  - FELI
  - Rubi

Resulting lineup count: 7.

### KYTES — Münster

The current Sputnikhalle page and the exact Eventim stop both identify Sputnikhalle, not Jovel Music Hall.

Applied:
- venue: `Sputnikhalle`
- address: `Am Hawerkamp 31, 48155 Münster`

## Explicitly not changed

Existing verified ticket prices on unrelated events were protected from weaker refresh evidence.

PaulWetz Stuttgart was not written because current primary surfaces disagree on consumer price:
- artist shop: 43.45 EUR
- Eventim: 44.45 EUR

No value was chosen until that difference is resolved.

Artificial-looking 05:00 end times on concert-style Rausgegangen rows were detected for a separate lifecycle/time-quality audit, but were not mutated in this recovery batch.

## Post-apply verification

Transaction committed only after all guards passed.

Final counts:
- events: 122
- venues: 77
- event_sources: 202
- event_lineup: 436
- event_genres: 204
- event_tickets: 78

Expected deltas:
- venues: +2
- event_sources: +10
- event_lineup: +4
- event_tickets: +10
- events: 0
- event_genres: 0

All 10 recovered ticket rows were read back with exact event identity, target URL, price, currency and status.
