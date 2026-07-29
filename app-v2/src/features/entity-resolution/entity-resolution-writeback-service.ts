import { EntityAliasStoreError } from '@/features/entity-resolution/entity-alias-store-error';
import {
  applyEntityResolutionWritebackPlan,
  buildEntityResolutionWritebackPlan,
  mapEntityAliasStoreError,
  type EntityResolutionWritebackAuditEntry,
  type EntityResolutionWritebackContext,
  type EntityResolutionWritebackPlan,
} from '@/features/entity-resolution/entity-resolution-writeback';
import { isInitializableEntityAliasStore, type EntityAliasStore } from '@/features/entity-resolution/types';

export interface EntityResolutionWritebackResult {
  plan: EntityResolutionWritebackPlan;
  auditEntries: EntityResolutionWritebackAuditEntry[];
}

export class EntityResolutionWritebackService {
  constructor(
    private readonly aliasStore: EntityAliasStore,
    private readonly flushAliasStore: (store: EntityAliasStore) => Promise<void> = flushEntityAliasStoreInstance,
  ) {}

  async persist(context: EntityResolutionWritebackContext): Promise<EntityResolutionWritebackResult> {
    const plan = buildEntityResolutionWritebackPlan(context);
    if (plan.decisions.length === 0 && plan.aliases.length === 0) {
      return { plan, auditEntries: [] };
    }

    try {
      applyEntityResolutionWritebackPlan(this.aliasStore, plan);
      await this.flushAliasStore(this.aliasStore);
    } catch (error: unknown) {
      throw mapEntityAliasStoreError(error);
    }

    return { plan, auditEntries: plan.auditEntries };
  }
}

export async function flushEntityAliasStoreInstance(store: EntityAliasStore): Promise<void> {
  if (isInitializableEntityAliasStore(store)) {
    await store.flush();
  }
}

export function isEntityAliasStorePersistenceError(error: unknown): error is EntityAliasStoreError {
  return error instanceof EntityAliasStoreError;
}
