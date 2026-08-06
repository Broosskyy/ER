import { describe, expect, it } from 'vitest';

import {
  mapAdminRecordToEventRow,
  mapEventRowToAdminRecord,
} from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalEventAttribute } from '@/features/events/domain/canonical-event-attribute-types';

describe('phase473 attribute persistence mapping', () => {
  const attributes: CanonicalEventAttribute[] = [
    {
      type: 'open_air',
      label: 'Open Air',
      value: true,
      domain: 'venue_environment',
      confidence: 0.9,
      provenance: { extractionStrategy: 'test', origins: ['source-a'] },
    },
  ];

  const record: AdminEventRecord = {
    id: 'evt-test',
    title: 'Test Event',
    description: 'desc',
    startDate: '2026-08-01T20:00:00+02:00',
    status: 'published',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    eventAttributes: attributes,
    floorCount: 2,
    stageCount: 1,
    venueEnvironment: 'outdoor',
    dressCode: 'Black',
    accessibilityNotes: 'Wheelchair access',
  };

  it('round-trips attribute fields through event mapper', () => {
    const row = mapAdminRecordToEventRow(record);
    expect(row.event_attributes).toEqual(attributes);
    expect(row.floor_count).toBe(2);
    expect(row.stage_count).toBe(1);
    expect(row.venue_environment).toBe('outdoor');
    expect(row.dress_code).toBe('Black');
    expect(row.accessibility_notes).toBe('Wheelchair access');

    const restored = mapEventRowToAdminRecord(row);
    expect(restored.eventAttributes).toEqual(attributes);
    expect(restored.floorCount).toBe(2);
    expect(restored.venueEnvironment).toBe('outdoor');
  });

  it('persists null attribute columns when unset', () => {
    const minimal = mapAdminRecordToEventRow({
      ...record,
      eventAttributes: undefined,
      floorCount: undefined,
      stageCount: undefined,
      venueEnvironment: undefined,
      dressCode: undefined,
      accessibilityNotes: undefined,
    });
    expect(minimal.event_attributes).toBeNull();
    expect(minimal.floor_count).toBeNull();
    expect(minimal.venue_environment).toBeNull();
  });
});
