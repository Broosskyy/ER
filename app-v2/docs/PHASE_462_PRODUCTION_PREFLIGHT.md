# Phase 4.6.2 Production Preflight

Generated: 2026-08-02T08:54:30.377Z

## Summary
- Affected sources: 12
- Affected events: 99
- Expected updates: 99
- Expected unchanged: 0
- Expected blocked (no import record): 0
- Ticket offers recoverable: 0
- Lineups recoverable: 42
- Descriptions recoverable: 30

## Go / No-Go
- Migration: **no_go**
- Re-import: **no_go**

## Recommended re-import order
1. source-bootshaus-koeln
2. source-affenkaefig
3. source-musik-die-mich-antreibt
4. ticket_platform active shops (Ticket.io)
5. ticket_platform enrichment (Ticket.io)
6. ticket_king affected shops

## Migration prerequisites
- Deploy 20260802100000_phase462_publish_fields_and_ticket_phases.sql
- Deploy 20260801120000_phase46_entity_follows.sql only when follow UX approved
- Verify validate:build-output passes after web bundle split
- Enable genericSourceFieldTrustMerge in target environment

Full JSON: docs/real-data/_phase462_production_preflight.json