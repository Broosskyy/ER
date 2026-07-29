import { EntityAliasStoreError } from '@/features/entity-resolution/entity-alias-store-error';
import type {
  EntityIdentityAlias,
  EntityResolutionDecisionRecord,
  EntityType,
} from '@/features/entity-resolution/types';

export function aliasKey(
  entityType: EntityType,
  aliasType: EntityIdentityAlias['aliasType'],
  aliasValue: string,
  sourceId?: string,
): string {
  return `${entityType}:${aliasType}:${sourceId ?? '*'}:${aliasValue}`;
}

export function decisionKey(entityType: EntityType, candidateKey: string): string {
  return `${entityType}:${candidateKey}`;
}

export function assertValidAlias(alias: EntityIdentityAlias): void {
  if (!alias.entityType || !alias.canonicalId?.trim() || !alias.aliasType || !alias.aliasValue?.trim()) {
    throw new EntityAliasStoreError('Alias record is missing required fields.', {
      code: 'invalid_input',
    });
  }
}

export function assertValidDecision(record: EntityResolutionDecisionRecord): void {
  if (!record.entityType || !record.candidateKey?.trim() || !record.decision || !record.decidedBy?.trim()) {
    throw new EntityAliasStoreError('Decision record is missing required fields.', {
      code: 'invalid_input',
    });
  }
}

export function assertCompatibleDecision(
  existing: EntityResolutionDecisionRecord | undefined,
  incoming: EntityResolutionDecisionRecord,
): void {
  if (!existing) {
    return;
  }

  if (existing.decision === 'keep_separate' && incoming.decision !== 'keep_separate') {
    throw new EntityAliasStoreError('Keep-separate decision cannot be overridden.', {
      code: 'conflict',
    });
  }

  if (
    existing.decision === 'manual_override' &&
    incoming.decision === 'manual_override' &&
    existing.canonicalId &&
    incoming.canonicalId &&
    existing.canonicalId !== incoming.canonicalId
  ) {
    throw new EntityAliasStoreError('Manual match decision conflicts with existing canonical id.', {
      code: 'conflict',
    });
  }
}

export function assertCompatibleAlias(
  existing: EntityIdentityAlias | undefined,
  incoming: EntityIdentityAlias,
): void {
  if (existing && existing.canonicalId !== incoming.canonicalId) {
    throw new EntityAliasStoreError('Alias already maps to a different canonical entity.', {
      code: 'conflict',
    });
  }
}

export function mergeAliasMetadata(
  existing: EntityIdentityAlias,
  incoming: EntityIdentityAlias,
): EntityIdentityAlias {
  return {
    ...existing,
    ...incoming,
    createdAt: existing.createdAt,
    metadata: {
      ...(existing.metadata ?? {}),
      ...(incoming.metadata ?? {}),
    },
  };
}
