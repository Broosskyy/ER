import AsyncStorage from '@react-native-async-storage/async-storage';

import { featureFlags } from '@/core/config/feature-flags';
import {
  artistRepository,
  organizerRepository,
  venueRepository,
} from '@/data/repositories/registry';
import { InMemoryRealDataDomainEventBus } from '@/features/events/domain/real-data-domain-events';
import {
  AsyncStorageFollowStorage,
  FollowService,
  type FollowEntityType,
  type FollowStorage,
  InMemoryFollowStorage,
} from '@/features/follows/follow-service';
import { SupabaseFollowStorage } from '@/features/follows/supabase-follow-storage';
import { resolveCanonicalEntityId } from '@/features/profiles/services/canonical-entity-id-resolver';

const domainEventBus = new InMemoryRealDataDomainEventBus();

async function resolveFollowCanonicalEntityId(
  entityType: FollowEntityType,
  entityId: string,
): Promise<string> {
  if (entityType === 'organizer') {
    return resolveCanonicalEntityId('organizer', entityId, async (id) =>
      Boolean(await organizerRepository.getById(id)),
    );
  }
  if (entityType === 'venue') {
    return resolveCanonicalEntityId('venue', entityId, async (id) =>
      Boolean(await venueRepository.getById(id)),
    );
  }
  return resolveCanonicalEntityId('artist', entityId, async (id) =>
    Boolean(await artistRepository.getPublishedById(id)),
  );
}

function createFollowStorage(): FollowStorage {
  if (process.env.VITEST === 'true') {
    return new InMemoryFollowStorage();
  }
  if (featureFlags.useSupabase) {
    return new SupabaseFollowStorage();
  }
  return new AsyncStorageFollowStorage(AsyncStorage);
}

export const followService = new FollowService({
  storage: createFollowStorage(),
  domainEventBus,
  resolveCanonicalId: resolveFollowCanonicalEntityId,
});
