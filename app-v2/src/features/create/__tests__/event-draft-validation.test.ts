import { describe, expect, it } from 'vitest';

import {
  EMPTY_EVENT_DRAFT_FORM,
  type EventDraftFormValues,
} from '@/features/create/types/event-draft-form';
import {
  hasEventDraftErrors,
  validateEventDraftForm,
} from '@/features/create/validation/event-draft-validation';
import {
  combineDateAndTime,
  isValidDateInput,
  isValidTimeInput,
} from '@/features/create/utils/event-draft-date-time';
import { appendContributorLinks } from '@/features/create/utils/event-draft-description';

function validForm(overrides: Partial<EventDraftFormValues> = {}): EventDraftFormValues {
  return {
    ...EMPTY_EVENT_DRAFT_FORM,
    title: 'Warehouse Rave',
    startDate: '2026-08-01',
    startTime: '22:00',
    venueText: 'Gewölbe',
    genreId: 'techno',
    description: 'All night long.',
    ...overrides,
  };
}

describe('event draft date-time utils', () => {
  it('validates date and time inputs', () => {
    expect(isValidDateInput('2026-08-01')).toBe(true);
    expect(isValidDateInput('2026-13-01')).toBe(false);
    expect(isValidTimeInput('22:00')).toBe(true);
    expect(isValidTimeInput('25:00')).toBe(false);
  });

  it('combines date and time into a Date', () => {
    const combined = combineDateAndTime('2026-08-01', '22:00');
    expect(combined).not.toBeNull();
    expect(combined?.getFullYear()).toBe(2026);
  });
});

describe('event draft validation', () => {
  it('requires core fields', () => {
    const errors = validateEventDraftForm(EMPTY_EVENT_DRAFT_FORM);
    expect(errors.title).toBe('create.event.errors.titleRequired');
    expect(errors.startDate).toBe('create.event.errors.startDateRequired');
    expect(errors.startTime).toBe('create.event.errors.startTimeRequired');
    expect(errors.venueText).toBe('create.event.errors.venueRequired');
    expect(errors.genreId).toBe('create.event.errors.genreRequired');
    expect(errors.description).toBe('create.event.errors.descriptionRequired');
    expect(hasEventDraftErrors(errors)).toBe(true);
  });

  it('accepts a valid form', () => {
    const errors = validateEventDraftForm(validForm());
    expect(hasEventDraftErrors(errors)).toBe(false);
  });

  it('accepts venueId instead of free text', () => {
    const errors = validateEventDraftForm(
      validForm({ venueId: 'venue-1', venueText: '' }),
    );
    expect(errors.venueText).toBeUndefined();
    expect(hasEventDraftErrors(errors)).toBe(false);
  });

  it('rejects invalid optional urls', () => {
    const errors = validateEventDraftForm(
      validForm({ ticketUrl: 'not-a-url', websiteUrl: 'javascript:alert(1)' }),
    );
    expect(errors.ticketUrl).toBe('create.event.errors.invalidUrl');
    expect(errors.websiteUrl).toBe('create.event.errors.invalidUrl');
  });

  it('rejects end before start', () => {
    const errors = validateEventDraftForm(
      validForm({ endDate: '2026-07-31', endTime: '21:00' }),
    );
    expect(errors.endDate).toBe('create.event.errors.endBeforeStart');
  });
});

describe('event draft description builder', () => {
  it('appends contributor links to description', () => {
    const result = appendContributorLinks(
      'Main text',
      { websiteUrl: 'https://example.com', instagramUrl: 'https://instagram.com/er' },
      { website: 'Website', instagram: 'Instagram', facebook: 'Facebook' },
    );
    expect(result).toContain('Main text');
    expect(result).toContain('Website: https://example.com');
    expect(result).toContain('Instagram: https://instagram.com/er');
  });
});
