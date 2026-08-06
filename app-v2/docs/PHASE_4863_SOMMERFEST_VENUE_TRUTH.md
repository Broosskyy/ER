# Phase 4.8.6.3 — Bootshaus Sommerfest Venue Truth Trace

Generated: 2026-08-06T01:50:00.000Z

## Event

| | |
|---|---|
| ID | `evt-1785339391167-tfaixrr` |
| Title | Bootshaus Sommerfest |
| Date | 2026-09-05 |
| Canonical venue (wrong) | Essigfabrik, Köln |
| Canonical address | Auenweg 173, 51063 Köln (Bootshaus club address) |

## Public ground truth (fresh)

| Source | Venue | Address | Confidence |
|--------|-------|---------|------------|
| Bootshaus official page | *(not published)* | Auenweg 173 in footer only | low |
| Ticket.io list row `vB0cAmWg` | **Bootshaus** | Auenweg 173, 51063 Köln | **high** |
| Ticket.io JSON-LD | **Bootshaus** | Auenweg 173, 51063 Köln | **high** |
| Ticket.io detail page | ALTCHA-blocked | — | none |

**True venue per public evidence: Bootshaus, Köln** (Auenweg 173)

Official website does not publish an explicit venue field (`VENUE_NOT_PUBLISHED_ON_PAGE`). Ticket.io list evidence is the strongest Event-specific venue source.

## Why canonical says Essigfabrik

**Not** from current Ticket.io evidence (import payload has `venueName: Bootshaus`).

**Earliest traceable cause:** Wrong Ticket Kings source references linked **Underland Essigfabrik** (`ticketkings.de/event/underland-essigfabrik-05-09-2026/`) to this canonical Event ID on **2026-07-30** — before the Ticket.io import. That linkage carried Essigfabrik venue geography from an unrelated Affenkäfig event.

Subsequent Ticket.io import (2026-08-02) normalized `venueName: Bootshaus` but **did not overwrite** the stale canonical `venueName: Essigfabrik`. Address/coordinates were updated to Bootshaus (Auenweg 173), creating an internal contradiction.

## Pipeline trace

```
Official page → no venue field
Website importer → withheld venue (correct)
Ticket Kings wrong refs (2026-07-30) → Essigfabrik contamination
Ticket.io import (2026-08-02) → normalized venue Bootshaus (not applied to canonical name)
Canonical event → venueName Essigfabrik + address Auenweg 173
API/ViewModel → locationLabelComma: Essigfabrik, Köln
```

## Venue ownership

| Owner | Role |
|-------|------|
| `source-bootshaus-koeln` | Event ownership |
| Stale Ticket Kings refs | **Incorrect** Essigfabrik venue contamination |
| `source-bootshaus-ticket-io` | Correct Bootshaus in import payload; not reflected in canonical venueName |

## Related events

| Event | Venue | Note |
|-------|-------|------|
| Bootshaus Sommerfest Closing | Bootshaus | Same series, correct venue |
| Sommerfest Elektroküche | Essigfabrik | Separate Affenkäfig event — not the source of Bootshaus Sommerfest venue |
| Underland Essigfabrik 05.09.2026 | Essigfabrik | Wrong Ticket Kings ref linked to Sommerfest |

## Correction preview (not executed)

| Field | Current | Proposed |
|-------|---------|----------|
| `venueName` | Essigfabrik | **Bootshaus** |
| `venueCity` | Köln | Köln |
| `venueAddress` | Auenweg 173, 51063 Köln | *(unchanged)* |

Evidence: Ticket.io list JSON-LD for `vB0cAmWg`. Risk: low. Rollback: Essigfabrik.

Also requires deactivating stale Underland Ticket Kings source references on this Event.

## Global venue issues

2 Events with **venue name / address mismatch** (Essigfabrik label + Auenweg 173 Bootshaus address):
- Bootshaus Sommerfest
- Into The Madness Pre-Party Weekender

## Generic venue guards

**Insufficient today:**
- Wrong cross-Event source reference can contaminate venue
- Ticket.io correct venue in import payload does not repair stale canonical venueName
- No venueName vs venueAddress consistency check

## Ops

```bash
npm run audit-phase4863
```

`productionMutationsInThisRun: 0`

## Artifacts

- `_phase4863_public_truth.json`
- `_phase4863_historical_trace.json`
- `_phase4863_venue_ownership.json`
- `_phase4863_root_cause.json`
- `_phase4863_related_events.json`
- `_phase4863_correction_preview.json`
- `_phase4863_global_venue_collisions.json`
