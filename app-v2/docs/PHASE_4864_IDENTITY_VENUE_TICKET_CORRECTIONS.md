# Phase 4.8.6.4 — Identity, Venue & Ticket Corrections

Controlled production corrections for confirmed cross-Event contamination (R3HAB / Underland Ticket.io slug collision, Sommerfest venue mismatch).

## Scope

| Gate | Event | Action |
|------|-------|--------|
| A | `evt-1785389049895-4mb7dub` (Underland) | Ticket Kings CTA, deactivate stale Ticket.io ref, clear borrowed price |
| B | `evt-1785339391167-tfaixrr` (Sommerfest) | `venueName` → Bootshaus, deactivate stale Underland Ticket Kings refs |
| C | `evt-1785339421539-k3swcrl` (R3HAB) | Ticket.io enrichment: `ab 23,90 €` (after Gate A) |
| D | `evt-1785339386612-rjr91mv` (Into The Madness) | Read-only — no auto-repair |
| E | Consumer reality check | DB → projection → checklist |

## Commands

```bash
npm run audit-phase4864-preflight
npm run audit-phase4864

# Per gate (preview then apply)
tsx scripts/operations/_phase4864-identity-venue-ticket-corrections.ts preview-gate-a
PHASE4864_APPLY_APPROVED=true tsx scripts/operations/_phase4864-identity-venue-ticket-corrections.ts apply-gate-a --approve
```

Apply requires `PHASE4864_APPLY_APPROVED=true` and `--approve`. No broad `full` command.

## Artifacts

- `docs/real-data/_phase4864_final_preflight.json`
- `docs/real-data/_phase4864_backup.json`
- `docs/real-data/_phase4864_gate_*.json`
- `docs/real-data/_phase4864_consumer_verification.json`
- `docs/real-data/_phase4864_verdict.json`

## Code

- `src/features/import/controlled-identity-corrections/`
- `scripts/operations/_phase4864-identity-venue-ticket-corrections.ts`

## Constraints

- Legacy Website path remains enabled
- No broad Ticket.io scheduling activation
- Into The Madness requires separate explicit approval
