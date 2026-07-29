import type { EntityType } from '@/features/entity-resolution/types';
import { entityAliasStore } from '@/features/profiles/profile-runtime-wiring';

export type CanonicalEntityType = EntityType;

async function entityExists(
  entityType: CanonicalEntityType,
  entityId: string,
  existsById: (id: string) => Promise<boolean>,
): Promise<boolean> {
  return existsById(entityId);
}

export async function resolveCanonicalEntityId(
  entityType: CanonicalEntityType,
  entityId: string,
  existsById: (id: string) => Promise<boolean>,
): Promise<string> {
  const trimmed = entityId.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (await entityExists(entityType, trimmed, existsById)) {
    return trimmed;
  }

  const aliasTypes = ['external_id', 'manual', 'normalized_name'] as const;
  for (const aliasType of aliasTypes) {
    const canonicalId = entityAliasStore.findCanonicalId(entityType, aliasType, trimmed);
    if (canonicalId && (await entityExists(entityType, canonicalId, existsById))) {
      return canonicalId;
    }
    if (canonicalId) {
      return canonicalId;
    }
  }

  return trimmed;
}

export function applyEntityAliasMap(
  entityType: CanonicalEntityType,
  aliases: Map<string, string>,
): void {
  for (const [aliasValue, canonicalId] of aliases.entries()) {
    entityAliasStore.saveAlias({
      entityType,
      canonicalId,
      aliasType: 'external_id',
      aliasValue,
      createdAt: new Date().toISOString(),
    });
  }
}
