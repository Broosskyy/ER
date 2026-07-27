# Badge / Label / Function Matrix

Central resolver: `src/features/events/status/event-status-resolver.ts`

| Component | Purpose | Data / Condition | Priority | Interactive | Action | Disabled | Screens | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EventStatusBadge` cancelled | Event abgesagt | `archived` status or demo override | 1 | No | — | — | Cards, Detail hero, Saved | `event-status-resolver.test.ts` |
| `EventStatusBadge` postponed | Event verschoben | Demo override `klangkuenstler-berghain` | 2 | No | — | — | Cards, Detail, Saved | resolver + saved filters |
| `EventStatusBadge` sold_out | Ausverkauft | `priceText` contains sold-out markers | 5 | No | — | — | Cards, Detail, Saved | resolver + card VM |
| `EventStatusBadge` today | Heute | Start date = reference day | 7 | No | — | — | Cards | resolver |
| `TicketStatusBadge` free | Kostenlos | `priceText` free/kostenlos | 6 | No | — | — | Cards, Detail | resolver |
| `TicketStatusBadge` limited | Nur noch wenige | `priceText` limited/wenige | 5 | No | — | — | Cards | resolver |
| `EventNoticeBanner` | Absage/Verschiebung | `resolveEventNoticeType()` | — | No | — | — | Event Detail | restoration test |
| `EventTicketSection` CTA | Tickets öffnen | Valid `ticketUrl` + not cancelled/sold out | — | Yes | `openEventTicketUrl` | sold_out/cancelled | Event Detail | restoration test |
| `CategoryChip` | Genre-Filter | `event.genres[]` | — | Yes | Navigate to Events search with genre | — | Event Detail | — |
| `FavoriteButton` | Speichern | `FavoritesProvider` | — | Yes | `toggleFavorite` | — | Hero, Cards, Saved | favorites tests |
| `VenueDetailCard` directions | Route planen | coordinates or address | — | Yes | `openEventInMaps` | no location data | Event Detail | event-actions |
| Source `TextButton` | Quelle ansehen | `event.sourceUrl` truthy | — | Yes | `Linking.openURL` | no URL | Event Detail | — |
| `MapListToggle` | Liste/Karte | local `discoveryView` state | — | Yes | toggles embedded map | — | Events | search layout test |
| `FilterChip` (QuickFilterRow) | Datumsfilter | `filters.dateRange` | — | Yes | updates `SearchContext` | — | Events | filter-events |

## Non-interactive by design

- Status badges on cards (no `onPress`, no button role)
- Organizer detail card without profile route
- Demo source label without URL (disabled `TextButton`, not pressable styling)

## Fake verification excluded

- `verified` badge is not shown unless a real verification state exists in the data model (currently always `unverified` for organizers)
