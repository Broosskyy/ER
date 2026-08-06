# Future Placement Engine Contract

**Status:** Design contract only. Phase 4.6 does not implement campaigns,
payments, billing, checkout, or sponsored ranking.

## Purpose

Home and discovery surfaces currently use editorial/algorithmic section
configuration. A future placement engine may add time-bound and geographically
targeted placements without changing canonical Event data or the existing
discovery eligibility rules.

## Zones

- `home_hero`
- `home_upcoming_highlights`
- `home_featured`
- `home_trending`
- `home_clubs`
- `home_organizers`
- `home_genre`
- `search_promotion`
- `feed_promotion` (reserved)

## Placement record

```ts
type PlacementEntityType =
  | 'event'
  | 'artist'
  | 'venue'
  | 'organizer'
  | 'festival'
  | 'community';

type PlacementOrigin = 'manual' | 'editorial' | 'algorithmic' | 'sponsored';

interface PlacementContract {
  id: string;
  entityType: PlacementEntityType;
  entityId: string;
  zone: string;
  priority: number;
  startsAt: string;
  endsAt: string;
  geographicTarget?: {
    cityId?: string;
    center?: { latitude: number; longitude: number };
    radiusKm?: number;
  };
  origin: PlacementOrigin;
  sponsorshipLabel?: string;
  campaignId?: string;
}
```

## Invariants

1. A placement references an existing canonical, publicly eligible entity.
2. Placement never changes Event truth, trust, lifecycle, price, availability,
   or provenance.
3. Expired or not-yet-active placements are not returned.
4. Sponsored content is visibly labeled and cannot use an organic origin.
5. Radius, duration and zone prominence may influence future pricing, not
   eligibility.
6. Organic discovery remains available in every mixed zone.
7. Placement ordering is deterministic: zone, active window, priority, then
   stable placement ID.
8. Geographic targeting is optional; missing targeting means the zone's normal
   scope, not global reach by accident.
9. Campaign deletion must not delete the referenced entity.
10. Search and future Feed consume the same read contract but retain their own
    relevance and fairness policies.

## Future commercial direction

- Clubs and Organizers may purchase reach by radius, duration and zone.
- More prominent zones and larger geographic reach may cost more.
- Editorial and sponsored placements can coexist only with clear origin labels.
- Billing, inventory, campaign approval and fraud controls require a separate
  architecture and are intentionally outside Phase 4.6.
