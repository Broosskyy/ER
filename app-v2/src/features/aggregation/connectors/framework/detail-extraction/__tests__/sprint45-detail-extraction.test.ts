import { describe, expect, it } from 'vitest';

import {
  mergeListDetailFields,
  resolveDetailExtractionCapability,
} from '@/features/aggregation/connectors/framework/detail-extraction/detail-extraction-lifecycle';
import {
  buildConnectorCapabilityProfile,
} from '@/features/aggregation/connectors/framework/detail-extraction/connector-field-coverage';
import {
  calculateEventDataCompleteness,
  averageCompletenessPercentage,
} from '@/features/aggregation/connectors/framework/detail-extraction/event-data-completeness';
import {
  calculateConnectorQualityScore,
} from '@/features/aggregation/connectors/framework/detail-extraction/connector-quality-score';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { createAffenkaefigSourceRecord } from '@/features/sources/production/affenkaefig-source';
import { mapSourceRecordToRegistryEntry } from '@/features/sources/domain/source-registry';
import { sourceHealthResolver } from '@/features/sources/domain/source-health-resolver';
import { BOOTSHAUS_DETAIL_FIXTURE_HTML } from '@/features/sources/production/bootshaus-fixture';
import { extractDetailPageEventWithStrategy } from '@/features/aggregation/connectors/website/html-strategies';
import { BOOTSHAUS_WEBSITE_CONFIG } from '@/features/sources/production/production-source-records';

describe('detail extraction lifecycle', () => {
  it('classifies list-only vs list+detail connectors', () => {
    const listOnly = resolveDetailExtractionCapability({
      connectorKey: 'club_website',
      maxDetailPages: 0,
    });
    const listDetail = resolveDetailExtractionCapability({
      connectorKey: 'club_website',
      maxDetailPages: 50,
    });
    expect(listOnly.level).toBe(1);
    expect(listDetail.level).toBe(2);
    expect(listDetail.supportsDetailFetch).toBe(true);
  });

  it('merges detail description without downgrading list text', () => {
    const { merged } = mergeListDetailFields(
      { externalId: 'evt-1', description: 'Short list text' },
      { externalId: 'evt-1', description: 'Much longer detail description with lineup and venue info' },
    );
    expect(merged.description).toContain('Much longer detail');
  });

  it('preserves meaningful list description when detail is empty', () => {
    const { merged } = mergeListDetailFields(
      { externalId: 'evt-2', description: 'Existing meaningful description from list' },
      { externalId: 'evt-2', description: '' },
    );
    expect(merged.description).toBe('Existing meaningful description from list');
  });
});

describe('connector capability profiles', () => {
  it('reports Bootshaus as list+detail after Sprint 4.5 config', () => {
    const profile = buildConnectorCapabilityProfile(createBootshausProductionSourceRecord());
    expect(profile.detailCapability.level).toBe(2);
    expect(profile.detailCapability.maxDetailPages).toBe(50);
    expect(profile.lostFields).not.toContain('description');
    const description = profile.fieldCoverage.find((field) => field.field === 'description');
    expect(description?.rating).toBeGreaterThanOrEqual(4);
  });

  it('reports Affenkäfig as structured list+detail', () => {
    const profile = buildConnectorCapabilityProfile(createAffenkaefigSourceRecord());
    expect(profile.detailCapability.level).toBe(3);
    expect(profile.detailCapability.supportsStructuredData).toBe(true);
  });
});

describe('event data completeness', () => {
  it('calculates percentage from canonical fields', () => {
    const result = calculateEventDataCompleteness({
      title: 'PLAY! Open Air',
      startDate: '2026-08-01T14:00:00+02:00',
      venue: 'Bootshaus',
      organizer: 'Bootshaus',
      ticketUrl: 'https://bootshaus.tv/events/play',
      imageUrl: 'https://cdn.example/image.png',
      city: 'Köln',
      country: 'DE',
    });
    expect(result.percentage).toBeGreaterThan(50);
    expect(result.fields.find((field) => field.field === 'description')?.present).toBe(false);
  });

  it('averages completeness across samples', () => {
    const samples = [
      calculateEventDataCompleteness({ title: 'A', startDate: '2026-01-01' }),
      calculateEventDataCompleteness({
        title: 'B',
        startDate: '2026-01-02',
        venue: 'Club',
        description: 'Full text',
        artists: ['DJ'],
      }),
    ];
    expect(averageCompletenessPercentage(samples)).toBeGreaterThan(0);
  });
});

describe('connector quality score', () => {
  it('scores Bootshaus higher than list-only baseline', () => {
    const source = mapSourceRecordToRegistryEntry(createBootshausProductionSourceRecord());
    const health = sourceHealthResolver.resolve(source);
    const score = calculateConnectorQualityScore({ source, health });
    const listOnly = resolveDetailExtractionCapability({ connectorKey: 'club_website', maxDetailPages: 0 });
    expect(score.detailLevel).toBe(2);
    expect(score.detailLevel).toBeGreaterThan(listOnly.level);
    expect(score.score).toBeGreaterThan(30);
  });
});

describe('Bootshaus detail regression', () => {
  it('extracts og:description from detail fixture', async () => {
    const event = await extractDetailPageEventWithStrategy(
      {
        requestedUrl: 'https://bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln/',
        finalUrl: 'https://bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln/',
        html: BOOTSHAUS_DETAIL_FIXTURE_HTML,
        responseSize: BOOTSHAUS_DETAIL_FIXTURE_HTML.length,
        redirectChain: [],
        contentType: 'text/html',
        statusCode: 200,
        fetchedAt: new Date().toISOString(),
        headers: {},
      },
      BOOTSHAUS_WEBSITE_CONFIG,
      { baseUrl: 'https://bootshaus.tv/events/', connectorKey: 'club_website' },
    );
    expect(event?.rawDescription).toContain('Drum');
    expect(event?.rawDescription).toContain('Bass');
  });
});
