import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';

/** Frontend profile runtime alias store (in-memory until persistence wiring lands). */
export const entityAliasStore = new InMemoryEntityAliasStore();
