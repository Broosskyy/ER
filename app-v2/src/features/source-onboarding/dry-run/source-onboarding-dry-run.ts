import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { filterElectronicMusicEvents } from '@/features/aggregation/connectors/ticket-platform/electronic-music-scope-filter';
import type { WebsiteDocument } from '@/features/aggregation/connectors/website/types';

import type { SourceDiscoveryResult } from '@/features/source-onboarding/discovery/source-discovery-engine';
import type { SourceOnboardingDryRunReport } from '@/features/source-onboarding/domain/types';

interface DryRunEvent {
  title: string;
  startDate?: string;
  venueName?: string;
  ticketUrl?: string;
  description?: string;
  organizerName?: string;
}

function parseJsonLdEvents(document: WebsiteDocument): DryRunEvent[] {
  const events: DryRunEvent[] = [];
  for (const block of extractJsonLdBlocks(document.html)) {
    for (const node of collectJsonLdNodes(block)) {
      const title = typeof node.name === 'string' ? node.name : undefined;
      const startDate = typeof node.startDate === 'string' ? node.startDate : undefined;
      if (!title || !startDate) {
        continue;
      }
      const location = node.location as Record<string, unknown> | undefined;
      events.push({
        title,
        startDate,
        venueName: location && typeof location.name === 'string' ? location.name : undefined,
        ticketUrl: typeof node.url === 'string' ? node.url : undefined,
        description: typeof node.description === 'string' ? node.description : undefined,
      });
    }
  }
  return events;
}

export function runSourceOnboardingDryRun(input: {
  discovery: SourceDiscoveryResult;
}): SourceOnboardingDryRunReport {
  const document = input.discovery.document;
  const warnings = [...input.discovery.warnings];
  const risks: string[] = [];

  if (!document) {
    return {
      discoveredUrls: 0,
      parsedEvents: 0,
      electronicEvents: 0,
      rejectedEvents: 0,
      completeEvents: 0,
      incompleteEvents: 0,
      possibleDuplicates: 0,
      possibleEnrichments: 0,
      newCandidates: 0,
      parserConfidence: 0,
      warnings: ['No document available for dry run.'],
      risks: ['Discovery document missing.'],
      sampleEvents: [],
    };
  }

  const parsed = parseJsonLdEvents(document);
  const { events: accepted, stats } = filterElectronicMusicEvents(
    parsed.map((event, index) => ({
      externalId: event.ticketUrl ?? `${document.finalUrl}#${index}`,
      title: event.title,
      description: event.description,
      startDate: event.startDate ?? '',
      timezone: 'Europe/Berlin',
      ticketUrl: event.ticketUrl ?? document.finalUrl,
      eventUrl: event.ticketUrl ?? document.finalUrl,
      venueName: event.venueName,
      organizerName: event.organizerName,
      platform: 'ticket_king' as const,
      shopSlug: 'discovery',
    })),
    { requireElectronicSignal: true },
  );

  const completeEvents = accepted.filter(
    (event) => event.title && event.startDate && (event.venueName || event.organizerName),
  );
  const incompleteEvents = accepted.length - completeEvents.length;

  if (input.discovery.confidence < 0.6) {
    risks.push('Low discovery confidence — manual review recommended.');
  }
  if (parsed.length === 0) {
    risks.push('No structured events parsed from sample HTML.');
  }

  return {
    discoveredUrls: 1,
    parsedEvents: parsed.length,
    electronicEvents: stats.accepted,
    rejectedEvents: stats.rejected,
    completeEvents: completeEvents.length,
    incompleteEvents,
    possibleDuplicates: 0,
    possibleEnrichments: 0,
    newCandidates: completeEvents.length,
    parserConfidence: input.discovery.confidence,
    warnings,
    risks,
    sampleEvents: accepted.slice(0, 10).map((event) => ({
      title: event.title,
      startDate: event.startDate,
      venueName: event.venueName,
      ticketUrl: event.ticketUrl,
      accepted: true,
    })),
  };
}
