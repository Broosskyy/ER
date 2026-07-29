export {
  buildEntityCandidateKey,
  extractDomain,
  InMemoryEntityAliasStore,
  normalizeIdentityText,
} from './entity-alias-store';
export { createEntityAliasStore } from './create-entity-alias-store';
export { initializeEntityAliasStore, flushEntityAliasStore } from './entity-alias-store-bootstrap';
export { EntityResolutionWritebackService, flushEntityAliasStoreInstance } from './entity-resolution-writeback-service';
export {
  buildEntityResolutionWritebackPlan,
  touchesEntityResolutionEdits,
} from './entity-resolution-writeback';
export { EntityAliasStoreError } from './entity-alias-store-error';
export { SupabaseEntityAliasStore } from './supabase-entity-alias-store';
export { ArtistIdentityResolver } from './artist-identity-resolver';
export { OrganizerIdentityResolver } from './organizer-identity-resolver';
export { VenueIdentityResolver } from './venue-identity-resolver';
export { isInitializableEntityAliasStore } from './types';
export type {
  EntityAliasStore,
  InitializableEntityAliasStore,
  EntityIdentityAlias,
  EntityResolutionDecision,
  EntityResolutionDecisionRecord,
  EntityResolutionOutcome,
  EntityType,
} from './types';