# Sprint 5 — Changed Files

## Created

| Path | Purpose |
|------|---------|
| `src/services/publicFeedService.ts` | Paginated published feed via repository |
| `src/utils/entityToEventMapper.ts` | EventEntity → UI Event |
| `src/utils/feedUtils.ts` | Featured/trending/new/category helpers |
| `src/components/EventFeedList.tsx` | Virtualized feed list + infinite scroll |
| `app/discovery.tsx` | Discovery screen |
| `docs/reports/sprint-5/*` | Sprint deliverables |

## Modified

| Path | Change |
|------|--------|
| `app/(tabs)/home.tsx` | Trending, new events, categories, discovery links |
| `app/_layout.tsx` | Register `/discovery` route |
| `src/hooks/usePublicEventFeed.ts` | Sections + pagination API |
| `src/hooks/useEventStore.tsx` | Paginated feed load + loadMore |
| `src/repositories/eventRepository.ts` | orderBy + pagination fix |
| `src/domain/event/types.ts` | Pagination orderBy fields |
| `src/constants/theme.ts` | `DiscoveryCategories` |
| `src/types/event.ts` | `publishedAt` field |
| `src/utils/eventMappers.ts` | Map `published_at` from rows |
| `src/components/index.ts` | Export EventFeedList |
