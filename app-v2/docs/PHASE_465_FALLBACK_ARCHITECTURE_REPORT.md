# Phase 4.6.5 — Detail Fallback Architecture & Flyer Enrichment

Generated: 2026-08-02T20:31:43.964Z

## 1. Fallback architecture

Each canonical field selects the strongest available evidence independently. Blocked Ticket.io detail origins (ALTCHA PoW) cannot clear or downgrade stronger website or list-level data.

Modules:
- `field-fallback-priority.ts` — per-field origin priority chains
- `blocked-origin-guard.ts` — PoW/detail-block detection and overwrite rejection
- `publish-quality-gate.ts` — pre-publish quality validator
- `flyer-enrichment-contract.ts` — reusable flyer stage contract (inventory only this phase)
- `event-data-blocker-classifier.ts` — exact blocker taxonomy

## 2. Field priority matrix

See `docs/real-data/_phase465_fallback_matrix.json` and `FIELD_FALLBACK_CHAINS` in code.

## 3. Quality gate

Integrated into `FieldTrustMergeService`. Rejects: empty→populated, shorter description, fewer genres, worse ticket URL, blocked-origin clears.

## 4. Flyer inventory

Events with missing lineup/description but official artwork are inventoried in `_phase465_flyer_inventory.json`. No OCR or auto-publish in this phase.

## 5. Remaining blockers

- `external_security_limitation` — Ticket.io ALTCHA blocks server-side detail HTML
- `awaiting_flyer_enrichment` — lineup/description likely on artwork only
- `source_has_no_data` — origin never supplied field

## 6. Next implementation phase

1. Wire flyer enrichment stage after textual fallback exhaustion (review-gated OCR)
2. Enable `genericSourceFieldTrustMerge` in production after ops validation
3. Persist flyer extraction provenance per event origin

## Artifacts

- `docs/real-data/_phase465_fallback_matrix.json`
- `docs/real-data/_phase465_flyer_inventory.json`
- `docs/real-data/_phase465_quality_gate.json`