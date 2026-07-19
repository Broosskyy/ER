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

export function getCollectionEvents(type: CollectionType) {
  const config = getCollectionConfig(type);
  return config.selectEvents(eventRepository.getPublishedEvents());
}

export function getCollectionPreviewEvents(type: CollectionType) {
  const config = getCollectionConfig(type);
  return config.selectEvents(eventRepository.getPublishedEvents()).slice(0, config.homePreviewLimit);
}
