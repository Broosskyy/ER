import { AppError } from '@/core/errors/app-error';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import { canManageSources } from '@/features/admin/admin-permissions';
import type { SourceRecord } from '@/data/types/records';
import { createTicketIoShopSourceRecord } from '@/features/sources/production/ticket-io-source.core';
import { buildExpandedDiscoveryCorpus } from '@/features/ticket-platform-discovery/discovery/discovery-corpus-expansion';
import {
  discoverTicketIoShops,
  type TicketIoShopCandidate,
} from '@/features/ticket-platform-discovery/discovery/ticket-io-shop-discovery';
import { probeTicketIoShopUrl } from '@/features/ticket-platform-discovery/discovery/ticket-io-probe';
import {
  qualifyTicketIoShop,
  type TicketIoShopQualification,
} from '@/features/ticket-platform-discovery/discovery/ticket-io-shop-qualification';

export interface TicketIoQualifiedShop {
  candidate: TicketIoShopCandidate;
  qualification: TicketIoShopQualification;
  probeWarnings: string[];
}

export interface TicketIoCorpusExpansionReport {
  corpus: Awaited<ReturnType<typeof buildExpandedDiscoveryCorpus>>['sources'];
  discoveredShops: TicketIoQualifiedShop[];
  activatedSources: SourceRecord[];
  skippedShops: Array<{ shopSlug: string; reason: string }>;
  limitations: string[];
}

function assertCanExpand(role: AdminRole | null): void {
  if (!canManageSources(role)) {
    throw new AppError('You do not have permission to expand ticket.io corpus.', { code: 'UNAUTHORIZED' });
  }
}

export class TicketIoCorpusExpansionService {
  constructor(
    private readonly listSources: () => Promise<SourceRecord[]>,
    private readonly collectExpandedCorpus: () => Promise<Awaited<ReturnType<typeof buildExpandedDiscoveryCorpus>>>,
    private readonly saveSource: (record: SourceRecord) => Promise<SourceRecord>,
    private readonly isShopKnown: (shopSlug: string, sources: SourceRecord[]) => boolean,
  ) {}

  async discoverQualifiedShops(role: AdminRole | null): Promise<TicketIoCorpusExpansionReport> {
    assertCanExpand(role);
    const sources = await this.listSources();
    const expanded = await this.collectExpandedCorpus();
    const knownSlugs = sources
      .map((source) => source.sourceConfig?.ticketPlatform?.shopSlug)
      .filter((slug): slug is string => Boolean(slug));

    const shops = await discoverTicketIoShops({
      corpusTexts: expanded.texts,
      knownShopSlugs: knownSlugs,
      maxShops: 30,
      includeSeedShops: true,
      excludeShopSlugs: ['bootshaus-club'],
    });

    const discoveredShops: TicketIoQualifiedShop[] = [];
    for (const shop of shops) {
      const probe = await probeTicketIoShopUrl(shop.listUrl);
      if (!probe) {
        continue;
      }
      discoveredShops.push({
        candidate: shop,
        qualification: qualifyTicketIoShop(probe),
        probeWarnings: probe.warnings,
      });
    }

    return {
      corpus: expanded.sources,
      discoveredShops,
      activatedSources: [],
      skippedShops: [],
      limitations: [
        'ticket.io has no public platform-wide shop directory API.',
        'Discovery combines configured seeds, published event ticket URLs, import record URLs, and source corpus.',
        'Slug enumeration is not performed — only known or discovered URLs are probed.',
        'Bootshaus enrichment source is excluded from auto-activation.',
      ],
    };
  }

  async discoverAndActivateShops(
    role: AdminRole | null,
    options: { minTier?: 'relevant' | 'uncertain'; maxActivations?: number } = {},
  ): Promise<TicketIoCorpusExpansionReport> {
    const report = await this.discoverQualifiedShops(role);
    const sources = await this.listSources();
    const minTier = options.minTier ?? 'relevant';
    const maxActivations = options.maxActivations ?? 10;
    const tierRank = { irrelevant: 0, uncertain: 1, relevant: 2 } as const;

    for (const entry of report.discoveredShops) {
      if (report.activatedSources.length >= maxActivations) {
        break;
      }
      if (tierRank[entry.qualification.tier] < tierRank[minTier]) {
        report.skippedShops.push({
          shopSlug: entry.candidate.shopSlug,
          reason: `Tier ${entry.qualification.tier} below minimum ${minTier}.`,
        });
        continue;
      }
      if (this.isShopKnown(entry.candidate.shopSlug, sources)) {
        report.skippedShops.push({
          shopSlug: entry.candidate.shopSlug,
          reason: 'Source already exists for shop.',
        });
        continue;
      }

      const record = createTicketIoShopSourceRecord({
        shopSlug: entry.candidate.shopSlug,
        listUrl: entry.candidate.listUrl,
        displayName: entry.candidate.shopSlug,
        publishMode: entry.qualification.recommendedPublishBehavior,
        publishBehavior: entry.qualification.recommendedPublishBehavior,
        reviewRequired: entry.qualification.recommendedReviewRequired,
        enabled: true,
        scheduleEnabled: true,
        metadata: {
          corpusExpansion: true,
          qualificationTier: entry.qualification.tier,
          acceptanceRate: entry.qualification.acceptanceRate,
          discoveryEventCount: entry.candidate.eventCount,
        },
      });

      const saved = await this.saveSource({
        ...record,
        enabled: true,
        scheduleEnabled: true,
        schedulePolicy: 'interval',
        scheduleIntervalPreset: 'every_6_hours',
        scheduleTimezone: 'Europe/Berlin',
        pollingIntervalMinutes: 360,
      });
      report.activatedSources.push(saved);
      sources.push(saved);
    }

    return report;
  }
}
