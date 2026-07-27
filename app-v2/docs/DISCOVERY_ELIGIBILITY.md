# Discovery Eligibility

## Resolver

`DiscoveryEligibilityResolver` — `src/features/events/discovery/discovery-eligibility-resolver.ts`

## Surfaces

| Surface | Eligibility flag |
|---------|------------------|
| Home featured | `homeFeaturedEligible` |
| Events list | `eventsListEligible` |
| Search | `searchEligible` |
| Map | `mapEligible` |
| Similar events | `similarEventsEligible` |

## Rules (foundation)

- Event must be published
- No unresolved critical conflicts (when conflict data provided)
- Source not blocked
- Quality tier above minimum threshold per surface

## Status

Resolver implemented; full wiring to all consumer queries is incremental. Ranking and diversity services consume eligibility-compatible `RankableEvent` inputs.

## Non-goals

No global search implementation in this sprint.
