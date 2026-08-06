import { AppError } from '@/core/errors/app-error';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import { canManageSources } from '@/features/admin/admin-permissions';
import type { TicketPlatformId } from '@/features/aggregation/connectors/ticket-platform/types';
import type { SourceRecord } from '@/data/types/records';
import {
  buildTicketIoShopSourceRecord,
  buildTicketKingsOrganizerSourceRecord,
  buildTicketKingsPlatformSourceRecord,
} from '@/features/ticket-platform-discovery/config/proposed-source-config';
import {
  crawlTicketKingsPlatform,
  TICKET_KINGS_PLATFORM_LIST_URL,
} from '@/features/ticket-platform-discovery/discovery/ticket-kings-platform-crawler';
import { discoverTicketIoShops } from '@/features/ticket-platform-discovery/discovery/ticket-io-shop-discovery';
import type {
  PlatformDiscoveryCandidate,
  PlatformDiscoveryReport,
  PlatformDiscoveryRun,
  PlatformDiscoveryRunSummary,
} from '@/features/ticket-platform-discovery/domain/types';
import type { PlatformDiscoveryRepository } from '@/features/ticket-platform-discovery/repositories/platform-discovery-repository';

function createRunId(): string {
  return `platform-discovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createCandidateId(): string {
  return `platform-candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assertCanDiscover(role: AdminRole | null): void {
  if (!canManageSources(role)) {
    throw new AppError('You do not have permission to run platform discovery.', { code: 'UNAUTHORIZED' });
  }
}

function matchSourceByListUrl(sources: SourceRecord[], listUrl: string): SourceRecord | undefined {
  const normalized = listUrl.replace(/\/$/, '');
  return sources.find((source) => {
    const urls = [source.baseUrl, source.website].filter(Boolean) as string[];
    return urls.some((url) => url.replace(/\/$/, '') === normalized);
  });
}

function matchTicketIoShop(sources: SourceRecord[], shopSlug: string): SourceRecord | undefined {
  return sources.find((source) => {
    const configSlug = source.sourceConfig?.ticketPlatform?.shopSlug;
    if (configSlug?.toLowerCase() === shopSlug.toLowerCase()) {
      return true;
    }
    const urls = [source.baseUrl, source.website].filter(Boolean) as string[];
    return urls.some((url) => url.toLowerCase().includes(`${shopSlug.toLowerCase()}.ticket.io`));
  });
}

export class PlatformDiscoveryService {
  constructor(
    private readonly repository: PlatformDiscoveryRepository,
    private readonly listSources: () => Promise<SourceRecord[]>,
    private readonly collectCorpusTexts: () => Promise<string[]>,
    private readonly activateSource: (record: SourceRecord) => Promise<SourceRecord>,
  ) {}

  async runTicketKingsDiscovery(role: AdminRole | null): Promise<PlatformDiscoveryReport> {
    assertCanDiscover(role);
    const now = new Date().toISOString();
    const runId = createRunId();
    const sources = await this.listSources();

    const crawl = await crawlTicketKingsPlatform();
    const summary: PlatformDiscoveryRunSummary = {
      platform: 'ticket_king',
      pagesCrawled: crawl.pagesCrawled,
      rawEventsDiscovered: crawl.rawEvents.length,
      electronicEventsAccepted: crawl.acceptedEvents.length,
      electronicEventsRejected: crawl.scopeStats.rejected,
      rejectionReasons: Object.entries(crawl.scopeStats.rejectionReasons).map(([reason, count]) => ({
        reason,
        count,
      })),
      uniqueOrganizers: crawl.organizers.size,
      uniqueVenues: crawl.venues.size,
      newShopCandidates: 0,
      existingSourceMatches: 0,
      limitations: crawl.limitations,
    };

    const run: PlatformDiscoveryRun = {
      id: runId,
      platform: 'ticket_king',
      status: 'completed',
      summary,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.saveRun(run);

    const candidates: PlatformDiscoveryCandidate[] = [];
    const platformMatch = matchSourceByListUrl(sources, TICKET_KINGS_PLATFORM_LIST_URL);
    const platformRecord = buildTicketKingsPlatformSourceRecord({
      enabled: false,
      scheduleEnabled: false,
    });
    candidates.push(
      await this.repository.saveCandidate({
        id: createCandidateId(),
        runId,
        platform: 'ticket_king',
        candidateType: 'platform_list',
        identifier: TICKET_KINGS_PLATFORM_LIST_URL,
        displayName: 'Ticket Kings — all events',
        listUrl: TICKET_KINGS_PLATFORM_LIST_URL,
        proposedSourceConfig: platformRecord.sourceConfig,
        discoveryStats: {
          ...crawl.scopeStats,
          eventCount: crawl.acceptedEvents.length,
        },
        status: platformMatch ? 'review' : 'discovered',
        duplicateSourceId: platformMatch?.id,
        createdAt: now,
        updatedAt: now,
      }),
    );
    if (platformMatch) {
      summary.existingSourceMatches += 1;
    } else {
      summary.newShopCandidates += 1;
    }

    for (const [organizerName, eventCount] of crawl.organizers.entries()) {
      const organizerRecord = buildTicketKingsOrganizerSourceRecord(organizerName);
      const duplicate = sources.find(
        (source) =>
          source.metadata?.discoveryOrganizer === organizerName ||
          source.displayName.toLowerCase().includes(organizerName.toLowerCase()),
      );
      const candidate = await this.repository.saveCandidate({
        id: createCandidateId(),
        runId,
        platform: 'ticket_king',
        candidateType: 'organizer',
        identifier: organizerName,
        displayName: organizerName,
        listUrl: TICKET_KINGS_PLATFORM_LIST_URL,
        proposedSourceConfig: organizerRecord.sourceConfig,
        discoveryStats: { discovered: eventCount, accepted: eventCount, rejected: 0, rejectionReasons: {} },
        status: duplicate ? 'review' : 'discovered',
        duplicateSourceId: duplicate?.id,
        createdAt: now,
        updatedAt: now,
      });
      candidates.push(candidate);
      if (duplicate) {
        summary.existingSourceMatches += 1;
      } else {
        summary.newShopCandidates += 1;
      }
    }

    await this.repository.saveRun({ ...run, summary, updatedAt: new Date().toISOString() });
    return { run: { ...run, summary }, candidates };
  }

  async runTicketIoDiscovery(role: AdminRole | null): Promise<PlatformDiscoveryReport> {
    assertCanDiscover(role);
    const now = new Date().toISOString();
    const runId = createRunId();
    const sources = await this.listSources();
    const corpus = await this.collectCorpusTexts();
    const knownSlugs = sources
      .map((source) => source.sourceConfig?.ticketPlatform?.shopSlug)
      .filter((slug): slug is string => Boolean(slug));

    const shops = await discoverTicketIoShops({
      corpusTexts: corpus,
      knownShopSlugs: knownSlugs,
      maxShops: 30,
      excludeShopSlugs: ['bootshaus-club'],
    });

    const summary: PlatformDiscoveryRunSummary = {
      platform: 'ticket_io',
      pagesCrawled: shops.length,
      rawEventsDiscovered: shops.reduce((sum, shop) => sum + shop.scopeStats.discovered, 0),
      electronicEventsAccepted: shops.reduce((sum, shop) => sum + shop.eventCount, 0),
      electronicEventsRejected: shops.reduce((sum, shop) => sum + shop.scopeStats.rejected, 0),
      rejectionReasons: [],
      uniqueOrganizers: 0,
      uniqueVenues: 0,
      newShopCandidates: 0,
      existingSourceMatches: 0,
      limitations: [
        'ticket.io has no public platform-wide event index or shop directory API.',
        'Discovery mines *.ticket.io URLs from expanded corpus (sources, seeds, published events, import records).',
        'Bootshaus enrichment source is excluded from new-shop discovery.',
        'Slug enumeration is not performed.',
      ],
    };

    const run: PlatformDiscoveryRun = {
      id: runId,
      platform: 'ticket_io',
      status: 'completed',
      summary,
      createdAt: now,
      updatedAt: now,
    };

    const candidates: PlatformDiscoveryCandidate[] = [];
    for (const shop of shops) {
      const duplicate = matchTicketIoShop(sources, shop.shopSlug);
      const record = buildTicketIoShopSourceRecord(shop);
      const candidate = await this.repository.saveCandidate({
        id: createCandidateId(),
        runId,
        platform: 'ticket_io',
        candidateType: 'shop',
        identifier: shop.shopSlug,
        displayName: shop.shopSlug,
        listUrl: shop.listUrl,
        proposedSourceConfig: record.sourceConfig,
        discoveryStats: { ...shop.scopeStats, eventCount: shop.eventCount },
        status: duplicate ? 'review' : 'discovered',
        duplicateSourceId: duplicate?.id,
        createdAt: now,
        updatedAt: now,
      });
      candidates.push(candidate);
      if (duplicate) {
        summary.existingSourceMatches += 1;
      } else {
        summary.newShopCandidates += 1;
      }
    }

    await this.repository.saveRun({ ...run, summary, updatedAt: new Date().toISOString() });
    return { run: { ...run, summary }, candidates };
  }

  async activateCandidate(
    role: AdminRole | null,
    candidateId: string,
  ): Promise<{ candidate: PlatformDiscoveryCandidate; source: SourceRecord }> {
    assertCanDiscover(role);
    const candidate = await this.repository.getCandidateById(candidateId);
    if (!candidate) {
      throw new AppError('Discovery candidate not found.', { code: 'NOT_FOUND' });
    }
    if (candidate.status === 'activated') {
      throw new AppError('Candidate already activated.', { code: 'VALIDATION' });
    }

    let record: SourceRecord;
    if (candidate.platform === 'ticket_io' && candidate.candidateType === 'shop') {
      record = buildTicketIoShopSourceRecord({
        shopSlug: candidate.identifier,
        listUrl: candidate.listUrl ?? '',
        eventCount: candidate.discoveryStats?.eventCount ?? 0,
        scopeStats: candidate.discoveryStats ?? {
          discovered: 0,
          accepted: 0,
          rejected: 0,
          rejectionReasons: {},
        },
      });
    } else if (candidate.platform === 'ticket_king' && candidate.candidateType === 'platform_list') {
      record = buildTicketKingsPlatformSourceRecord();
    } else if (candidate.platform === 'ticket_king' && candidate.candidateType === 'organizer') {
      record = buildTicketKingsOrganizerSourceRecord(candidate.identifier);
    } else {
      throw new AppError(`Unsupported candidate type ${candidate.candidateType}.`, { code: 'VALIDATION' });
    }

    record = {
      ...record,
      enabled: true,
      scheduleEnabled: true,
      schedulePolicy: 'interval',
      scheduleIntervalPreset: 'every_6_hours',
      scheduleTimezone: 'Europe/Berlin',
      pollingIntervalMinutes: 360,
    };

    const saved = await this.activateSource(record);
    const updated = await this.repository.updateCandidateStatus(candidateId, 'activated', saved.id);
    return { candidate: updated, source: saved };
  }

  async listRecentRuns(role: AdminRole | null, platform?: TicketPlatformId): Promise<PlatformDiscoveryRun[]> {
    assertCanDiscover(role);
    return this.repository.listRuns(platform);
  }

  async getReport(role: AdminRole | null, runId: string): Promise<PlatformDiscoveryReport | null> {
    assertCanDiscover(role);
    const run = await this.repository.getRunById(runId);
    if (!run) {
      return null;
    }
    const candidates = await this.repository.listCandidatesByRun(runId);
    return { run, candidates };
  }
}
