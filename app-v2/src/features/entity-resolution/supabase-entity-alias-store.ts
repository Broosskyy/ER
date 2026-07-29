import {
  SupabaseEntityAliasDatasource,
  mapAliasRowToDomain,
  mapAliasDomainToRow,
  mapDecisionDomainToRow,
  mapDecisionRowToDomain,
} from '@/data/datasources/supabase/supabase-entity-alias-datasource';
import { EntityAliasStoreError } from '@/features/entity-resolution/entity-alias-store-error';
import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';
import {
  assertCompatibleDecision,
  assertValidAlias,
  assertValidDecision,
} from '@/features/entity-resolution/entity-alias-store-utils';
import type {
  EntityIdentityAlias,
  EntityResolutionDecisionRecord,
  EntityType,
  InitializableEntityAliasStore,
} from '@/features/entity-resolution/types';

type PendingWrite =
  | { type: 'alias'; alias: EntityIdentityAlias; rowId?: string }
  | { type: 'decision'; record: EntityResolutionDecisionRecord; rowId?: string };

export class SupabaseEntityAliasStore implements InitializableEntityAliasStore {
  private readonly cache = new InMemoryEntityAliasStore();
  private readonly aliasRowIds = new Map<string, string>();
  private readonly decisionRowIds = new Map<string, string>();
  private readonly pendingWrites: PendingWrite[] = [];
  private initialized = false;
  private flushPromise: Promise<void> | null = null;
  private persistError: EntityAliasStoreError | null = null;

  constructor(private readonly datasource: SupabaseEntityAliasDatasource = new SupabaseEntityAliasDatasource()) {}

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const [aliases, decisions] = await Promise.all([
        this.datasource.listAliases(),
        this.datasource.listDecisions(),
      ]);

      for (const row of aliases) {
        const alias = mapAliasRowToDomain(row);
        this.cache.saveAlias(alias);
        this.aliasRowIds.set(this.aliasCacheKey(alias), row.id);
      }

      for (const row of decisions) {
        const record = mapDecisionRowToDomain(row);
        this.cache.saveDecision(record);
        this.decisionRowIds.set(this.decisionCacheKey(record.entityType, record.candidateKey), row.id);
      }

      this.initialized = true;
      this.persistError = null;
    } catch (error: unknown) {
      if (error instanceof EntityAliasStoreError) {
        throw error;
      }
      throw new EntityAliasStoreError('Entity alias store could not be initialized.', {
        code: 'database_unavailable',
        cause: error,
        retryable: true,
      });
    }
  }

  findCanonicalId(
    entityType: EntityType,
    aliasType: EntityIdentityAlias['aliasType'],
    aliasValue: string,
    sourceId?: string,
  ): string | undefined {
    this.assertReadyForRead();
    return this.cache.findCanonicalId(entityType, aliasType, aliasValue, sourceId);
  }

  listAliases(entityType: EntityType, canonicalId: string): EntityIdentityAlias[] {
    this.assertReadyForRead();
    return this.cache.listAliases(entityType, canonicalId);
  }

  getDecision(entityType: EntityType, candidateKey: string): EntityResolutionDecisionRecord | undefined {
    this.assertReadyForRead();
    return this.cache.getDecision(entityType, candidateKey);
  }

  saveAlias(alias: EntityIdentityAlias): void {
    this.assertReadyForWrite();
    assertValidAlias(alias);

    const existingCanonical = this.cache.findCanonicalId(
      alias.entityType,
      alias.aliasType,
      alias.aliasValue,
      alias.sourceId,
    );
    if (existingCanonical && existingCanonical !== alias.canonicalId) {
      throw new EntityAliasStoreError('Alias already maps to a different canonical entity.', {
        code: 'conflict',
      });
    }

    const key = this.aliasCacheKey(alias);
    const rowId = this.aliasRowIds.get(key);
    this.cache.saveAlias(alias);
    this.pendingWrites.push({ type: 'alias', alias, rowId });
    void this.scheduleFlush();
  }

  saveDecision(record: EntityResolutionDecisionRecord): void {
    this.assertReadyForWrite();
    assertValidDecision(record);
    assertCompatibleDecision(this.cache.getDecision(record.entityType, record.candidateKey), record);

    const rowId = this.decisionRowIds.get(this.decisionCacheKey(record.entityType, record.candidateKey));
    this.cache.saveDecision(record);
    this.pendingWrites.push({ type: 'decision', record, rowId });
    void this.scheduleFlush();
  }

  async flush(): Promise<void> {
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.flushPromise = this.runFlush().finally(() => {
      this.flushPromise = null;
    });

    return this.flushPromise;
  }

  private async runFlush(): Promise<void> {
    while (this.pendingWrites.length > 0) {
      const next = this.pendingWrites.shift();
      if (!next) {
        break;
      }

      try {
        if (next.type === 'alias') {
          const row = mapAliasDomainToRow(next.alias, next.rowId);
          const saved = await this.datasource.upsertAlias(row);
          this.aliasRowIds.set(this.aliasCacheKey(next.alias), saved.id);
          continue;
        }

        const row = mapDecisionDomainToRow(next.record, next.rowId);
        const saved = await this.datasource.upsertDecision(row);
        this.decisionRowIds.set(
          this.decisionCacheKey(next.record.entityType, next.record.candidateKey),
          saved.id,
        );
      } catch (error: unknown) {
        this.persistError =
          error instanceof EntityAliasStoreError
            ? error
            : new EntityAliasStoreError('Entity alias persistence failed.', {
                code: 'persistence_failed',
                cause: error,
              });
        throw this.persistError;
      }
    }

    this.persistError = null;
  }

  private scheduleFlush(): Promise<void> {
    return this.flush().catch((error: unknown) => {
      if (error instanceof EntityAliasStoreError) {
        this.persistError = error;
      }
      throw error;
    });
  }

  private assertReadyForRead(): void {
    if (!this.initialized) {
      throw new EntityAliasStoreError('Entity alias store is not initialized.', {
        code: 'database_unavailable',
      });
    }
    if (this.persistError) {
      throw this.persistError;
    }
  }

  private assertReadyForWrite(): void {
    this.assertReadyForRead();
  }

  private aliasCacheKey(alias: EntityIdentityAlias): string {
    return `${alias.entityType}:${alias.aliasType}:${alias.sourceId ?? '*'}:${alias.aliasValue}`;
  }

  private decisionCacheKey(entityType: EntityType, candidateKey: string): string {
    return `${entityType}:${candidateKey}`;
  }
}
