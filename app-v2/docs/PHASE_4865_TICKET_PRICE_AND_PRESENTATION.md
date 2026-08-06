# Phase 4.8.6.5 — Ticket Price Truth & Consumer Presentation

Read-only contract phase. **No production mutations.**

## Findings summary

| Event | Missing price cause | UI duplication |
|-------|---------------------|----------------|
| Underland | `VALID_EVIDENCE_NOT_PERSISTED` — Nacht-Manager proves **ab 15,00 €** Early Bird | No price shown (data gap) |
| LEVI | `PUBLIC_PRICE_NOT_AVAILABLE` — bootshaus-tickets shop blocked/unparsed | No price (honest) |
| Sommerfest Elektroküche | Price present | 4× `ab 15,00 €` (header, section, phase, subtotal/total) |
| MDMA | Price present (`ab 34,90 €`) but no phases persisted | Header + raw section text |
| BC173 | Price present | 4× `ab 23,00 €` duplicate surfaces |
| R3HAB | Price present | Header + section standalone duplicate |

## Commands

```bash
npm run audit-phase4865
npx tsx scripts/operations/_phase4865-ticket-price-presentation.ts trace-underland
npx tsx scripts/operations/_phase4865-ticket-price-presentation.ts preview-ui
```

## Approvals required (not executed)

1. **Preview A (Data):** Persist Underland `ab 15,00 €` + admission phase from Nacht-Manager checkout
2. **Preview B (UI):** Generic view-model guards — hide redundant section price / subtotal / total

## Artifacts

- `docs/real-data/_phase4865_*.json`
- `src/features/events/domain/ticket-price-presentation-contract.ts`
- `docs/ARCHITECTURE_TICKET_PRICE_PRESENTATION.md`
