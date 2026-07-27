# Multi-Source Event Identity

## Types

`EventIdentity`, `SourceReference` — `src/features/aggregation/identity/event-identity.ts`

## Structure

```typescript
EventIdentity {
  canonicalEventId: string;
  sourceReferences: SourceReference[];
  externalIds: string[];
  fingerprints: { canonical, title, venue, date, organizer, location };
}
```

## Fingerprints

Normalized text + date + venue/location keys for blocking and candidate generation.

## Canonical ID resolution

- **Consumer:** `EventRepository.resolveCanonicalId()` via alias map from `duplicate_decisions` where `decision = 'merged'`
- **Service:** `CanonicalEventIdResolver` in registry

## Rules

- One canonical ID per logical event
- Legacy IDs resolve at read time; saved references are not deleted
- Alias map loaded at bootstrap when Supabase is configured
