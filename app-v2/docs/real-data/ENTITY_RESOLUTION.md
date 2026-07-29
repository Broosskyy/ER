# Entity Resolution

## Resolver

- `OrganizerIdentityResolver` — external ID, URL, domain, name, social
- `VenueIdentityResolver` — external ID, name, address, city, coordinates
- `ArtistIdentityResolver` — external ID, name, aliases, profile URLs

## Entscheidungen

`matched` | `review_required` | `keep_separate` | `manual_override` | `unmatched`

Manuelle Entscheidungen sind auditierbar (`entity_resolution_decisions`) und werden nicht automatisch überschrieben.

## Code

- `src/features/entity-resolution/`
- `SupabaseEntityAliasStore` + `InMemoryEntityAliasStore`
- `docs/real-data/SUPABASE_ENTITY_ALIAS_STORE.md`
