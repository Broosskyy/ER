# Source Discovery Strategies

## Detection order

The discovery engine (`runSourceDiscovery`) combines:

1. Known platform (hostname registry)
2. Website document signals (`detectWebsiteDocument`)
3. HTML framework markers (WordPress, Tribe Events)
4. Ticket embed signatures (e.g. Nacht Manager)
5. Bot-protection heuristics

## Acquisition strategies (registry)

Defined in `acquisition-strategy-registry.ts`:

| Strategy | Use case |
|----------|----------|
| `json_ld` | schema.org Event / MusicEvent |
| `wordpress_rest` | WordPress REST API |
| `tribe_events` | The Events Calendar |
| `woocommerce` | WooCommerce events |
| `ical` | ICS feeds |
| `rss` | RSS/Atom |
| `html_cards` | Recurring HTML event cards |
| `embedded_json` | Next.js/Nuxt embedded payloads |
| `ticket_platform` | ticket.io, Ticket Kings, etc. |

## Platform adapters

Only for true platform specifics (`platform-registry.ts`):

- **Production-ready:** `ticket_io`, `ticket_king`, `bootshaus_website`, `affenkaefig_website`
- **Placeholders (Sprint 33):** Resident Advisor, DICE, Shotgun, Eventbrite — identification and capability model only, no fake connectors.

## Evidence model

Each step returns `{ step, result, confidence, evidence, warnings? }` — no bare booleans.

## Config output

`generateDeclarativeSourceConfig()` produces versioned JSON (no executable code). Validated by `validateDeclarativeSourceConfig()`.
