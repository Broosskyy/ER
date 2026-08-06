# Gold Standard Events

Permanent reference dataset for Eternal Rave import platform validation.
Established in **Phase 4.8.0** — do not extend without architecture review.

| Key | Event ID | Label | Platform |
|-----|----------|-------|----------|
| ship | `evt-1785339420043-obhyeev` | Bootshaus on a Ship Vol. III | ticket_io |
| levi | `evt-1785339383539-0lxvjlp` | LEVI | ticket_io |
| underland | `evt-1785389049895-4mb7dub` | Underland | ticket_io |
| bc173 | `evt-1785339392687-tbdwup4` | BC173 | ticket_io |
| sommerfest | `evt-1785389055557-ux20897` | Sommerfest Elektroküche | ticket_kings |
| mdma | `evt-1785443911160-owt97y3` | MDMA | ticket_kings |
| affenkaefig | `evt-1785339005035-wam829k` | Affenkäfig | ticket_io |
| proton | `evt-1785443914377-7g9l545` | PROTON Stuttgart | ticket_kings |

## Public URLs

### Bootshaus on a Ship Vol. III
- **Official website:** https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iii
- **Ticket platform:** https://bootshaus-club.ticket.io/wUc3uQrR/

### LEVI
- **Official website:** https://bootshaus.tv/events/nightswithus-presents-levi
- **Ticket platform:** https://bootshaus-tickets.ticket.io/YvJnLSXd/

### Underland
- **Official website:** https://affenkaefig.info/event/underland-essigfabrik-05-09-2026
- **Ticket platform:** https://bootshaus-club.ticket.io/C7JPnatZ/

### BC173
- **Official website:** https://bootshaus.tv/events/19-9-26-bc173-airport-session-pres-by-bootshaus
- **Ticket platform:** https://bootshaus-club.ticket.io/fjspvLe4/

### Sommerfest Elektroküche
- **Official website:** https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026
- **Ticket platform:** https://ticketkings.de/event/sommerfest-elektrokueche-08-08-2026/

### MDMA
- **Official website:** https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/
- **Ticket platform:** https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/

### Affenkäfig
- **Official website:** https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln
- **Ticket platform:** https://bootshaus-club.ticket.io/B3jK8aPC/

### PROTON Stuttgart
- **Official website:** https://ticketkings.de/event/m-d-m-a-xxx-proton-xxx-stuttgart/
- **Ticket platform:** https://ticketkings.de/event/m-d-m-a-xxx-proton-xxx-stuttgart/


## Special validation focus

- **Bootshaus on a Ship Vol. III:** reference_success, evidence_sources, merge_decisions
- **LEVI:** missing_price, event_specific_url, availability, genres, lineup
- **Underland:** ticket_destination, browser_redirect, event_specific_url, cache_behaviour
- **BC173:** prices, phases, badges
- **Sommerfest Elektroküche:** checkout, public_page, ticket_phases, badges, provider, genres, venue, lineup
- **MDMA:** checkout, lineup_truth, garbage_artist_prevention, venue, genres
- **Affenkäfig:** ticket_io, lineup, venue, badges
- **PROTON Stuttgart:** checkout, prices, phases, badges, lineup, venue
