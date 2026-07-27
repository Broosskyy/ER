import { describe, expect, it } from 'vitest';

import {
  EVENT_COLLECTIONS,
  getCollectionConfig,
  isCollectionType,
} from '@/features/collections/event-collection-config';

describe('event collections', () => {
  it('recognizes valid collection types', () => {
    expect(isCollectionType('highlights')).toBe(true);
    expect(isCollectionType('tonight')).toBe(true);
    expect(isCollectionType('invalid')).toBe(false);
  });

  it('defines expected collection metadata', () => {
    expect(getCollectionConfig('highlights').title).toBe('Events in deiner Nähe');
    expect(getCollectionConfig('tonight').emptyTitle).toBe('Keine Events heute Abend');
    expect(getCollectionConfig('weekend').title).toBe('Dieses Wochenende');
  });

  it('includes genre collections', () => {
    expect(EVENT_COLLECTIONS.techno.title).toBe('Techno');
    expect(EVENT_COLLECTIONS.house.title).toBe('House');
  });
});
