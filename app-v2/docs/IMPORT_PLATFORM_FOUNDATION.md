# Import Platform Foundation

Phase 4.8.0 factual basis for the next-generation import platform.
**No implementation in this phase.**

## Architecture recommendation

Existing import_records + merge pipeline should evolve into Import Platform ingestion jobs — not replaced wholesale.

### Retain from current pipeline

- Normalized candidate extraction (getEffectiveCandidate)
- Multi-source merge with field trust / ownership matrix
- Evidence metadata on import_records
- Canonical ticket read/write separation

### Modernize

- Connector evidence tiers (list vs detail vs checkout)
- Public-source observation harness (this phase)
- ALTCHA / bot-protection detection as first-class blocked state
- Lineup garbage filtering at evidence boundary

### Replace

- Ad-hoc ops repair scripts as primary correction path
- Audit-only validation without public ground truth fetch

## Evidence from gold-standard validation

- **Reference success:** Bootshaus on a Ship — multi-source merge (bootshaus.tv + bootshaus-club.ticket.io) with sold-out availability.
- **Blocked evidence:** LEVI — bootshaus-tickets ALTCHA prevents list price extraction.
- **Third-hop tickets:** Ticket Kings → Nacht-Manager checkout embed for phases/prices.
- **Lineup integrity:** MDMA — public "Folgt noch" vs legacy garbage artifacts (filtered post Gate C).

## Root cause distribution

- Public Source: 33
- Projection: 19
- Third-party platform: 13
- Browser: 1
- Canonical Merge: 3
- Evidence Extraction: 2
- Connector: 2
