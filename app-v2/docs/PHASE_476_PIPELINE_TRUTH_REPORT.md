# Phase 4.7.6 — Canonical Pipeline Truth Report

Generated: 2026-08-04T14:32:31.368Z

**READ ONLY. No repairs. No cache invalidation.**

## Reference

Bootshaus on a Ship Vol. III (`evt-1785339420043-obhyeev`)

## Compared Events

- LEVI: `evt-1785339383539-0lxvjlp`
- Underland: `evt-1785389049895-4mb7dub`
- Sommerfest Elektroküche: `evt-1785389055557-ux20897`
- MDMA 10.10: `evt-1785443911160-owt97y3`
- MDMA F2F: `evt-1785389054496-ns9b6la`
- PROTON Stuttgart: `evt-1785443914377-7g9l545`
- Affenkäfig: `evt-1785339005035-wam829k`
- Unreal Weekender I: `evt-1785339397255-frpjss3`
- Unreal Weekender II: `evt-1785339412398-hq6217j`
- Blacklist Festival: `evt-1785339398765-9lptzhg`
- Palma (TRIPOLISM): `evt-1785339424521-tn10siz`
- Technodampfer Köln: `evt-1785506426366-bujnxz7`

## Key findings

### LEVI — correct ticket URL, no price
- **First divergence: Connector**
- Ticket.io list import for `bootshaus-tickets` shop emits event slug but no `priceText`
- Ship succeeds because bootshaus.tv / merged origin supplies price
- Code: `normalize-ticket-event.ts` → `FIELD_FALLBACK_CHAINS.priceText`

### Underland — user-reported generic Bootshaus page
- **DB persistence shows event-specific** `bootshaus-club.ticket.io/C7JPnatZ/`
- If consumer shows shop root → divergence at **Cache** or ticket.io server redirect (not code path)
- Affenkäfig origin + Bootshaus ticket.io enrichment duplicate pattern

### Palma cluster — shop root CTA
- **First divergence: Merge**
- `ticket_platform_list` fills `ticketUrl` with shop root when event slug absent
- Code: `canonical-ticket-selection.ts`, `field-fallback-priority.ts`

### MDMA / garbage artists
- **First divergence: Persistence** → **ViewModel**
- Title-slug artists persist; consumer filters them → empty lineup display

## Deliverables

- `docs/ARCHITECTURE_PIPELINE_DIFF.md`
- `docs/real-data/_phase476_*.json`

## Phase 4.7.7.1 note

Audit taxonomy corrected; pipeline architecture unchanged. Re-run `_phase476-canonical-pipeline-truth-audit.ts audit` after taxonomy update.
