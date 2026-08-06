import { describe, expect, it } from 'vitest';

import {
  classifyControlledBatchProposal,
  type ControlledBatchProposal,
} from '@/features/import/shadow/controlled-batch-review';

describe('controlled-batch-review', () => {
  it('classifies Bootshaus og:title suffix as FORMATTING_ONLY', () => {
    const result = classifyControlledBatchProposal({
      eventId: 'evt-1',
      title: 'Ship',
      field: 'title',
      currentCanonical: 'Bootshaus on a Ship Vol. III',
      proposedValue: 'Bootshaus on a Ship Vol. III | Bootshaus Club',
      publicEvidence: 'Bootshaus on a Ship Vol. III | Bootshaus Club',
    });
    expect(result.classification).toBe('FORMATTING_ONLY');
  });

  it('classifies contaminated Sommerfest description as REAL_PRODUCTION_FIX', () => {
    const result = classifyControlledBatchProposal({
      eventId: 'evt-sommerfest',
      title: 'Bootshaus Sommerfest',
      field: 'description',
      currentCanonical: 'UNDERLAND ESSIGFABRIK – Der Start einer neuen Ära!',
      proposedValue: 'Electro/EDM vs. Deep/TechHouse vs. Techno vs. DnB/Trap/Dubstep Lineup TBA',
      publicEvidence: 'Electro/EDM vs. Deep/TechHouse vs. Techno vs. DnB/Trap/Dubstep Lineup TBA',
    });
    expect(result.classification).toBe('REAL_PRODUCTION_FIX');
    expect(result.risk).toBe('HIGH');
  });

  it('classifies same-instant dateTime as FORMATTING_ONLY', () => {
    const result = classifyControlledBatchProposal({
      eventId: 'evt-2',
      title: 'Test',
      field: 'dateTime',
      currentCanonical: '2026-08-08T15:00:00+00:00',
      proposedValue: '2026-08-08T17:00:00+02:00',
      publicEvidence: '2026-08-08T17:00:00+02:00',
    });
    expect(result.classification).toBe('FORMATTING_ONLY');
  });

  it('classifies whitespace-only description as FORMATTING_ONLY', () => {
    const proposal: ControlledBatchProposal = {
      eventId: 'evt-3',
      title: 'BC173',
      field: 'description',
      currentCanonical: 'Lineup soon.Public Transport Info:Tickets included.',
      proposedValue: 'Lineup soon. Public Transport Info: Tickets included.',
      publicEvidence: 'Lineup soon. Public Transport Info: Tickets included.',
    };
    expect(classifyControlledBatchProposal(proposal).classification).toBe('FORMATTING_ONLY');
  });
});
