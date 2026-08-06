import { featureFlags } from '@/core/config/feature-flags';
import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';
import { SupabaseEntityAliasStore } from '@/features/entity-resolution/supabase-entity-alias-store';
import type { EntityAliasStore } from '@/features/entity-resolution/types';

let sharedEntityAliasStore: EntityAliasStore | null = null;

/** Shared singleton used by registry matching and consumer profile resolution. */
export function createEntityAliasStore(): EntityAliasStore {
  if (!sharedEntityAliasStore) {
    sharedEntityAliasStore = featureFlags.useSupabase
      ? new SupabaseEntityAliasStore()
      : new InMemoryEntityAliasStore();
  }
  return sharedEntityAliasStore;
}

/** Test-only reset so suites can isolate alias-store state. */
export function resetEntityAliasStoreForTests(): void {
  sharedEntityAliasStore = null;
}
