import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { officialEvidenceToEventCandidate } from '../../ingestion/adapters/official-evidence-adapter';
import { planOfficialEventWrite } from '../../ingestion/planning/event-write-planner';
import { AffenkaefigOfficialConnector } from '../affenkaefig/affenkaefig-official-connector';
import { AFFENKAEFIG_CONNECTOR_ID, AFFENKAEFIG_LIST_URL } from '../affenkaefig/constants';
import { parseAffenkaefigDetailPage } from '../affenkaefig/parse-detail';
import {
  dedupeAffenkaefigDetailUrls,
  extractAffenkaefigDetailUrlsFromListHtml,
} from '../affenkaefig/parse-list';
import {
  buildAffenkaefigDetailUrl,
  canonicalizeAffenkaefigUrl,
  extractAffenkaefigDetailSlug,
} from '../affenkaefig/url-policy';
import { registerDefaultOfficialConnectors } from '../register-default-connectors';
import { getOfficialSourceRegistry, resetOfficialSourceRegistryForTests } from '../source-registry';
import { createEmptyConnectorCounters } from '../types';
import {
  AFFENKAEFIG_FULL_EVENT_FRAGMENT,
  AFFENKAEFIG_LINEUP_NOT_ANNOUNCED_FRAGMENT,
  AFFENKAEFIG_LIST_FRAGMENT,
  AFFENKAEFIG_MALFORMED_DATE_FRAGMENT,
  AFFENKAEFIG_MISSING_DESCRIPTION_FRAGMENT,
} from './fixtures/affenkaefig-fragments';

const FETCHED_AT = '2026-08-26T12:00:00.000Z';

describe('affenkaefig official connector', () => {
  it('registers alongside bootshaus without duplicate ids', () => {
    resetOfficialSourceRegistryForTests();
    const registry = getOfficialSourceRegistry();
    registerDefaultOfficialConnectors(registry);
    expect(registry.listConnectorIds().sort()).toEqual(['affenkaefig-official', 'bootshaus-official']);
    expect(registry.get(AFFENKAEFIG_CONNECTOR_ID).metadata.displayName).toBe('Affenkäfig Official');
  });

  it('enforces affenkaefig url policy', () => {
    expect(canonicalizeAffenkaefigUrl('http://affenkaefig.info/event/sample/')).toBe(
      'https://affenkaefig.info/event/sample/',
    );
    expect(extractAffenkaefigDetailSlug('https://affenkaefig.info/event/sample/')).toBe('sample');
    expect(buildAffenkaefigDetailUrl('sample')).toBe('https://affenkaefig.info/event/sample/');
    expect(canonicalizeAffenkaefigUrl('https://bootshaus.tv/events/x/')).toBeNull();
  });

  it('discovers canonical detail urls from tickets list', () => {
    const connector = new AffenkaefigOfficialConnector();
    const discovery = connector.discoverFromListHtml(AFFENKAEFIG_LIST_FRAGMENT, AFFENKAEFIG_LIST_URL);
    expect(discovery.detailUrls).toEqual([
      'https://affenkaefig.info/event/14-jahreaffenkafig19-09-2026/',
      'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/',
    ]);
    const deduped = dedupeAffenkaefigDetailUrls([
      'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/',
      'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/',
    ]);
    expect(deduped.duplicateCount).toBe(1);
    expect(deduped.uniqueUrls).toHaveLength(1);
  });

  it('parses a full event with explicit lineup and no invented genres', () => {
    const counters = createEmptyConnectorCounters();
    const evidence = parseAffenkaefigDetailPage(
      AFFENKAEFIG_FULL_EVENT_FRAGMENT,
      'https://affenkaefig.info/event/14-jahreaffenkaefig19-09-2026/',
      FETCHED_AT,
      counters,
    );
    expect(evidence.title).toContain('14 Jahre Affenkäfig');
    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual(['IMHAPPY', 'KOPF & HÖRER']);
    expect(evidence.explicitGenreLabels).toEqual([]);
    expect(evidence.enrichmentGaps).toContain('genres_missing');
    expect(evidence.startsAt).toContain('T22:00:00');
    expect(evidence.venue?.city).toBe('Köln');
  });

  it('marks lineup_not_announced without inventing acts', () => {
    const evidence = parseAffenkaefigDetailPage(
      AFFENKAEFIG_LINEUP_NOT_ANNOUNCED_FRAGMENT,
      'https://affenkaefig.info/event/affenkaefigrulesbootshaus-koeln-23-10-26/',
      FETCHED_AT,
      createEmptyConnectorCounters(),
    );
    expect(evidence.lineupCandidates).toEqual([]);
    expect(evidence.enrichmentGaps).toContain('lineup_not_announced');
    expect(evidence.explicitGenreLabels).toEqual([]);
  });

  it('leaves missing description empty instead of inventing content', () => {
    const evidence = parseAffenkaefigDetailPage(
      AFFENKAEFIG_MISSING_DESCRIPTION_FRAGMENT,
      'https://affenkaefig.info/event/affenkaefig-xxx-capitol-xxx-hagen-17-10-2026/',
      FETCHED_AT,
      createEmptyConnectorCounters(),
    );
    expect(evidence.descriptionClean).toBeUndefined();
    expect(evidence.venue?.name).toBe('Capitol');
  });

  it('records malformed dates without crashing', () => {
    const counters = createEmptyConnectorCounters();
    const evidence = parseAffenkaefigDetailPage(
      AFFENKAEFIG_MALFORMED_DATE_FRAGMENT,
      'https://affenkaefig.info/event/broken-date/',
      FETCHED_AT,
      counters,
    );
    expect(counters.invalidDates).toBeGreaterThan(0);
    expect(evidence.startsAt).toBe('not-a-date');
  });

  it('matches an existing bootshaus canonical event instead of forcing a new insert', () => {
    const evidence = parseAffenkaefigDetailPage(
      AFFENKAEFIG_LINEUP_NOT_ANNOUNCED_FRAGMENT,
      'https://affenkaefig.info/event/affenkaefigrulesbootshaus-koeln-23-10-26/',
      FETCHED_AT,
      createEmptyConnectorCounters(),
    );
    const candidate = officialEvidenceToEventCandidate(evidence);
    const plan = planOfficialEventWrite(candidate, {
      existingSources: [
        {
          sourceId: 'bootshaus-source-1',
          eventId: 'event-bootshaus-rules',
          sourceUrl: 'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln/',
          contentHash: 'bootshaus-hash',
          sourceRole: 'official',
          sourceEventKey: 'affenkaefig-rules-bootshaus-koeln',
          connectorId: 'bootshaus-official',
        },
      ],
      existingVenues: [{ id: 'venue-bootshaus', name: 'Bootshaus', city: 'Köln', postalCode: '51063' }],
      existingEvents: [
        {
          eventId: 'event-bootshaus-rules',
          title: 'AFFENKÄFIG RULES // BOOTSHAUS KÖLN',
          description: 'AFFENKÄFIG RULES! BOOTSHAUS – FULL HOUSE!',
          startsAt: '2026-10-23T00:00:00+02:00',
          endsAt: undefined,
          timezone: 'Europe/Berlin',
          organizerName: 'BOOTSHAUS',
          imageUrl: 'https://example.com/image.png',
          venueId: 'venue-bootshaus',
          status: 'published',
          lineup: [],
          genres: [],
        },
      ],
      eventCatalog: [
        {
          eventId: 'event-bootshaus-rules',
          title: 'AFFENKÄFIG RULES // BOOTSHAUS KÖLN',
          startsAt: '2026-10-23T00:00:00+02:00',
          endsAt: undefined,
          timezone: 'Europe/Berlin',
          venueName: 'Bootshaus',
          venueCity: 'Köln',
          venuePostalCode: '51063',
          organizerName: 'BOOTSHAUS',
          lineupBillingNames: [],
          sourceBindings: [
            {
              sourceId: 'bootshaus-source-1',
              eventId: 'event-bootshaus-rules',
              sourceRole: 'official',
              sourceUrl: 'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln/',
              sourceEventKey: 'affenkaefig-rules-bootshaus-koeln',
              connectorId: 'bootshaus-official',
            },
          ],
        },
      ],
    });

    expect(['exact_match', 'strong_match']).toContain(plan.identity?.decision);
    expect(plan.eventAction).not.toBe('insert');
    expect(plan.sourceAction).toBe('insert');
  });

  it('parses cached live html fixtures when present', () => {
    const fixturePath = join(process.cwd(), '.tmp/m8-6-affenkaefig-audit/details/14-jahreaffenkafig19-09-2026.html');
    try {
      const html = readFileSync(fixturePath, 'utf8');
    const evidence = parseAffenkaefigDetailPage(
      html,
      'https://affenkaefig.info/event/14-jahreaffenkafig19-09-2026/',
      FETCHED_AT,
      createEmptyConnectorCounters(),
    );
    expect(evidence.lineupCandidates.length).toBeGreaterThan(5);
    expect(evidence.explicitGenreLabels).toEqual([]);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  });
});
