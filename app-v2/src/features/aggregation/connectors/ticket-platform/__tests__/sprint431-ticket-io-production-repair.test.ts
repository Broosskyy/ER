import { describe, expect, it } from 'vitest';

import { NormalizeStep } from '@/features/aggregation/pipeline/steps/normalize-step';
import { importUpdateService } from '@/features/aggregation/services/import-update-service';
import {
  eventNeedsTicketIoFieldRepair,
  resolveFillOnlyText,
  TICKET_IO_DATA_QUALITY_REPAIR_VERSION,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-repair';
import { recordCandidateEquivalent } from '@/features/import/services/import-record-identity';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';

describe('sprint 43.1 production repair', () => {
  it('normalize step passes priceText from raw payload', async () => {
    const step = new NormalizeStep();
    const result = await step.execute(
      [
        {
          externalId: 'https://proton-the-club.ticket.io/hyHJr2xd/',
          sourceUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
          rawPayload: {
            title: 'DNB CONNECTION pres. SHOCKONE',
            startDate: '2026-07-31T23:00:00+02:00',
            priceText: 'ab 12,00 €',
            rawSourceType: 'json_ld',
          },
        },
      ],
      {
        source: {
          id: 'source-ticket-io-protontheclub',
          name: 'Proton',
          defaultTimezone: 'Europe/Berlin',
          countryCode: 'DE',
        },
        jobId: 'job-test',
        connectorKey: 'ticket_platform',
      },
    );

    expect(result.items[0]?.canonicalEvent?.priceText).toBe('ab 12,00 €');
  });

  it('enrichment fill-only clears N/A descriptions and fills missing priceText', () => {
    const existing: AdminEventRecord = {
      id: 'evt-1',
      title: 'Event',
      description: 'N/A',
      startDate: '2026-07-31T23:00:00+02:00',
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const candidate = {
      title: 'Event',
      description: 'Real description',
      priceText: 'ab 12,00 €',
      startDate: '2026-07-31T23:00:00+02:00',
    } as CanonicalImportEvent;

    const enriched = importUpdateService.buildEnrichmentAdminEvent(existing, candidate);
    expect(enriched.description).toBe('Real description');
    expect(enriched.priceText).toBe('ab 12,00 €');
    expect(resolveFillOnlyText('N/A', undefined)).toBe('N/A');
    expect(resolveFillOnlyText('N/A', 'Real description')).toBe('Real description');
    expect(resolveFillOnlyText('Website copy', undefined)).toBe('Website copy');
  });

  it('detects events that still need ticket.io field repair', () => {
    expect(
      eventNeedsTicketIoFieldRepair({
        id: 'evt-1',
        title: 'Event',
        description: 'N/A',
        startDate: '2026-07-31T23:00:00+02:00',
        status: 'published',
        sourceId: 'source-ticket-io-protontheclub',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('passes priceText through getEffectiveCandidate for publish', () => {
    const record = {
      id: 'rec-1',
      importJobId: 'job-1',
      sourceId: 'source-ticket-io-technodampfer',
      externalId: 'https://technodampfer.ticket.io/pmsUCbbF/',
      rawPayload: {},
      normalizedPayload: {
        title: 'TECHNO DAMPFER Köln w/ Saltysis',
        startDate: '2026-07-31T23:00:00+02:00',
        priceText: 'ab 39,90 €',
        rawSourceType: 'json_ld',
      },
      status: 'imported',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as ImportRecord;

    expect(getEffectiveCandidate(record).priceText).toBe('ab 39,90 €');
  });

  it('invalidates equivalence when data quality repair version changes', () => {
    const record = {
      id: 'rec-1',
      normalizedPayload: { dataQualityRepairVersion: '4.3.0' },
      title: 'Event',
      startDate: '2026-07-31T23:00:00+02:00',
    } as unknown as ImportRecord;
    const candidate = {
      title: 'Event',
      startDate: '2026-07-31T23:00:00+02:00',
      sourceMetadata: {
        dataQualityRepairVersion: TICKET_IO_DATA_QUALITY_REPAIR_VERSION,
        normalizedHash: 'abc',
      },
    } as CanonicalImportEvent;

    expect(recordCandidateEquivalent(record, candidate)).toBe(false);
  });
});
