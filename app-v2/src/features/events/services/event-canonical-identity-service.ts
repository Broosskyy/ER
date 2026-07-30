import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { buildEventIdentityFingerprint } from '@/features/aggregation/identity/event-identity';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { EntityAliasStore } from '@/features/entity-resolution/types';

export interface EventCanonicalIdentityLookup {
  findByFingerprint(fingerprint: string): Promise<string | undefined>;
  registerFingerprint(canonicalEventId: string, fingerprint: string, sourceId?: string): Promise<void>;
}

export function createEventFingerprintLookup(store: EntityAliasStore): EventCanonicalIdentityLookup {
  return {
    async findByFingerprint(fingerprint) {
      return store.findCanonicalId('event', 'normalized_name', fingerprint);
    },
    async registerFingerprint(canonicalEventId, fingerprint) {
      store.saveAlias({
        entityType: 'event',
        canonicalId: canonicalEventId,
        aliasType: 'normalized_name',
        aliasValue: fingerprint,
        createdAt: new Date().toISOString(),
      });
    },
  };
}

export class EventCanonicalIdentityService {
  constructor(
    private readonly lookup: EventCanonicalIdentityLookup,
    private readonly sourceReferences: EventSourceReferenceRepository,
  ) {}

  async resolveByFingerprint(candidate: CanonicalImportEvent): Promise<string | undefined> {
    const { canonicalFingerprint } = buildEventIdentityFingerprint(candidate);
    return this.lookup.findByFingerprint(canonicalFingerprint);
  }

  async resolveBySourceReference(
    sourceId: string,
    externalEventId: string,
  ): Promise<string | undefined> {
    const reference = await this.sourceReferences.findByExternalEventId(sourceId, externalEventId);
    return reference?.canonicalEventId;
  }

  async registerIdentity(
    canonicalEventId: string,
    candidate: CanonicalImportEvent,
    sourceId?: string,
  ): Promise<void> {
    const { canonicalFingerprint } = buildEventIdentityFingerprint(candidate);
    const existingCanonicalId = await this.lookup.findByFingerprint(canonicalFingerprint);
    if (existingCanonicalId === canonicalEventId) {
      return;
    }
    await this.lookup.registerFingerprint(canonicalEventId, canonicalFingerprint, sourceId);
  }
}
