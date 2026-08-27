import { describe, expect, it } from 'vitest';

import { officialEvidenceToEventCandidate } from '../../ingestion/adapters/official-evidence-adapter';
import { planOfficialEventWrite } from '../../ingestion/planning/event-write-planner';
import { buildMonthCalendarUrls } from '../shared/month-calendar-urls';
import { registerDefaultOfficialConnectors } from '../register-default-connectors';
import { getOfficialSourceRegistry, resetOfficialSourceRegistryForTests } from '../source-registry';
import { StadtgartenOfficialConnector } from '../stadtgarten/stadtgarten-official-connector';
import {
  STADTGARTEN_CONNECTOR_ID,
  STADTGARTEN_LIST_URL,
  STADTGARTEN_MONTH_PATH_TEMPLATE,
} from '../stadtgarten/constants';
import { parseStadtgartenDetailPage } from '../stadtgarten/parse-detail';
import {
  dedupeStadtgartenDetailUrls,
  extractStadtgartenDetailUrlsFromListHtml,
} from '../stadtgarten/parse-list';
import { assessStadtgartenScope } from '../stadtgarten/parse-scope';
import {
  buildStadtgartenDetailUrl,
  canonicalizeStadtgartenUrl,
  extractStadtgartenEventId,
} from '../stadtgarten/url-policy';
import { createEmptyConnectorCounters } from '../types';
import {
  STADTGARTEN_ELECTRONIC_DETAIL_FRAGMENT,
  STADTGARTEN_JAZZ_DETAIL_FRAGMENT,
  STADTGARTEN_LIST_FRAGMENT,
  STADTGARTEN_MALFORMED_DATE_FRAGMENT,
  STADTGARTEN_WORT_LIST_FRAGMENT,
} from './fixtures/stadtgarten-fragments';

const FETCHED_AT = '2026-08-26T12:00:00.000Z';

describe('stadtgarten official connector', () => {
  it('registers with existing connectors without duplicate ids', () => {
    resetOfficialSourceRegistryForTests();
    const registry = getOfficialSourceRegistry();
    registerDefaultOfficialConnectors(registry);
    expect(registry.listConnectorIds()).toContain(STADTGARTEN_CONNECTOR_ID);
    expect(registry.get(STADTGARTEN_CONNECTOR_ID).metadata.displayName).toBe('Stadtgarten Official');
  });

  it('builds generic month calendar urls', () => {
    const urls = buildMonthCalendarUrls({
      baseListUrl: STADTGARTEN_LIST_URL,
      monthPathTemplate: STADTGARTEN_MONTH_PATH_TEMPLATE,
      startYear: 2026,
      startMonth: 8,
      monthCount: 3,
    });
    expect(urls).toEqual([
      'https://www.stadtgarten.de/programm/year:2026/month:08',
      'https://www.stadtgarten.de/programm/year:2026/month:09',
      'https://www.stadtgarten.de/programm/year:2026/month:10',
    ]);
  });

  it('enforces stadtgarten url policy', () => {
    const detailUrl = buildStadtgartenDetailUrl('nica-live-11339', '11339');
    expect(detailUrl).toBe('https://www.stadtgarten.de/programm/nica-live-11339-11339/');
    expect(canonicalizeStadtgartenUrl(detailUrl!)).toBe(detailUrl);
    expect(extractStadtgartenEventId(detailUrl!)).toBe('11339');
    expect(canonicalizeStadtgartenUrl('https://bootshaus.tv/events/x/')).toBeNull();
  });

  it('discovers canonical detail urls from month listing', () => {
    const connector = new StadtgartenOfficialConnector();
    const discovery = connector.discoverFromListHtml(STADTGARTEN_LIST_FRAGMENT, STADTGARTEN_LIST_URL);
    expect(discovery.detailUrls).toEqual([
      'https://www.stadtgarten.de/programm/jazz-at-green-room-paul-prassel-quartett-11338/',
      'https://www.stadtgarten.de/programm/nica-live-into-the-5th-dimension-guided-by-anunaki-tabla-feat-andreas-voelk-kenn-hartwig-teresa-coll-leif-berger-philip-zoubek-11339/',
    ]);
    const deduped = dedupeStadtgartenDetailUrls([
      'https://www.stadtgarten.de/programm/jazz-at-green-room-paul-prassel-quartett-11338/',
      'https://www.stadtgarten.de/programm/jazz-at-green-room-paul-prassel-quartett-11338/',
    ]);
    expect(deduped.duplicateCount).toBe(1);
    expect(deduped.uniqueUrls).toHaveLength(1);
  });

  it('assesses scope from explicit published genre labels only', () => {
    expect(assessStadtgartenScope(['Konzert'], ['Jazz'])).toBe('outside_scope');
    expect(
      assessStadtgartenScope(['Konzert'], ['Alien-Jazz', 'Low-Current-Electronica']),
    ).toBe('include');
    expect(assessStadtgartenScope(['Wort'], ['Lesung', 'Wort'])).toBe('outside_scope');
    expect(assessStadtgartenScope(['Konzert', 'Wort'], [])).toBe('outside_scope');
  });

  it('parses electronic detail without inventing lineup', () => {
    const counters = createEmptyConnectorCounters();
    const officialUrl =
      'https://www.stadtgarten.de/programm/nica-live-into-the-5th-dimension-guided-by-anunaki-tabla-feat-andreas-voelk-kenn-hartwig-teresa-coll-leif-berger-philip-zoubek-11339/';
    const evidence = parseStadtgartenDetailPage(
      STADTGARTEN_ELECTRONIC_DETAIL_FRAGMENT,
      officialUrl,
      FETCHED_AT,
      counters,
    );
    expect(evidence.title).toBe('NICA live: Into the 5th Dimension');
    expect(evidence.startsAt).toBe('2026-08-31T20:00:00+02:00');
    expect(evidence.venue?.name).toBe('Stadtgarten — GREEN ROOM');
    expect(evidence.venue?.city).toBe('Köln');
    expect(evidence.lineupCandidates).toEqual([]);
    expect(evidence.explicitGenreLabels).toContain('Low-Current-Electronica');
    expect(evidence.enrichmentGaps).toContain('lineup_not_announced');
    expect(evidence.enrichmentGaps).not.toContain('outside_scope_skipped');
    expect(evidence.linkedTicketUrl).toBe('https://stadtgarten.ticket.io/Sx7s7v8w/');
    expect(evidence.pageFingerprint).toBeTruthy();
  });

  it('marks jazz-only detail as outside scope', () => {
    const counters = createEmptyConnectorCounters();
    const officialUrl = 'https://www.stadtgarten.de/programm/jazz-at-green-room-paul-prassel-quartett-11338/';
    const evidence = parseStadtgartenDetailPage(
      STADTGARTEN_JAZZ_DETAIL_FRAGMENT,
      officialUrl,
      FETCHED_AT,
      counters,
    );
    expect(evidence.enrichmentGaps).toContain('outside_scope_skipped');
  });

  it('records invalid dates without inventing startsAt', () => {
    const counters = createEmptyConnectorCounters();
    const evidence = parseStadtgartenDetailPage(
      STADTGARTEN_MALFORMED_DATE_FRAGMENT,
      'https://www.stadtgarten.de/programm/broken-date-99999/',
      FETCHED_AT,
      counters,
    );
    expect(evidence.startsAt).toBe('');
    expect(counters.invalidDates).toBe(1);
  });

  it('plans consumer-ready electronic evidence', () => {
    const counters = createEmptyConnectorCounters();
    const officialUrl =
      'https://www.stadtgarten.de/programm/nica-live-into-the-5th-dimension-guided-by-anunaki-tabla-feat-andreas-voelk-kenn-hartwig-teresa-coll-leif-berger-philip-zoubek-11339/';
    const evidence = parseStadtgartenDetailPage(
      STADTGARTEN_ELECTRONIC_DETAIL_FRAGMENT,
      officialUrl,
      FETCHED_AT,
      counters,
    );
    const candidate = officialEvidenceToEventCandidate({
      ...evidence,
      decision: 'preview_ready',
      reviewReasons: [],
    });
    const plan = planOfficialEventWrite(candidate, {
      connectorId: STADTGARTEN_CONNECTOR_ID,
      existingEvents: [],
      existingSources: [],
      existingVenues: [],
    });
    expect(plan.validation.decision).toBe('persist_ready');
    expect(plan.eventAction).toBe('insert');
  });

  it('skips wort-only listings during discovery scope pre-check', () => {
    const wortUrls = extractStadtgartenDetailUrlsFromListHtml(STADTGARTEN_WORT_LIST_FRAGMENT);
    expect(wortUrls).toHaveLength(1);
    const entryGenre = 'Lesung, Wort';
    expect(assessStadtgartenScope(['Wort'], entryGenre.split(',').map((s) => s.trim()))).toBe(
      'outside_scope',
    );
  });
});
