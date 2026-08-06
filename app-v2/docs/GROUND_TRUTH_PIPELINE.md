# Ground Truth Pipeline

Phase 4.8.0 defines **public observation** as primary truth — never canonical DB state.

## Trace stages

```
Public Source → Connector/Importer → Evidence Extraction → Evidence Objects
  → Canonical Merge → Canonical Writer → Database → Canonical Reader
  → Projection → API → ViewModel → Mobile UI → Observed Consumer Result
```

## Rules

1. Ground truth is fetched from official website + ticket platform at observation time.
2. Each field mismatch gets exactly **one** earliest divergence stage.
3. ALTCHA/POW on Ticket.io is classified as **Third-party platform** blocker — not a pipeline defect.
4. No repairs in this phase.

## Summary (8 events)

- **Bootshaus on a Ship Vol. III:** 12 non-identical fields; notes: Ticket.io detail page blocked by ALTCHA/POW challenge — list/detail price evidence may be incomplete.
- **LEVI:** 8 non-identical fields; notes: Ticket.io detail page blocked by ALTCHA/POW challenge — list/detail price evidence may be incomplete.; LEVI: bootshaus-tickets shop list returns 0 rows; price not publicly extractable without bypassing bot protection.
- **Underland:** 7 non-identical fields; notes: Ticket.io detail page blocked by ALTCHA/POW challenge — list/detail price evidence may be incomplete.; Underland ticket redirect observed: requested https://bootshaus-club.ticket.io/C7JPnatZ/ → final https://bootshaus-club.ticket.io/C7JPnatZ/
- **BC173:** 5 non-identical fields; notes: Ticket.io detail page blocked by ALTCHA/POW challenge — list/detail price evidence may be incomplete.
- **Sommerfest Elektroküche:** 13 non-identical fields; notes: Sommerfest canonical ticketUrl may differ from affenkaefig official page slug (20-06 vs 08-08) — verify merge winner.
- **MDMA:** 10 non-identical fields; notes: none
- **Affenkäfig:** 9 non-identical fields; notes: Ticket.io detail page blocked by ALTCHA/POW challenge — list/detail price evidence may be incomplete.
- **PROTON Stuttgart:** 9 non-identical fields; notes: none
