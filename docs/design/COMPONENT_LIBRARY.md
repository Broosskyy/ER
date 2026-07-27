# Eternal Rave Component Library

This document is the migration contract for the theme-aware component library in
`app-v2/src/components`. It documents presentation components only: repositories,
routers, Supabase, authentication, payments, ticket scanning, follows, claims,
and social mutations stay outside this layer.

## Canonical families

| Family | Canonical components | Allowed scope |
| --- | --- | --- |
| Theme and primitives | `AppText`, `AppIcon`, `Stack`, `Section`, `Spacer`, `Divider` | Semantic typography, tokenized icons, layout |
| Buttons | `PrimaryButton`, `SecondaryButton`, `GhostButton`, `DestructiveButton`, `IconButton`, `TextButton` | A clear action hierarchy; use `IconButton` only with an accessibility label |
| Inputs | `AppTextInput`, `SearchField`, `SearchBar`, `MultilineInput` | `SearchField` is compact; `SearchBar` is full-width |
| Feedback | `Badge`, `Banner`, `EmptyState`, `Skeleton`, `Toast` | Base feedback visuals and transient UI |
| Layout and cards | `Surface`, `CardFoundation`, `InteractiveCard`, `Container`, `ListSeparator` | `Surface` is a neutral grouped container; `CardFoundation` is content-card chrome and optional press handling |
| Overlays | `AppModal`, `Dialog`, `BottomSheet` | Modal = generic centered content; Dialog = confirm/alert composition; BottomSheet = mobile-origin sheet |
| Discovery | `EventCard`, `EventListItem`, `EventImage`, `EventMetaRow`, chips and entity rows | Mockups 09–14, 54–55; UI-only discovery models |
| Ticketing | `TicketCard`, `TicketTypeCard`, `TicketSummary`, `QRCodePlaceholder` | Mockups 16–17, 54; no checkout, orders, QR payloads, or fees calculation |
| Profiles and organizer | `ProfileHeader`, `FollowButton`, `ProfileStats`, `ProfileTabs`, `VerificationBadge`, `OrganizerProfileCard`, `OrganizerClaimBadge`, `TeamMemberRow` | Mockups 15, 38, 39, 50, 55; no profile routing, follow, claim, or team logic |

## Status contracts

Status types are presentation contracts. Their resolvers map an already-known
state to text, icon, and semantic `Badge` styling; they must not perform state
transitions or infer domain data.

| Domain | Type / resolver | Notes |
| --- | --- | --- |
| Event | `EventStatus` / `resolveEventStatus` | `upcoming`, `today`, `sold_out`, `cancelled`, `postponed`, `draft`, `pending_review`, `verified`, `unverified` |
| Ticket display | `EventTicketStatus` / `resolveTicketStatus` | Availability and issued-ticket labels share one display resolver. `sold_out` means availability; `used` means an issued ticket lifecycle state. |
| Verification | `VerificationStatus` / `resolveVerificationStatus` | `verified`, `pending`, `unverified`, `rejected` |
| Organizer claim | `OrganizerClaimStatus` | `unclaimed`, `pending`, `verified`, `rejected`; composed directly with `Badge` |

Identical visible labels are permitted only when their surrounding component
defines the entity context. For example, a verified event and verified organizer
both display “Verifiziert”, but must use `EventStatusBadge` and
`VerificationBadge` respectively.

## View models

Discovery, ticketing, and profile models are display-only contracts. They carry
preformatted labels and optional image sources. A parent maps domain data before
rendering and owns all callbacks:

- `EventCardViewModel`, `EventListItemViewModel`, and related discovery models
- `TicketCardViewModel`, `TicketTypeViewModel`, `TicketSummaryViewModel`
- `ProfileHeaderViewModel`, `OrganizerProfileViewModel`, `TeamMemberViewModel`

Do not import repositories, routing, Supabase clients, or feature services into
these component directories.

## Legacy and deprecation guidance

| Existing component | Decision | Migration guidance |
| --- | --- | --- |
| `SurfaceCard` | DEPRECATE LATER | Existing legacy surface-card API. Use `CardFoundation` for new content cards; migrate callers only while editing their screen. |
| `features/home/components/EventCard` | KEEP | Product-coupled card; do not replace globally. Migrate a screen deliberately to discovery `EventCard` later. |
| `SearchResultItem` | KEEP | A semantic event-only wrapper around `EventListItem`; retain until a search result layout needs different content. |
| `ActivityContent` / `NotificationRow` | KEEP | Notifications are not social posts or organizer updates. |
| `BottomTicketCTA` | KEEP | Existing external-ticket product CTA; ticketing library does not replace it. |

## Migration rules

1. Preserve product behavior first. Migrate one screen at a time with focused
   tests; never replace similarly named legacy components wholesale.
2. Use theme roles, spacing, radii, and layout tokens. Do not introduce raw
   hex colors or parallel elevation systems.
3. Keep interactive APIs explicit: provide `onPress`, `disabled`, `loading`,
   `accessibilityLabel`, and `testID` where applicable rather than embedding
   routing or business logic.
4. Preserve semantic separation between status wrappers and the base `Badge`.
5. Validate each migration in Light/Dark and at narrow, wide mobile, tablet, and
   web widths through `/design-preview` or targeted screen coverage.

## Preview

`/design-preview` is the isolated acceptance surface. It groups the Theme,
Phase 1A primitives, Phase 1B foundations, Phase 2A discovery, and Phase 2B
ticket/profile/organizer components. It is not a product route pattern.
