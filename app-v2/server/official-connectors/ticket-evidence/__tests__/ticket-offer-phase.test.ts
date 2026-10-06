import { describe, expect, it } from 'vitest';

import { compareCurrentAdmissionPhaseRank, extractOfferPhaseMetadata } from '../ticket-offer-phase';

describe('ticket-offer-phase', () => {
  it('ranks phase 2 above phase 1 for current admission selection', () => {
    const phase1 = extractOfferPhaseMetadata('E-Ticket Phase 1', 'Phase 1');
    const phase2 = extractOfferPhaseMetadata('E-Ticket Phase 2', 'Phase 2');
    expect(phase2.rank).toBeGreaterThan(phase1.rank);
    expect(compareCurrentAdmissionPhaseRank('E-Ticket Phase 1', 'E-Ticket Phase 2', 'Phase 1', 'Phase 2')).toBeGreaterThan(0);
  });

  it('ranks final phase above numbered phases', () => {
    const phase2 = extractOfferPhaseMetadata('E-Ticket Phase 2', 'Phase 2');
    const finalPhase = extractOfferPhaseMetadata('E-Ticket Final Phase', 'Final Phase');
    expect(finalPhase.rank).toBeGreaterThan(phase2.rank);
  });

  it('ranks early bird below numbered phases', () => {
    const earlyBird = extractOfferPhaseMetadata('Early Bird', 'Early Bird');
    const phase2 = extractOfferPhaseMetadata('E-Ticket Phase 2', 'Phase 2');
    expect(phase2.rank).toBeGreaterThan(earlyBird.rank);
  });
});
