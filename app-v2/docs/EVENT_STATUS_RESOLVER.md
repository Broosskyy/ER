# Event Status Resolver

## Location

`src/features/events/status/event-status-resolver.ts`

## Supported consumer statuses

`cancelled`, `postponed`, `date_changed`, `venue_changed`, `sold_out`, `selling_fast`, `free`, `today`, `tomorrow`, `this_weekend`, `featured`, `newly_added`, `verified`, `official_organizer`, `external_source`, `age_restricted`, `upcoming`

## Priority (highest first)

1. cancelled
2. postponed / date_changed
3. venue_changed
4. sold_out
5. selling_fast (limited)
6. free
7. today / tomorrow / this_weekend
8. featured / newly_added / verified / official_organizer / external_source / age_restricted
9. upcoming

Only the highest-priority mappable status becomes `primaryStatus` on cards (`EventStatus` union).

## API

| Function | Returns |
| --- | --- |
| `resolveEventPresentation(event)` | `{ primaryStatus, ticketStatus, consumerStatuses }` |
| `resolvePrimaryCardStatus(event)` | `EventStatus \| undefined` |
| `resolvePrimaryTicketStatus(event)` | `EventTicketStatus \| undefined` |
| `resolveEventNoticeType(event)` | `'cancelled' \| 'postponed' \| 'sold_out' \| undefined` |
| `isTicketActionDisabled(event)` | `boolean` |

## Screen behaviour

| Screen | Usage |
| --- | --- |
| Events cards | `toEventCardViewModel` → badge on `compactPremium` / `verticalPremium` |
| Event Detail | Hero badges + `EventNoticeBanner` + `EventTicketSection` mode |
| Saved | `saved-presentation.ts` delegates to resolver |
| Map | Existing map selectors unchanged in this sprint |

## Ticket behaviour

- `cancelled` → ticket CTA disabled, notice shown
- `postponed` → ticket CTA informational, notice shown
- `sold_out` → ticket status badge + disabled CTA
- `free` → free ticket mode, CTA remains active when URL exists

## Demo overrides

- `klangkuenstler-berghain` → `postponed` (presentation QA fixture)

## Conflicts

- Cancelled/postponed suppress ticket status on presentation output
- Featured does not render as a card badge (no `EventStatus` mapping) — used for placement only
- Past events without special status show no primary badge

## Extension points

- Organizer/admin can reuse `resolveEventPresentation` once domain status fields expand
- `newly_added` window prepared via `NEWLY_ADDED_WINDOW_MS` constant (not yet wired to import timestamps)
