# Connector Decision Matrix

Phase 4.8.0 — KEEP / MODERNIZE / REPLACE recommendations (observation only).

## Connectors

| Connector | Verdict | Rationale |
|-----------|---------|-----------|
| ticket-io | **MODERNIZE** | Production-proven for bootshaus-club slug; bootshaus-tickets ALTCHA gap blocks list price evidence (LEVI). Needs evidence-tier abstraction in future Import Platform. |
| ticket-kings | **MODERNIZE** | Detail + Nacht-Manager checkout enrichment works for MDMA/Sommerfest/PROTON; sidebar garbage and slug drift risks remain. |
| website | **KEEP** | bootshaus.tv + affenkaefig.info JSON-LD remains authoritative for official pages; pair with ticket platform, never replace. |

## Sources (observed in gold-standard events)

| Source ID | Connector | Events | Verdict | Rationale |
|-----------|-----------|--------|---------|-----------|
| `source-bootshaus-ticket-io` | — | ship, underland, affenkaefig | **KEEP** | Stable evidence for gold-standard events |
| `source-bootshaus-koeln` | — | ship, levi, bc173, affenkaefig | **KEEP** | Stable evidence for gold-standard events |
| `source-ticket-io-bootshaus-club` | — | ship, affenkaefig | **KEEP** | Stable evidence for gold-standard events |
| `source-affenkaefig` | — | underland, sommerfest, affenkaefig | **MODERNIZE** | Official website source — high trust for venue/lineup but needs structured field contract |
| `source-ticket-kings-org-elektrokuche` | — | sommerfest, mdma, proton | **MODERNIZE** | Checkout embed (Nacht-Manager) adds third-hop evidence complexity |
| `source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt` | — | sommerfest, mdma, proton | **MODERNIZE** | Checkout embed (Nacht-Manager) adds third-hop evidence complexity |
| `source-affenkaefig-ticket-kings` | — | sommerfest, mdma, proton | **MODERNIZE** | Checkout embed (Nacht-Manager) adds third-hop evidence complexity |
| `source-ticket-kings-org-underland` | — | sommerfest, mdma, proton | **MODERNIZE** | Checkout embed (Nacht-Manager) adds third-hop evidence complexity |
