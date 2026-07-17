# Sprint 5 — Decisions

## S5-D01 — Repository-first public feed

**Decision:** New `publicFeedService` uses `EventRepository.findMany({ status: 'published' })` instead of direct Supabase in `fetchPublishedEvents`.

**Rationale:** Aligns public feed with Sprint 3 domain layer; enables pagination without breaking legacy callers.

## S5-D02 — Incremental store migration

**Decision:** Pagination lives in `useEventStore`; `usePublicEventFeed` remains a thin facade with computed sections.

**Rationale:** Avoids breaking `FavoritesProvider` and other store consumers; minimal diff.

## S5-D03 — Discovery as stack screen

**Decision:** `/discovery` is a push screen, not a new bottom tab.

**Rationale:** Matches existing 5-tab mockup nav; Home links into full discovery feed.

## S5-D04 — Category browse without server filter

**Decision:** Categories filter client-side on loaded events; infinite scroll only when category = `all`.

**Rationale:** Sprint 5 scope excludes Filter infrastructure; server-side genre filter deferred.

## S5-D05 — FlatList for feed

**Decision:** `EventFeedList` uses `FlatList` with `removeClippedSubviews`, batching, and memoized `EventCard`.

**Rationale:** Performance quick win for long feeds without adding new dependencies.

## S5-D06 — Home search bar removed

**Decision:** Home uses Discovery CTA instead of inline search input.

**Rationale:** Sprint 5 excludes Search development; Events tab retains existing search for now.
