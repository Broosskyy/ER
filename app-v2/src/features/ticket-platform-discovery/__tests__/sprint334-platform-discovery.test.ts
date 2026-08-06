import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { SourceRecord } from '@/data/types/records';
import { loadTicketKingsAffenkaefigFixtureHtml } from '@/features/sources/production/ticket-kings-source.fixtures.server';
import { extractTicketIoShopSlugsFromText } from '@/features/ticket-platform-discovery/discovery/ticket-io-shop-discovery';
import { collectDiscoveryCorpusFromSources } from '@/features/ticket-platform-discovery/discovery/discovery-corpus';
import { crawlTicketKingsPlatform } from '@/features/ticket-platform-discovery/discovery/ticket-kings-platform-crawler';
import {
  buildTicketIoShopSourceRecord,
  buildTicketKingsPlatformSourceRecord,
} from '@/features/ticket-platform-discovery/config/proposed-source-config';
import { InMemoryPlatformDiscoveryRepository } from '@/features/ticket-platform-discovery/repositories/platform-discovery-repository';
import { PlatformDiscoveryService } from '@/features/ticket-platform-discovery/services/platform-discovery-service';

const adminRole = 'admin' as const;

const bootshausSource: SourceRecord = {
  id: 'source-bootshaus-ticket-io',
  slug: 'bootshaus-ticket-io',
  displayName: 'Bootshaus Ticket.io',
  sourceType: 'ticket_platform',
  parserType: 'json_ld',
  acquisitionStrategy: 'ticket_platform',
  priority: 60,
  trustScore: 75,
  requiresAuthentication: false,
  enabled: true,
  archived: false,
  reviewRequired: true,
  baseUrl: 'https://bootshaus.ticket.io/',
  website: 'https://bootshaus.ticket.io/',
  sourceConfig: {
    ticketPlatform: {
      platform: 'ticket_io',
      shopSlug: 'bootshaus',
      listUrl: 'https://bootshaus.ticket.io/',
      timezone: 'Europe/Berlin',
      limits: { maxEventsPerRun: 50, requestsPerMinute: 15 },
      scope: { requireElectronicSignal: true },
    },
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('@/features/endpoints/http/default-http-client', () => ({
  defaultHttpClient: {
    fetch: vi.fn(),
  },
}));

import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';

function createService(
  sources: SourceRecord[],
  activateSource: (record: SourceRecord) => Promise<SourceRecord> = async (record) => record,
) {
  const repository = new InMemoryPlatformDiscoveryRepository();
  return new PlatformDiscoveryService(
    repository,
    async () => sources,
    async () => collectDiscoveryCorpusFromSources(sources),
    activateSource,
  );
}

describe('Sprint 33.4 platform discovery', () => {
  beforeEach(() => {
    vi.mocked(defaultHttpClient.fetch).mockReset();
  });

  it('extracts ticket.io shop slugs from corpus text', () => {
    const slugs = extractTicketIoShopSlugsFromText(
      'Tickets at https://bootshaus.ticket.io/events and https://www.ticket.io/ should be ignored',
    );
    expect(slugs).toContain('bootshaus');
    expect(slugs).not.toContain('www');
  });

  it('collects discovery corpus from configured sources', () => {
    const corpus = collectDiscoveryCorpusFromSources([bootshausSource]);
    expect(corpus.join('\n')).toContain('bootshaus.ticket.io');
  });

  it('builds proposed ticket.io shop source config', () => {
    const record = buildTicketIoShopSourceRecord({
      shopSlug: 'newclub',
      listUrl: 'https://newclub.ticket.io/',
      eventCount: 3,
      scopeStats: { discovered: 5, accepted: 3, rejected: 2, rejectionReasons: {} },
    });
    expect(record.sourceConfig?.ticketPlatform?.shopSlug).toBe('newclub');
    expect(record.sourceConfig?.publishPolicy?.behavior).toBe('auto_publish');
    expect(record.enabled).toBe(false);
    expect(record.metadata?.discoveryShopSlug).toBe('newclub');
  });

  it('builds proposed ticket kings platform source config', () => {
    const record = buildTicketKingsPlatformSourceRecord();
    expect(record.sourceConfig?.ticketPlatform?.listUrl).toContain('/all-events/');
    expect(record.metadata?.discoveryMode).toBe('platform_list');
  });

  it('runs ticket kings discovery with mocked HTML', async () => {
    const html = loadTicketKingsAffenkaefigFixtureHtml();
    vi.mocked(defaultHttpClient.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    } as Response);

    const service = createService([bootshausSource]);
    const report = await service.runTicketKingsDiscovery(adminRole);

    expect(report.run.platform).toBe('ticket_king');
    expect(report.run.summary.rawEventsDiscovered).toBeGreaterThan(0);
    expect(report.candidates.some((c) => c.candidateType === 'platform_list')).toBe(true);
    expect(report.run.summary.limitations.length).toBeGreaterThan(0);
  });

  it('flags existing ticket kings platform source as review match', async () => {
    const html = loadTicketKingsAffenkaefigFixtureHtml();
    vi.mocked(defaultHttpClient.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    } as Response);

    const existing: SourceRecord = {
      ...bootshausSource,
      id: 'source-affenkaefig-ticket-kings',
      baseUrl: 'https://ticketkings.de/all-events/',
      website: 'https://ticketkings.de/all-events/',
    };
    const service = createService([existing]);
    const report = await service.runTicketKingsDiscovery(adminRole);
    const platformCandidate = report.candidates.find((c) => c.candidateType === 'platform_list');
    expect(platformCandidate?.status).toBe('review');
    expect(platformCandidate?.duplicateSourceId).toBe('source-affenkaefig-ticket-kings');
  });

  it('activates a discovery candidate and enables scheduler', async () => {
    const html = loadTicketKingsAffenkaefigFixtureHtml();
    vi.mocked(defaultHttpClient.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    } as Response);

    const activated: SourceRecord[] = [];
    const service = createService([], async (record) => {
      activated.push(record);
      return { ...record, id: record.id };
    });

    const report = await service.runTicketKingsDiscovery(adminRole);
    const candidate = report.candidates.find((c) => c.candidateType === 'platform_list');
    expect(candidate).toBeDefined();

    const result = await service.activateCandidate(adminRole, candidate!.id);
    expect(result.candidate.status).toBe('activated');
    expect(activated[0]?.enabled).toBe(true);
    expect(activated[0]?.scheduleEnabled).toBe(true);
    expect(activated[0]?.scheduleIntervalPreset).toBe('every_6_hours');
  });

  it('crawls ticket kings platform with pagination stop', async () => {
    const html = loadTicketKingsAffenkaefigFixtureHtml();
    vi.mocked(defaultHttpClient.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    } as Response);

    const result = await crawlTicketKingsPlatform({ maxPages: 2 });
    expect(result.pagesCrawled).toBeGreaterThan(0);
    expect(result.scopeStats.discovered).toBeGreaterThanOrEqual(0);
  });

  it('rejects discovery without admin role', async () => {
    const service = createService([]);
    await expect(service.runTicketIoDiscovery(null)).rejects.toThrow(/permission/i);
  });
});
