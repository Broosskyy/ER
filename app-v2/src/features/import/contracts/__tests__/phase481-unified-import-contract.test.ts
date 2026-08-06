import { describe, expect, it } from 'vitest';

import {
  IMPORT_CHANNEL_POLICIES,
  PHASE481_FIELD_DECISION_RULES,
  UNIFIED_IMPORT_CONTRACT_VERSION,
  createFieldEvidenceCandidate,
  isExplicitEvidenceType,
} from '@/features/import/contracts';

describe('phase481 unified import contract', () => {
  it('defines contract version', () => {
    expect(UNIFIED_IMPORT_CONTRACT_VERSION).toBe('phase481-v1');
  });

  it('marks inferred evidence as non-explicit', () => {
    expect(isExplicitEvidenceType('json_ld')).toBe(true);
    expect(isExplicitEvidenceType('inferred_candidate')).toBe(false);
  });

  it('requires provenance on field evidence candidates', () => {
    const candidate = createFieldEvidenceCandidate({
      fieldName: 'price',
      rawValue: '15,00 €',
      normalizedValue: 'ab 15,00 €',
      sourceId: 'pilot-ticket-kings',
      sourceRole: 'checkout_provider',
      originUrl: 'https://example.com/checkout',
      evidenceType: 'checkout',
      extractionStrategy: 'native_event_iframe',
      observedAt: new Date().toISOString(),
      importerVersion: 'test',
      confidence: 0.9,
      reliability: 0.9,
      reviewState: 'not_reviewed',
      inclusionReason: 'test',
    });
    expect(candidate.originUrl).toContain('example.com');
    expect(candidate.explicit).toBe(true);
  });

  it('isolates manual and automatic import channels', () => {
    const manual = IMPORT_CHANNEL_POLICIES.find((p) => p.channel === 'manual_admin_import');
    const automatic = IMPORT_CHANNEL_POLICIES.find((p) => p.channel === 'automatic_source_import');
    expect(manual?.affectedBySourcePause).toBe(false);
    expect(automatic?.mayOverwriteApprovedManualCorrections).toBe(false);
  });

  it('includes ticket URL decision rule', () => {
    const ticketRule = PHASE481_FIELD_DECISION_RULES.find(
      (r) => r.field === 'ticketUrl' && r.mergeRule === 'event_specific_beats_shop_root',
    );
    expect(ticketRule?.explicitBeatsInferred).toBe(true);
    expect(ticketRule?.notes).toMatch(/Ticket Kings/i);
  });
});
