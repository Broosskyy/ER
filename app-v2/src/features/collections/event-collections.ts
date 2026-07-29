import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-service';
import { eventRepository } from '@/features/events/repository/event-repository';

import {
  getCollectionConfig,
  type CollectionType,
} from './event-collection-config';

export type { CollectionType, EventCollectionConfig } from './event-collection-config';
export {
  EVENT_COLLECTIONS,
  HOME_COLLECTION_TYPES,
  getCollectionConfig,
  isCollectionType,
} from './event-collection-config';

function getPublishedDiscoveryPool() {
  const discoverable = getDiscoverablePublishedEvents();
  if (discoverable.length > 0) {
    return discoverable;
  }
  return eventRepository.getPublishedEvents();
}

export function getCollectionEvents(type: CollectionType) {
  const config = getCollectionConfig(type);
  return config.selectEvents(getPublishedDiscoveryPool());
}

export function getCollectionPreviewEvents(type: CollectionType) {
  const config = getCollectionConfig(type);
  return config.selectEvents(getPublishedDiscoveryPool()).slice(0, config.homePreviewLimit);
}
