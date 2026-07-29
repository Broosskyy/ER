import { featureFlags } from '@/core/config/feature-flags';
import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';
import { SupabaseEntityAliasStore } from '@/features/entity-resolution/supabase-entity-alias-store';
import type { EntityAliasStore } from '@/features/entity-resolution/types';

export function createEntityAliasStore(): EntityAliasStore {
  if (featureFlags.useSupabase) {
    return new SupabaseEntityAliasStore();
  }
  return new InMemoryEntityAliasStore();
}
