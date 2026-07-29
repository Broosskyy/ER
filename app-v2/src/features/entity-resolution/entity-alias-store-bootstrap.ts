import { flushEntityAliasStoreInstance } from '@/features/entity-resolution/entity-resolution-writeback-service';
import { isInitializableEntityAliasStore } from '@/features/entity-resolution/types';

export async function initializeEntityAliasStore(): Promise<void> {
  const { entityAliasStore } = await import('@/data/repositories/registry');
  if (isInitializableEntityAliasStore(entityAliasStore)) {
    await entityAliasStore.initialize();
  }
}

export async function flushEntityAliasStore(): Promise<void> {
  const { entityAliasStore } = await import('@/data/repositories/registry');
  await flushEntityAliasStoreInstance(entityAliasStore);
}
