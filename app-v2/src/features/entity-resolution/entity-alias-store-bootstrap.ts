import { flushEntityAliasStoreInstance } from '@/features/entity-resolution/entity-resolution-writeback-service';
import { isInitializableEntityAliasStore } from '@/features/entity-resolution/types';
import { env } from '@/core/config/env';
import {
  isJwtIssuedAtFutureError,
  measureClockSkewAgainstHttpDate,
} from '@/services/supabase/jwt-clock-skew';
import { resolveSupabaseUrl } from '@/services/supabase/client';

export async function initializeEntityAliasStore(): Promise<void> {
  const { entityAliasStore } = await import('@/data/repositories/registry');
  if (!isInitializableEntityAliasStore(entityAliasStore)) {
    return;
  }

  try {
    await entityAliasStore.initialize();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isJwtIssuedAtFutureError(message)) {
      const skew = await measureClockSkewAgainstHttpDate(
        fetch,
        resolveSupabaseUrl(),
        env.supabaseAnonKey,
      );
      throw new Error(
        `${message}. Sync the system clock (measured skewMs=${skew.skewMs ?? 'unknown'}, direction=${skew.skewDirection ?? 'unknown'}).`,
        { cause: error },
      );
    }
    throw error;
  }
}

export async function flushEntityAliasStore(): Promise<void> {
  const { entityAliasStore } = await import('@/data/repositories/registry');
  await flushEntityAliasStoreInstance(entityAliasStore);
}
