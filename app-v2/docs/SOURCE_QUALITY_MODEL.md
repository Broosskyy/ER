# Source Quality Model

## Resolver

`SourceQualityResolver` — `src/features/sources/domain/source-quality-resolver.ts`

## Output

```typescript
{
  qualityScore: 0..100;
  tier: 'A' | 'B' | 'C' | 'D' | 'unknown';
  missingFields: string[];
  strengths: string[];
}
```

## Method

Weighted completeness across canonical import events from the source: title, dates, venue, city, coordinates, description, genres, lineup, image, ticket, organizer, original link.

## Separation from health

| Health | Quality |
|--------|---------|
| Sync success, failures, staleness | Field completeness across events |
| Operational | Editorial |

Admin source detail displays both scores from `AdminMultiSourceService.loadSourceDetailContext()`.
