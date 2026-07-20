import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import {
  mapAdminRecordToEventDraftForm,
  mapEventDraftFormToAdminRecord,
} from '@/features/create/mappers/event-draft-mapper';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';

const linkLabels = {
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

const baseForm: EventDraftFormValues = {
  title: 'Warehouse Session',
  startDate: '2026-09-12',
  startTime: '23:00',
  endDate: '2026-09-13',
  endTime: '06:00',
  venueId: '',
  venueText: 'Gewölbe',
  genreId: 'techno',
  description: 'All night.',
  ticketUrl: 'https://tickets.example.com',
  websiteUrl: 'https://example.com',
  instagramUrl: 'https://instagram.com/er',
  facebookUrl: '',
  coverImage: null,
  flyerImage: null,
};

describe('event draft mapper', () => {
  it('maps form values to a draft admin record', () => {
    const record = mapEventDraftFormToAdminRecord(baseForm, {
      userId: 'user-1',
      linkLabels,
    });

    expect(record.status).toBe('draft');
    expect(record.createdBy).toBe('user-1');
    expect(record.title).toBe('Warehouse Session');
    expect(record.venueName).toBe('Gewölbe');
    expect(record.subtitle).toBeUndefined();
    expect(record.description).toBe('All night.');
    expect(record.websiteUrl).toBe('https://example.com');
    expect(record.instagramUrl).toBe('https://instagram.com/er');
    expect(record.ticketUrl).toBe('https://tickets.example.com');
    expect(record.imageUrl).toBeUndefined();
    expect(record.flyerUrl).toBeUndefined();
  });

  it('never persists local preview URIs from the form', () => {
    const record = mapEventDraftFormToAdminRecord(
      {
        ...baseForm,
        coverImage: { remoteUrl: '', localUri: 'file:///tmp/cover.jpg' },
        flyerImage: { remoteUrl: '', localUri: 'content://media/1' },
      },
      { userId: 'user-1', linkLabels },
    );

    expect(record.imageUrl).toBeUndefined();
    expect(record.flyerUrl).toBeUndefined();
  });

  it('round-trips a saved draft back into form values for future edit flows', () => {
    const saved = mapEventDraftFormToAdminRecord(baseForm, {
      userId: 'user-1',
      linkLabels,
    });

    const existing: AdminEventRecord = {
      ...saved,
      id: 'draft-123',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const reloaded = mapAdminRecordToEventDraftForm(existing, linkLabels);

    expect(reloaded.title).toBe(baseForm.title);
    expect(reloaded.venueText).toBe(baseForm.venueText);
    expect(reloaded.genreId).toBe(baseForm.genreId);
    expect(reloaded.description).toBe(baseForm.description);
    expect(reloaded.websiteUrl).toBe(baseForm.websiteUrl);
    expect(reloaded.instagramUrl).toBe(baseForm.instagramUrl);
    expect(reloaded.startDate).toBe(baseForm.startDate);
    expect(reloaded.startTime).toBe(baseForm.startTime);
  });

  it('preserves identity fields when updating an existing draft', () => {
    const existing: AdminEventRecord = {
      id: 'draft-123',
      title: 'Old title',
      description: '',
      genreId: 'techno',
      cityId: 'koeln',
      startDate: '2026-09-12T21:00:00.000Z',
      status: 'draft',
      createdBy: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const updated = mapEventDraftFormToAdminRecord(
      { ...baseForm, title: 'Updated title' },
      { userId: 'user-1', linkLabels, existing },
    );

    expect(updated.id).toBe('draft-123');
    expect(updated.createdBy).toBe('user-1');
    expect(updated.createdAt).toBe(existing.createdAt);
    expect(updated.status).toBe('draft');
    expect(updated.title).toBe('Updated title');
  });
});
