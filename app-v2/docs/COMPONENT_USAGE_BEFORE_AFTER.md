# Component Usage — Before / After

## Events Screen

| Area | Before | After | Reason |
| --- | --- | --- | --- |
| Trending section | Custom `ExplorePosterGrid` / `ExplorePosterCard` | Horizontal rail with `verticalPremium` / `featuredHome` via `EventDiscoveryCard` | Reuse established card family instead of bespoke poster layout |
| Explore sections | Hardcoded German titles | `SearchSectionHeader` + `search.explore.*` i18n keys | Align with design system section headers and localization |
| Explore lists | `compactPremium` without favorites | `compactPremium` with save state from `ExploreFeed` props | Saved-state consistency with search results |
| Filter summary | `FilterSummaryBar` with hardcoded `"Clear All"` | `t('search.filters.clearAll')` | German UI consistency |
| Search results | `compactPremium` (unchanged) | `compactPremium` + status badges via central resolver | Data-driven badges without new card family |

## Event Detail Screen

| Area | Before | After | Reason |
| --- | --- | --- | --- |
| Hero | `EventDetailHero` (features layer) | `EventHero` (Phase 2F component) | Mockup 11 alignment |
| Metadata | Manual `EventInfoRow` rows | `EventInfoSection` + `EventMetaRow` | Specialized detail block |
| Description | `ExpandableDescription` (features) | `ExpandableText` via `EventInfoSection` | Component system reuse |
| Line-up | `LineupList` bullets | `LineupSection` + `LineupItem` | Mockup 11 lineup presentation |
| Venue | `LocationSection` | `VenueDetailCard` | Rich venue block with directions CTA |
| Organizer | Plain `EventInfoRow` | `OrganizerDetailCard` | Dedicated organizer presentation |
| Tickets | Fixed `BottomTicketCTA` only | `EventTicketSection` with status modes | Visible ticket block with sold-out/cancelled handling |
| Status notices | Not rendered | `EventNoticeBanner` for cancelled/postponed | Required consumer status communication |
| Similar events | `SimilarEventsSection` list (kept) | `SimilarEventsSection` + `EventListItem` via view-model mapper | Retained; IDs from real repository data |
| Localization | Mixed EN/DE hardcoded strings | `eventDetail.*` i18n namespace | Consistent German product copy |

## Removed Simplified Layouts

- `ExplorePosterGrid` no longer used by `ExploreFeed` (file retained for reference)
- `EventDetailHero`, `EventInfoRow`, `EventSection`, `LineupList`, `LocationSection`, `BottomTicketCTA` removed from live Event Detail route
- Inline `getCountdownLabel` helper removed from Event Detail screen

## Intentional Remaining Differences

- Genre chips below the notice banner remain interactive (`CategoryChip`) even though `EventHero` also shows genres — chips navigate to filtered Events search
- Organizer card is informational only (no profile route in V1)
- Source label uses demo-capsulated copy (`Eternal Rave Demo`) without external URL for demo events
