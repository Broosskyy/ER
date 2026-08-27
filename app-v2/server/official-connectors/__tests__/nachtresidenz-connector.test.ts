import { describe, expect, it } from 'vitest';

import { officialEvidenceToEventCandidate } from '../../ingestion/adapters/official-evidence-adapter';
import { planOfficialEventWrite } from '../../ingestion/planning/event-write-planner';
import { NachtresidenzOfficialConnector } from '../nachtresidenz/nachtresidenz-official-connector';
import {
  NACHTRESIDENZ_CONNECTOR_ID,
  NACHTRESIDENZ_LIST_URL,
} from '../nachtresidenz/constants';
import { parseNachtresidenzDetailPage } from '../nachtresidenz/parse-detail';
import {
  dedupeNachtresidenzDetailUrls,
  extractNachtresidenzDetailUrlsFromListHtml,
} from '../nachtresidenz/parse-list';
import {
  buildNachtresidenzEventUrl,
  canonicalizeNachtresidenzUrl,
  extractNachtresidenzEventKey,
} from '../nachtresidenz/url-policy';
import { registerDefaultOfficialConnectors } from '../register-default-connectors';
import { getOfficialSourceRegistry, resetOfficialSourceRegistryForTests } from '../source-registry';
import { createEmptyConnectorCounters } from '../types';
import {
  NACHTRESIDENZ_LIST_FRAGMENT,
  NACHTRESIDENZ_MALFORMED_DATE_FRAGMENT,
} from './fixtures/nachtresidenz-fragments';

const FETCHED_AT = '2026-08-26T12:00:00.000Z';

describe('nachtresidenz official connector', () => {
  it('can be registered explicitly without duplicate ids', () => {
    resetOfficialSourceRegistryForTests();
    const registry = getOfficialSourceRegistry();
    registerDefaultOfficialConnectors(registry);
    registry.register(new NachtresidenzOfficialConnector());
    expect(registry.listConnectorIds()).toContain(NACHTRESIDENZ_CONNECTOR_ID);
    expect(registry.get(NACHTRESIDENZ_CONNECTOR_ID).metadata.displayName).toBe('Nachtresidenz Official');
  });

  it('enforces nachtresidenz url policy', () => {
    const eventUrl = buildNachtresidenzEventUrl('2026-09-05 23:00:00', 'Rakkas');
    expect(eventUrl).toBe(
      'https://www.nachtresidenz.de/events/event/2026-09-05T23-00-00/rakkas/',
    );
    expect(canonicalizeNachtresidenzUrl(eventUrl!)).toBe(eventUrl);
    expect(extractNachtresidenzEventKey(eventUrl!)).toBe('2026-09-05T23-00-00/rakkas');
    expect(canonicalizeNachtresidenzUrl('https://bootshaus.tv/events/x/')).toBeNull();
  });

  it('discovers canonical synthetic detail urls from events listing', () => {
    const connector = new NachtresidenzOfficialConnector();
    const discovery = connector.discoverFromListHtml(NACHTRESIDENZ_LIST_FRAGMENT, NACHTRESIDENZ_LIST_URL);
    expect(discovery.detailUrls).toEqual([
      'https://www.nachtresidenz.de/events/event/2026-08-29T19-00-00/good-old-times-open-air-monberg/',
      'https://www.nachtresidenz.de/events/event/2026-09-05T23-00-00/rakkas/',
    ]);
    const deduped = dedupeNachtresidenzDetailUrls([
      'https://www.nachtresidenz.de/events/event/2026-09-05T23-00-00/rakkas/',
      'https://www.nachtresidenz.de/events/event/2026-09-05T23-00-00/rakkas/',
    ]);
    expect(deduped.duplicateCount).toBe(1);
    expect(deduped.uniqueUrls).toHaveLength(1);
  });

  it('parses a full list event without inventing lineup or genres', () => {
    const counters = createEmptyConnectorCounters();
    const officialUrl = 'https://www.nachtresidenz.de/events/event/2026-09-05T23-00-00/rakkas/';
    const evidence = parseNachtresidenzDetailPage(
      NACHTRESIDENZ_LIST_FRAGMENT,
      officialUrl,
      FETCHED_AT,
      counters,
    );
    expect(evidence.title).toBe('Rakkas');
    expect(evidence.startsAt).toBe('2026-09-05T23:00:00+02:00');
    expect(evidence.venue?.name).toBe('Nachtresidenz');
    expect(evidence.venue?.city).toBe('Düsseldorf');
    expect(evidence.lineupCandidates).toEqual([]);
    expect(evidence.explicitGenreLabels).toEqual([]);
    expect(evidence.enrichmentGaps).toContain('lineup_not_announced');
    expect(evidence.enrichmentGaps).toContain('genres_missing');
    expect(evidence.linkedTicketUrl).toBe('https://www.rakkas.de/event-details/party');
    expect(evidence.officialImageUrl).toContain('nachtresidenz.de');
  });

  it('parses external venue marker from title without inventing city', () => {
    const evidence = parseNachtresidenzDetailPage(
      NACHTRESIDENZ_LIST_FRAGMENT,
      'https://www.nachtresidenz.de/events/event/2026-08-29T19-00-00/good-old-times-open-air-monberg/',
      FETCHED_AT,
      createEmptyConnectorCounters(),
    );
    expect(evidence.venue?.name).toBe('MONBERG');
    expect(evidence.venue?.city).toBeUndefined();
    expect(evidence.enrichmentGaps).toContain('venue_city_missing');
  });

  it('marks malformed datetime without inventing startsAt', () => {
    const counters = createEmptyConnectorCounters();
    const evidence = parseNachtresidenzDetailPage(
      NACHTRESIDENZ_MALFORMED_DATE_FRAGMENT,
      'https://www.nachtresidenz.de/events/event/2026-09-05T23-00-00/broken-date/',
      FETCHED_AT,
      counters,
    );
    expect(evidence.enrichmentGaps).toContain('event_not_found_in_list');
    expect(evidence.startsAt).toBe('');
  });

  it('plans persist-ready candidate from parsed evidence', () => {
    const evidence = parseNachtresidenzDetailPage(
      NACHTRESIDENZ_LIST_FRAGMENT,
      'https://www.nachtresidenz.de/events/event/2026-09-05T23-00-00/rakkas/',
      FETCHED_AT,
      createEmptyConnectorCounters(),
    );
    const candidate = officialEvidenceToEventCandidate({
      ...evidence,
      decision: 'preview_ready',
      reviewReasons: [],
    });
    const plan = planOfficialEventWrite(candidate, {
      connectorId: NACHTRESIDENZ_CONNECTOR_ID,
      existingEvents: [],
      existingSources: [],
      existingVenues: [],
    });
    expect(plan.validation.decision).toBe('persist_ready');
    expect(plan.eventAction).toBe('insert');
  });
});
