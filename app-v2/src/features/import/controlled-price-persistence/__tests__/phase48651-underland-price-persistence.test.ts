import { describe, expect, it } from 'vitest';

import {
  buildApprovedUnderlandAdmissionPhase,
  PHASE48651_PHASE_NAME,
  PHASE48651_PRICE_TEXT,
  planUnderlandPriceMutations,
} from '@/features/import/controlled-price-persistence/underland-price-persistence';

describe('phase48651 underland price persistence', () => {
  it('plans price and phase mutations when empty', () => {
    const mutations = planUnderlandPriceMutations({ priceText: '', ticketPhases: [] });
    expect(mutations).toHaveLength(2);
    expect(mutations.some((m) => m.field === 'priceText' && m.newValue === PHASE48651_PRICE_TEXT)).toBe(
      true,
    );
  });

  it('is idempotent when already persisted', () => {
    const phase = buildApprovedUnderlandAdmissionPhase();
    const mutations = planUnderlandPriceMutations({
      priceText: PHASE48651_PRICE_TEXT,
      ticketPhases: [phase],
    });
    expect(mutations).toHaveLength(0);
  });

  it('builds approved early bird phase without add-ons', () => {
    const phase = buildApprovedUnderlandAdmissionPhase();
    expect(phase.name).toBe(PHASE48651_PHASE_NAME);
    expect(phase.priceAmount).toBe(15);
    expect(phase.note).toBeUndefined();
  });
});
