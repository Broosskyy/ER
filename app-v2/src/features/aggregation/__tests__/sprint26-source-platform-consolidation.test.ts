import { describe, expect, it } from 'vitest';

import { AtomFeedConnector, RssFeedConnector } from '@/features/aggregation/connectors/feed-source-connector';
import { CsvImportConnector } from '@/features/aggregation/connectors/csv-import-connector';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { SourceRecord } from '@/data/types/records';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import {
  resolveSourceConnectorKey,
  resolveSourceConnectorKeyFromRecord,
} from '@/features/aggregation/connectors/source-connector-resolution';
import { SourceConnectorError } from '@/features/aggregation/connectors/framework/errors';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { shouldUseAggregationForSource } from '@/features/import/scheduling/scheduler-source-utils';
import {
  applyWebsiteTitleTransforms,
  validateWebsiteTitleTransforms,
} from '@/features/aggregation/connectors/website/title-transforms';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { BOOTSHAUS_WEBSITE_CONFIG } from '@/features/sources/production/production-source-records';

function baseSource(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-test',
    slug: 'test-source',
    displayName: 'Test Source',
    sourceType: 'website',
    parserType: 'html',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: 50,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

const context: PipelineRunContext = {
  runId: 'run-sprint26',
  source: mapSourceRecordToAggregationSource(baseSource()),
  triggerType: 'manual',
  startedAt: new Date().toISOString(),
};

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Events</title>
<item><title>Rave Night</title><link>https://example.com/events/1</link><guid>evt-1</guid><pubDate>Sat, 15 Aug 2026 22:00:00 GMT</pubDate><description>Main room</description></item>
</channel></rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Events</title>
<entry><title>Atom Night</title><id>atom-1</id><link href="https://example.com/events/atom-1"/><updated>2026-08-15T22:00:00Z</updated></entry>
</feed>`;

const CSV_FIXTURE = `external_id,title,start_date,venue_name
csv-1,CSV Night,2026-09-01T22:00:00+02:00,Test Club`;

describe('Sprint 26 — title transforms', () => {
  it('removes suffix', () => {
    expect(
      applyWebsiteTitleTransforms('Techno Night | Bootshaus Club', [
        { type: 'remove_suffix', value: '| Bootshaus Club' },
        { type: 'trim' },
      ]),
    ).toBe('Techno Night');
  });

  it('removes prefix', () => {
    expect(
      applyWebsiteTitleTransforms('LIVE: Warehouse Session', [{ type: 'remove_prefix', value: 'LIVE: ' }]),
    ).toBe('Warehouse Session');
  });

  it('applies regex replace', () => {
    expect(
      applyWebsiteTitleTransforms('Event Title | Venue Name', [
        { type: 'regex_replace', value: '\\s*\\|.*$', replacement: '' },
      ]),
    ).toBe('Event Title');
  });

  it('returns original title when no config', () => {
    expect(applyWebsiteTitleTransforms('Untouched Title', undefined)).toBe('Untouched Title');
  });

  it('reports invalid regex patterns', () => {
    const issues = validateWebsiteTitleTransforms([{ type: 'regex_replace', value: '[invalid' }]);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('cleans Bootshaus detail titles via config without hardcoding', () => {
    const title = applyWebsiteTitleTransforms('Warehouse Rave | Bootshaus Club', BOOTSHAUS_WEBSITE_CONFIG.transforms);
    expect(title).toBe('Warehouse Rave');
    expect(JSON.stringify(BOOTSHAUS_WEBSITE_CONFIG)).not.toContain('html-strategies');
  });
});

describe('Sprint 26 — connector resolution', () => {
  it('resolves explicit connector keys', () => {
    expect(
      resolveSourceConnectorKeyFromRecord(
        baseSource({ sourceConfig: { reference: { connectorKey: 'club_website' } } }),
      ),
    ).toBe('club_website');
  });

  it('maps website club roles to club_website', () => {
    expect(
      resolveSourceConnectorKey({
        sourceType: 'website',
        parserType: 'html',
        sourceRoles: ['club', 'venue'],
      }),
    ).toBe('club_website');
  });

  it('maps website organizer roles to organizer_website', () => {
    expect(
      resolveSourceConnectorKey({
        sourceType: 'website',
        parserType: 'json-ld',
        sourceRoles: ['organizer', 'festival'],
      }),
    ).toBe('organizer_website');
  });

  it('maps rss, atom, and csv source types', () => {
    expect(resolveSourceConnectorKey({ sourceType: 'rss' })).toBe('rss_feed');
    expect(resolveSourceConnectorKey({ sourceType: 'atom' })).toBe('atom_feed');
    expect(resolveSourceConnectorKey({ sourceType: 'csv', parserType: 'csv' })).toBe('csv_import');
  });

  it('rejects ambiguous website roles', () => {
    expect(() =>
      resolveSourceConnectorKey({
        sourceType: 'website',
        sourceRoles: ['club', 'organizer'],
      }),
    ).toThrow(SourceConnectorError);
  });

  it('rejects unknown website sources without roles or connector key', () => {
    expect(() =>
      resolveSourceConnectorKey({
        sourceType: 'website',
        parserType: 'html',
      }),
    ).toThrow(SourceConnectorError);
  });
});

describe('Sprint 26 — aggregation connectors', () => {
  it('loads RSS feed events from inline reference', async () => {
    const connector = new RssFeedConnector();
    const record = baseSource({
      sourceType: 'rss',
      parserType: 'rss',
      sourceConfig: {
        reference: { connectorKey: 'rss_feed', feed: RSS_FIXTURE },
        feed: { feedUrl: 'https://example.com/feed.xml' },
      },
    });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.some((event) => event.title === 'Rave Night')).toBe(true);
    expect(events[0]?.externalId).toBe('evt-1');
  });

  it('loads Atom feed events from inline reference', async () => {
    const connector = new AtomFeedConnector();
    const record = baseSource({
      sourceType: 'rss',
      parserType: 'rss',
      sourceConfig: {
        reference: { connectorKey: 'atom_feed', feed: ATOM_FIXTURE },
      },
    });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.some((event) => event.title === 'Atom Night')).toBe(true);
  });

  it('loads CSV events from inline reference', async () => {
    const connector = new CsvImportConnector();
    const record = baseSource({
      sourceType: 'manual',
      parserType: 'csv',
      sourceConfig: {
        reference: { connectorKey: 'csv_import', csv: CSV_FIXTURE },
        csv: {
          fieldMapping: {
            externalId: 'external_id',
            title: 'title',
            startDate: 'start_date',
            venueName: 'venue_name',
          },
        },
      },
    });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('CSV Night');
  });
});

describe('Sprint 26 — scheduler routing', () => {
  it('enables aggregation for resolvable production sources', () => {
    expect(shouldUseAggregationForSource(createBootshausProductionSourceRecord())).toBe(true);
  });

  it('disables aggregation when connector cannot be resolved', () => {
    expect(shouldUseAggregationForSource(baseSource({ sourceRoles: undefined }))).toBe(false);
  });

  it('registers all sprint 26 connectors in the canonical registry', () => {
    for (const key of ['rss_feed', 'atom_feed', 'csv_import'] as const) {
      expect(sourceConnectorRegistry.getDescriptor(key).connectorKey).toBe(key);
    }
  });
});
