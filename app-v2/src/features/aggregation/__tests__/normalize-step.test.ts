import { describe, expect, it } from 'vitest';

import { NormalizeStep } from '@/features/aggregation/pipeline/steps/normalize-step';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

const source: AggregationSource = {
  id: 'source-1',
  name: 'Club Website',
  slug: 'club-website',
  type: 'website',
  countryCode: 'DE',
  status: 'active',
  priority: 50,
  importStrategy: 'manual',
  parserType: 'html',
  acquisitionStrategy: 'manual',
  requiresAuthentication: false,
  authPrepared: false,
  reviewRequired: true,
  trustScore: 50,
};

const context: PipelineRunContext = {
  runId: 'run-1',
  source,
  triggerType: 'manual',
  startedAt: new Date().toISOString(),
};

describe('normalize step', () => {
  it('normalizes raw payloads into canonical import events', async () => {
    const step = new NormalizeStep();
    const result = await step.execute(
      [
        {
          externalId: 'evt-1',
          rawPayload: {
            title: 'Open Air',
            startDate: '2026-08-01T20:00:00+02:00',
            venueName: 'Flutgraben',
            cityName: 'Berlin',
          },
        },
      ],
      context,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.canonicalEvent?.title).toBe('Open Air');
    expect(result.items[0]?.canonicalEvent?.sourceId).toBe('source-1');
    expect(result.items[0]?.canonicalEvent?.countryCode).toBe('DE');
  });
});
