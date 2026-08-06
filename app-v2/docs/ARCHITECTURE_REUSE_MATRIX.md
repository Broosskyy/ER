# Architecture Reuse Matrix

Phase 4.8.0 — subsystem verdicts for Import Platform foundation (read-only).

## Subsystem decisions

| Subsystem | Verdict | Reuse for Import Platform | Justification |
|-----------|---------|---------------------------|---------------|
| Source Registry | **KEEP_WITH_REFACTOR** | Yes | Gold-standard events prove multi-source origins work; registry needs explicit evidence-tier and bot-block metadata per source. |
| Connector Layer | **MODERNIZE** | Yes | ticket-io and ticket-kings connectors produce evidence but ALTCHA/list/checkout hops are inconsistent (LEVI vs Ship). |
| Import Layer | **KEEP_WITH_REFACTOR** | Yes | import_records + normalized candidates are stable; evolve job orchestration without replacing candidate model. |
| Evidence Model | **MODERNIZE** | Yes | Metadata on import_records exists but lacks uniform tiering (list/detail/checkout) and blocked-state typing. |
| Merge Engine | **KEEP** | Yes | Underland ticket.io URL vs affenkaefig TK offer shows merge correctly prefers ticketing source; Ship sold-out merge works. |
| Canonical Event | **KEEP** | Yes | events table + admin record mapping is the stable persistence anchor across all 8 reference events. |
| Ticket Domain | **KEEP_WITH_REFACTOR** | Yes | readCanonicalTicket/writeCanonicalTicket separation is correct; extend for third-hop checkout and blocked evidence states. |
| Lineup Domain | **MODERNIZE** | Yes | MDMA garbage filtering works post-Gate C but public "Folgt noch" vs structured lineup contract is immature. |
| Venue Domain | **KEEP_WITH_REFACTOR** | Yes | Venue labels differ in quality between Bootshaus-linked vs external venues; denormalized fields need trust rules. |
| Media Domain | **KEEP** | Yes | Flyer/gallery from bootshaus.tv og:image and affenkaefig JSON-LD image propagate to consumer gallery projection. |
| Projection Layer | **KEEP_WITH_REFACTOR** | Yes | projectCanonicalEventFields is the single consumer truth path; some fields (date on bootshaus.tv) need richer public parsers. |
| Consumer Layer | **KEEP** | Yes | Ticket badge + display price bridge correctly reflects canonical ticket domain for TK and Ticket.io events. |
| Review System | **KEEP_WITH_REFACTOR** | Yes | Review queue still needed for lineup_partial and slug-drift cases (Sommerfest); integrate with evidence gaps not audit scores. |
| Audit System | **MODERNIZE** | No | Phase 4.7 audits missed public-truth gaps (73 field divergences vs public). Audits must consume ground-truth harness. |

## Final verdict

### 1. Is the current Event Engine fundamentally reusable?

**Yes** — Canonical event persistence, merge engine, ticket read/write, and projection layer produce correct consumer output when public evidence is extractable (Ship, Underland, MDMA checkout path).

### 2. Which architectural parts are already correct?

- Canonical Merge (multi-source URL/price winners)
- Canonical Event persistence model
- Ticket Domain (readCanonicalTicket + destination classification)
- Consumer ticket badge projection
- Media/gallery projection from flyer URLs

### 3. Which parts should be modernized?

- Connector Layer (evidence tiers, ALTCHA handling)
- Evidence Model (structured blocked/missing states)
- Lineup Domain (public partial vs structured contract)
- Audit System (ground-truth-driven, not score-driven)

### 4. Which parts should be rebuilt?

- None — incremental modernization sufficient

### 5. Which parts should never be touched?

- Canonical Merge Engine
- Canonical Event table schema
- readCanonicalTicket / canonical-ticket-read
- projectCanonicalEventFields
- Multi-source import_records provenance

### 6. Reused unchanged if rebuilt today

- events + event_lineup_entries schema
- import_records + normalized_payload candidates
- Field trust / ownership merge matrix
- canonical-ticket-read + canonical-ticket-writer
- canonical-lineup-read + garbage artifact flags
- canonical-event-projection.ts
- ticket-io list price evidence (bootshaus-club slug)
- ticket-kings-public-checkout enrichment
- bootshaus.tv / affenkaefig JSON-LD website adapters

## Import Platform foundation subsystems

- Source Registry
- Import Layer
- Merge Engine
- Canonical Event
- Ticket Domain
- Venue Domain
- Media Domain
- Projection Layer
- Consumer Layer
- Review System
