import { describe, expect, it, afterEach } from 'vitest';

import { featureFlags } from '@/core/config/feature-flags';
import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';
import {
  createEntityAliasStore,
  resetEntityAliasStoreForTests,
} from '@/features/entity-resolution/create-entity-alias-store';
import { SupabaseEntityAliasStore } from '@/features/entity-resolution/supabase-entity-alias-store';

describe('createEntityAliasStore', () => {
  let originalUseSupabase: boolean;

  afterEach(() => {
    Object.defineProperty(featureFlags, 'useSupabase', {
      value: originalUseSupabase,
      configurable: true,
    });
    resetEntityAliasStoreForTests();
  });

  it('uses InMemoryEntityAliasStore when Supabase is disabled', () => {
    originalUseSupabase = featureFlags.useSupabase;
    Object.defineProperty(featureFlags, 'useSupabase', { value: false, configurable: true });
    resetEntityAliasStoreForTests();

    const store = createEntityAliasStore();
    expect(store).toBeInstanceOf(InMemoryEntityAliasStore);
  });

  it('uses SupabaseEntityAliasStore when Supabase is enabled', () => {
    originalUseSupabase = featureFlags.useSupabase;
    Object.defineProperty(featureFlags, 'useSupabase', { value: true, configurable: true });
    resetEntityAliasStoreForTests();

    const store = createEntityAliasStore();
    expect(store).toBeInstanceOf(SupabaseEntityAliasStore);
  });
});
