import { describe, expect, it } from 'vitest';

import { extractAttributesFromDescriptionText } from '@/features/aggregation/domain/textual-attribute-parser';

describe('phase4721 attribute parser evidence', () => {
  it('extracts Open Air from explicit evidence', () => {
    const result = extractAttributesFromDescriptionText('Open Air Festival am See', 'affenkaefig');
    expect(result.attributes.some((a) => a.key === 'open_air')).toBe(true);
    expect(result.venueEnvironment).toBe('outdoor');
  });

  it('extracts Indoor & Outdoor as hybrid', () => {
    const result = extractAttributesFromDescriptionText(
      'Indoor & Outdoor Bereich mit 2 Floors',
      'mdma',
    );
    expect(result.attributes.some((a) => a.key === 'indoor')).toBe(true);
    expect(result.venueEnvironment).toBe('hybrid');
    expect(result.floorCount).toBe(2);
  });

  it('extracts minimum age and doors time', () => {
    const result = extractAttributesFromDescriptionText(
      'Mindestalter: 18+. Einlass: 22:00 Uhr.',
      'bootshaus',
    );
    expect(result.minimumAge).toBe('18+');
    expect(result.doorsOpenAt).toBe('22:00');
  });

  it('does not infer editorial badges from ticket metadata', () => {
    const result = extractAttributesFromDescriptionText('Tickets now on sale', 'ticket_io');
    expect(result.attributes.some((a) => a.key === 'verified')).toBe(false);
    expect(result.attributes.some((a) => a.key === 'featured')).toBe(false);
  });

  it('requires explicit floor count evidence', () => {
    const without = extractAttributesFromDescriptionText('Techno all night long', 'mdma');
    expect(without.floorCount).toBeUndefined();

    const withFloors = extractAttributesFromDescriptionText('Party auf 3 Floors', 'affenkaefig');
    expect(withFloors.floorCount).toBe(3);
  });
});
