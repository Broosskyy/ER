import {
  aliasKey,
  assertCompatibleAlias,
  assertCompatibleDecision,
  assertValidAlias,
  assertValidDecision,
  decisionKey,
  mergeAliasMetadata,
} from '@/features/entity-resolution/entity-alias-store-utils';
import type {
  EntityAliasStore,
  EntityIdentityAlias,
  EntityResolutionDecisionRecord,
  EntityType,
} from '@/features/entity-resolution/types';

export class InMemoryEntityAliasStore implements EntityAliasStore {
  private readonly aliases = new Map<string, EntityIdentityAlias>();
  private readonly decisions = new Map<string, EntityResolutionDecisionRecord>();

  findCanonicalId(
    entityType: EntityType,
    aliasType: EntityIdentityAlias['aliasType'],
    aliasValue: string,
    sourceId?: string,
  ): string | undefined {
    const specific = this.aliases.get(aliasKey(entityType, aliasType, aliasValue, sourceId));
    if (specific) {
      return specific.canonicalId;
    }
    return this.aliases.get(aliasKey(entityType, aliasType, aliasValue))?.canonicalId;
  }

  listAliases(entityType: EntityType, canonicalId: string): EntityIdentityAlias[] {
    return [...this.aliases.values()].filter(
      (alias) => alias.entityType === entityType && alias.canonicalId === canonicalId,
    );
  }

  saveAlias(alias: EntityIdentityAlias): void {
    assertValidAlias(alias);
    const key = aliasKey(alias.entityType, alias.aliasType, alias.aliasValue, alias.sourceId);
    const existing = this.aliases.get(key);
    assertCompatibleAlias(existing, alias);
    this.aliases.set(key, existing ? mergeAliasMetadata(existing, alias) : alias);
  }

  getDecision(entityType: EntityType, candidateKey: string): EntityResolutionDecisionRecord | undefined {
    return this.decisions.get(decisionKey(entityType, candidateKey));
  }

  saveDecision(record: EntityResolutionDecisionRecord): void {
    assertValidDecision(record);
    const key = decisionKey(record.entityType, record.candidateKey);
    const existing = this.decisions.get(key);
    assertCompatibleDecision(existing, record);
    this.decisions.set(key, existing ? { ...existing, ...record } : record);
  }
}

export function normalizeIdentityText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function extractDomain(url: string): string | undefined {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
}

export function buildEntityCandidateKey(parts: Record<string, string | undefined>): string {
  return Object.entries(parts)
    .filter(([, value]) => Boolean(value?.trim()))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${normalizeIdentityText(value!)}`)
    .join('|');
}
