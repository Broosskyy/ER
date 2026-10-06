import AsyncStorage from '@react-native-async-storage/async-storage';

import { featureFlags } from '@/core/config/feature-flags';
import {
  AsyncStorageFollowStorage,
  FollowService,
  type FollowEntityType,
  type FollowStorage,
  InMemoryFollowStorage,
} from '@/features/follows/follow-service';

function createFollowStorage(): FollowStorage {
  if (process.env.VITEST === 'true') {
    return new InMemoryFollowStorage();
  }
  return new AsyncStorageFollowStorage(AsyncStorage);
}

async function resolveFollowCanonicalEntityId(
  _entityType: FollowEntityType,
  entityId: string,
): Promise<string> {
  return entityId;
}

export const followService = new FollowService({
  storage: createFollowStorage(),
  resolveCanonicalId: resolveFollowCanonicalEntityId,
});
