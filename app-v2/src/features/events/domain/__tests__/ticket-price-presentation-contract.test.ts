import { describe, expect, it } from 'vitest';

import {
  auditConsumerPricePresentation,
  detectDuplicatePriceSurfaces,
  proposeConsumerPricePresentation,
} from '@/features/events/domain/ticket-price-presentation-contract';

describe('ticket price presentation contract', () => {
  it('detects header + section + phase + subtotal duplicates', () => {
    const duplicates = detectDuplicatePriceSurfaces({
      headerPrice: 'ab 15,00 €',
      sectionStandalonePrice: 'ab 15,00 €',
      phasePrices: ['ab 15,00 €'],
      subtotal: 'ab 15,00 €',
      total: 'ab 15,00 €',
      ctaLabel: 'Tickets ansehen',
    });
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0]?.surfaces).toContain('header');
    expect(duplicates[0]?.surfaces).toContain('subtotal');
  });

  it('proposes single phase card without redundant summary lines', () => {
    const proposed = proposeConsumerPricePresentation({
      headerPrice: 'ab 20,00 €',
      sectionStandalonePrice: 'ab 20,00 €',
      phasePrices: ['ab 20,00 €'],
      subtotal: 'ab 20,00 €',
      total: 'ab 20,00 €',
    });
    expect(proposed.sectionStandalonePrice).toBeUndefined();
    expect(proposed.subtotal).toBeUndefined();
    expect(proposed.total).toBeUndefined();
    expect(proposed.headerPrice).toBe('ab 20,00 €');
    expect(proposed.phasePrices).toEqual(['ab 20,00 €']);
  });

  it('keeps honest no-price state', () => {
    const audit = auditConsumerPricePresentation({
      eventId: 'evt-test',
      title: 'Underland',
      slots: {
        phasePrices: [],
        ctaLabel: 'Tickets ansehen',
        availabilityLabel: 'Verfügbar',
      },
    });
    expect(audit.duplicateGroups).toHaveLength(0);
    expect(audit.proposedSlots.headerPrice).toBeUndefined();
  });
});
