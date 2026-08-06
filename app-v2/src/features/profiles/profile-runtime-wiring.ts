import { createEntityAliasStore } from '@/features/entity-resolution/create-entity-alias-store';

/**
 * Consumer profile runtime uses the same singleton alias store as registry matching.
 */
export const entityAliasStore = createEntityAliasStore();
