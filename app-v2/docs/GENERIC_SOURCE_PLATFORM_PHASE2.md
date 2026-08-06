# Eternal Rave — Generic Source Platform Phase 2

**Status:** Implemented  
**Date:** 2026-07-31

See [GENERIC_SOURCE_PLATFORM_MASTERPLAN.md](./GENERIC_SOURCE_PLATFORM_MASTERPLAN.md) for Phase 1 audit.

## Delivered

- Source type descriptors (`source-type-descriptors.ts`)
- Publish behavior (`publish-behavior.ts`) — `auto_publish`, `manual_review`, `enrichment`, `disabled`
- Field trust merge service (`field-trust-merge-service.ts`) behind feature flag
- Expanded field provenance writer + migration `20260768000000_sprint342_generic_source_foundations.sql`
- Production sources configured with explicit `publishPolicy.behavior`

## Feature flag

`EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE=false` (default) — Bootshaus behaviour unchanged.

## Tests

`src/features/sources/domain/__tests__/sprint342-generic-source-foundations.test.ts`
