import { describe, expect, it } from 'vitest';

import { officialEvidenceToEventCandidate } from '../../ingestion/adapters/official-evidence-adapter';
import { planOfficialEventWrite } from '../../ingestion/planning/event-write-planner';
import { registerDefaultOfficialConnectors } from '../register-default-connectors';
import { getOfficialSourceRegistry, resetOfficialSourceRegistryForTests } from '../source-registry';
import { ZakkOfficialConnector } from '../zakk/zakk-official-connector';
import { ZAKK_CONNECTOR_ID, ZAKK_LIST_URL } from '../zakk/constants';
import { parseZakkDetailPage } from '../zakk/parse-detail';
import {
  dedupeZakkDetailUrls,
  extractZakkListEntriesFromHtml,
  extractZakkDetailUrlsFromListHtml,
} from '../zakk/parse-list';
import { parseZakkGermanDate, parseZakkJsonLdStartDate } from '../zakk/parse-datetime';
import {
  buildZakkDetailUrl,
  canonicalizeZakkUrl,
  extractZakkEventId,
  isZakkPartyListUrl,
} from '../zakk/url-policy';
import { createEmptyConnectorCounters } from '../types';
import {
  ZAKK_MALFORMED_DATE_FRAGMENT,
  ZAKK_NIGHTCLUB_DETAIL_FRAGMENT,
  ZAKK_PARTY_LIST_FRAGMENT,
} from './fixtures/zakk-fragments';

const FETCHED_AT = '2026-08-26T12:00:00.000Z';

describe('zakk official connector', () => {
  it('can be registered explicitly without duplicate ids', () => {
    resetOfficialSourceRegistryForTests();
    const registry = getOfficialSourceRegistry();
    registerDefaultOfficialConnectors(registry);
    registry.register(new ZakkOfficialConnector());
    expect(registry.listConnectorIds()).toContain(ZAKK_CONNECTOR_ID);
    expect(registry.get(ZAKK_CONNECTOR_ID).metadata.displayName).toBe('zakk Official');
  });

  it('enforces zakk party-only url policy', () => {
    expect(isZakkPartyListUrl('https://www.zakk.de/programm/party')).toBe(true);
    expect(isZakkPartyListUrl('https://www.zakk.de/programm/alle')).toBe(false);
    const detailUrl = buildZakkDetailUrl('16107');
    expect(detailUrl).toBe('https://zakk.de/event-detail?event=16107');
    expect(canonicalizeZakkUrl('https://www.zakk.de/event-detail?event=16107&event-ics-cmd=1')).toBe(
      detailUrl,
    );
    expect(extractZakkEventId(detailUrl!)).toBe('16107');
    expect(canonicalizeZakkUrl('https://bootshaus.tv/events/x/')).toBeNull();
  });

  it('parses zakk json-ld datetime quirks', () => {
    expect(parseZakkJsonLdStartDate('2026-08-28CEST22:00:00+02:00')).toBe(
      '2026-08-28T22:00:00+02:00',
    );
    expect(parseZakkGermanDate('28.08.2026')).toBe('2026-08-28T00:00:00+02:00');
  });

  it('discovers canonical detail urls and keeps recurring editions distinct', () => {
    const connector = new ZakkOfficialConnector();
    const discovery = connector.discoverFromListHtml(ZAKK_PARTY_LIST_FRAGMENT, ZAKK_LIST_URL);
    expect(discovery.detailUrls).toEqual([
      'https://zakk.de/event-detail?event=16192',
      'https://zakk.de/event-detail?event=16193',
    ]);

    const entries = extractZakkListEntriesFromHtml(ZAKK_PARTY_LIST_FRAGMENT);
    expect(entries.map((entry) => entry.sourceEventKey)).toEqual(['16192', '16193', '16192']);
    expect(entries[0]?.title).toContain('50+ Party');
    expect(entries[1]?.title).toBe('Der Rockclub');

    const deduped = dedupeZakkDetailUrls([
      'https://zakk.de/event-detail?event=16192',
      'https://zakk.de/event-detail?event=16192',
    ]);
    expect(deduped.duplicateCount).toBe(1);
    expect(deduped.uniqueUrls).toHaveLength(1);
  });

  it('parses party detail without inventing lineup or genres', () => {
    const counters = createEmptyConnectorCounters();
    const officialUrl = 'https://zakk.de/event-detail?event=16107';
    const evidence = parseZakkDetailPage(
      ZAKK_NIGHTCLUB_DETAIL_FRAGMENT,
      officialUrl,
      FETCHED_AT,
      counters,
    );
    expect(evidence.sourceEventKey).toBe('16107');
    expect(evidence.title).toBe('Nightclub');
    expect(evidence.startsAt).toBe('2026-08-28T22:00:00+02:00');
    expect(evidence.venue?.name).toBe('zakk — Club');
    expect(evidence.venue?.city).toBe('Düsseldorf');
    expect(evidence.lineupCandidates).toEqual([]);
    expect(evidence.explicitGenreLabels).toEqual([]);
    expect(evidence.enrichmentGaps).toContain('lineup_not_announced');
    expect(evidence.enrichmentGaps).toContain('genres_missing');
    expect(evidence.officialImageUrl).toBe('https://zakk.de/images/quadrat/16107.jpg');
    expect(evidence.pageFingerprint).toBeTruthy();
  });

  it('keeps same-night editions separate by event id', () => {
    const counters = createEmptyConnectorCounters();
    const partyEvidence = parseZakkDetailPage(
      ZAKK_NIGHTCLUB_DETAIL_FRAGMENT.replace(/16107/g, '16192').replace(/Nightclub/g, '50+ Party'),
      'https://zakk.de/event-detail?event=16192',
      FETCHED_AT,
      counters,
    );
    const rockEvidence = parseZakkDetailPage(
      ZAKK_NIGHTCLUB_DETAIL_FRAGMENT
        .replace(/16107/g, '16193')
        .replace(/Nightclub/g, 'Der Rockclub')
        .replace('22:00:00', '23:00:00')
        .replace('22 Uhr', '23 Uhr'),
      'https://zakk.de/event-detail?event=16193',
      FETCHED_AT,
      counters,
    );
    expect(partyEvidence.sourceEventKey).toBe('16192');
    expect(rockEvidence.sourceEventKey).toBe('16193');
    expect(partyEvidence.pageFingerprint).not.toBe(rockEvidence.pageFingerprint);
  });

  it('records malformed dates without inventing startsAt', () => {
    const counters = createEmptyConnectorCounters();
    const evidence = parseZakkDetailPage(
      ZAKK_MALFORMED_DATE_FRAGMENT,
      'https://zakk.de/event-detail?event=99999',
      FETCHED_AT,
      counters,
    );
    expect(evidence.startsAt).toBe('');
    expect(counters.invalidDates).toBe(1);
  });

  it('plans persist-ready candidate from parsed evidence', () => {
    const evidence = parseZakkDetailPage(
      ZAKK_NIGHTCLUB_DETAIL_FRAGMENT,
      'https://zakk.de/event-detail?event=16107',
      FETCHED_AT,
      createEmptyConnectorCounters(),
    );
    const candidate = officialEvidenceToEventCandidate({
      ...evidence,
      decision: 'preview_ready',
      reviewReasons: [],
    });
    const plan = planOfficialEventWrite(candidate, {
      connectorId: ZAKK_CONNECTOR_ID,
      existingEvents: [],
      existingSources: [],
      existingVenues: [],
    });
    expect(plan.validation.decision).toBe('persist_ready');
    expect(plan.eventAction).toBe('insert');
  });
});
