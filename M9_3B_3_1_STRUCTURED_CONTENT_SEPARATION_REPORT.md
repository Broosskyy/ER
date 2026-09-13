# M9.3B.3.1 Structured Content Separation Report

Generated: 2026-09-13T19:40:43.505Z
Status: **M9_3B_3_1_STRUCTURED_CONTENT_SEPARATION_VERIFIED**

## Manual QA Finding
- Event: #MITTWOCHENENDE in Odonien (`77f830dd-10c9-4643-adaf-15febd278f60`)
- Lineup/genre metadata was shown under Beschreibung while structured lineup remained empty.

## Root Cause
- ticket.io descriptions kept structured lineup blocks in canonical description.
- Editorial extraction did not remove lineup/genre blocks after structural parsing.
- Condensed ticket.io bullet separator `●` was not handled in legacy lineup parsing.

## Fix
- Generic `separateStructuredEventContent` segments lineup, genres, tickets, schedule, and legal boilerplate before description residual evaluation.
- Import enrichment and quality contract gate now evaluate structured leakage before publication.
- Staging repair plan separates description residual and merges recoverable lineup structurally.

## Inventory
- Eligible events: 44
- Repaired events: 0
- Published structured leakage after: 0

## Odonien After
- lineupLeakageInDescription: false
- genreHashtagLeakageInDescription: false
- placeholderTBAInLineup: false
- structuredLineupComplete: true

## Safety
- Production mutations: 0
- Consumer parity failures: 0
- Idempotency stable: true

Artifacts: `artifacts/m9-3b-3-1-structured-content-separation/`
