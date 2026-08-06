import { describe, expect, it } from 'vitest';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { toUniversalSearchEventViewModel } from '@/features/search/utils/universal-search-event-view-model';

describe('UniversalSearchResults canonical projection', () => {
  it('uses canonical venue and city labels rather than raw display fields', () => {
    const event = {
      id: 'evt-1',
      title: 'Mallorca event',
      venue: 'AMØK Club, Palma de Mallorca',
      city: 'Palma de Mallorca',
      venueLabel: 'AMØK Club',
      cityLabel: 'Palma de Mallorca',
      locationLabelComma: 'AMØK Club, Palma de Mallorca',
      date: '01 AUG',
      startTime: '22:00',
      image: 0,
      genres: [],
    } as unknown as EventDisplayModel;

    const model = toUniversalSearchEventViewModel(event, false);

    expect(model.venueLabel).toBe('AMØK Club');
    expect(model.cityLabel).toBe('Palma de Mallorca');
    expect(model.accessibilityLabel).toBe('Mallorca event, AMØK Club, Palma de Mallorca');
  });
});
