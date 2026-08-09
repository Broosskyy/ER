import { describe, expect, it } from 'vitest';

import { buildRowFingerprint } from '@/features/import/generic-truth-pipeline/restricted-canary-preview';
import { buildStableProvenanceRepairManifestHash } from '@/features/import/services/provenance-repair-manifest';

const EVIDENCE_VERIFIED_AT = '2026-08-09T19:21:16.347Z';

const rollbackPrice = {
  id: 'provenance-evt-1785339418526-dn9f7g0-priceText',
  selectedValue: 'Tickets ab 32,00 Euro',
  selectedSourceId: 'source-bootshaus-ticket-io',
  manuallyOverridden: false,
  alternatives: [
    {
      value: 'Tickets ab 32,00 Euro',
      sourceId: 'source-bootshaus-koeln',
      confidence: 0.75,
      freshnessAt: '2026-08-02T21:20:06.937Z',
      originExternalId: 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iv',
    },
    {
      value: 'Tickets ab 32,00 Euro',
      sourceId: 'source-bootshaus-ticket-io',
      freshnessAt: '2026-08-02T21:24:48.048Z',
      originExternalId: 'https://bootshaus-club.ticket.io/4zjKRnsa/',
    },
  ],
  updatedAt: '2026-08-02T21:24:48.048+00:00',
  selectionReason: 'import_publish',
  confidence: null,
  freshnessAt: '2026-08-02T21:24:48.048+00:00',
  originExternalId: 'https://bootshaus-club.ticket.io/4zjKRnsa/',
  mergeDecision: null,
  selectedTier: 'ticket_platform',
};

const rollbackStatus = {
  id: 'provenance-evt-1785339418526-dn9f7g0-ticketStatus',
  selectedValue: 'external_link',
  selectedSourceId: 'source-bootshaus-ticket-io',
  manuallyOverridden: false,
  alternatives: [
    {
      value: 'external_link',
      sourceId: 'source-bootshaus-koeln',
      confidence: 0.75,
      freshnessAt: '2026-08-02T21:20:06.937Z',
      originExternalId: 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iv',
    },
    {
      value: 'external_link',
      sourceId: 'source-bootshaus-ticket-io',
      freshnessAt: '2026-08-02T21:24:48.048Z',
      originExternalId: 'https://bootshaus-club.ticket.io/4zjKRnsa/',
    },
  ],
  updatedAt: '2026-08-02T21:24:48.048+00:00',
  selectionReason: 'import_publish',
  confidence: null,
  freshnessAt: '2026-08-02T21:24:48.048+00:00',
  originExternalId: 'https://bootshaus-club.ticket.io/4zjKRnsa/',
  mergeDecision: null,
  selectedTier: 'ticket_platform',
};

describe('provenance repair manifest', () => {
  it('builds a stable hash for canary provenance repair', () => {
    const hash = buildStableProvenanceRepairManifestHash({
      phase: '4.8.6.6.4b',
      canonicalEventId: 'evt-1785339418526-dn9f7g0',
      evidenceVerifiedAt: EVIDENCE_VERIFIED_AT,
      corrections: [
        {
          fieldPath: 'priceText',
          provenanceId: rollbackPrice.id,
          rollbackSnapshot: rollbackPrice,
          correctedFreshnessAt: EVIDENCE_VERIFIED_AT,
        },
        {
          fieldPath: 'ticketStatus',
          provenanceId: rollbackStatus.id,
          rollbackSnapshot: rollbackStatus,
          correctedFreshnessAt: EVIDENCE_VERIFIED_AT,
        },
      ],
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe('4230e5fd62a179ea30bdeaeaa5398aaa15690a5d4aae003257b43836d6e962f2');
  });

  it('matches post-canary row fingerprint', () => {
    expect(
      buildRowFingerprint({
        id: 'evt-1785339418526-dn9f7g0',
        title: 'Bootshaus on a Ship Vol. IV',
        startDate: '2026-09-13T12:00:00+00:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/4zjKRnsa/',
        websiteUrl: 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iv',
        priceText: 'ab 32,00 €',
        ticketStatus: 'on_sale',
        ticketPhases: [
          {
            id: 'phase-list-admission-io/4zjkrnsa/',
            kind: 'other',
            name: 'List admission',
            isFree: false,
            soldOut: false,
            sortOrder: 900,
            priceLabel: 'ab 32,00 €',
            priceAmount: 32,
            purchaseUrl: 'https://bootshaus-club.ticket.io/4zjKRnsa/',
            priceCurrency: 'EUR',
          },
        ],
        status: 'published',
        sourceId: 'source-bootshaus-koeln',
      }),
    ).toBe('e55b65e3871ba6d91e51f522c16426eab0c4802a2aa129f0ca1234386ae66e6f');
  });
});
