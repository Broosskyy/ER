import type { ConnectorErrorCounters, OfficialEventEvidence } from '../types';
import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';
import { processOfficialEventTickets } from '../ticket-evidence/ticket-evidence-pipeline';
import { reconcileVerifiedTicketSupplementalEvidence } from '../ticket-evidence/reconcile-verified-ticket-supplemental';
import type { MediaEvidenceContext } from '../shared/media-evidence-context';
import { buildImageHostAllowlist } from './safe-image-fetch';
import { enrichOfficialEvidenceWithMedia, enrichVerifiedTicketProviderMediaImage } from './enrich-official-evidence';
import { reconcileEventMediaEvidence } from './reconcile-event-media-evidence';
import type { MediaPassCounters } from './types';

export interface FinalizeOfficialEventEvidenceInput {
  evidence: OfficialEventEvidence;
  prefetchedHtml: string;
  fetchedAt: string;
  counters: ConnectorErrorCounters;
  mediaCounters: MediaPassCounters;
  allowedImageHosts: Set<string>;
  buildMediaContext: (evidence: OfficialEventEvidence) => MediaEvidenceContext;
  processTickets?: boolean;
}

export interface FinalizeOfficialEventEvidenceResult {
  evidence: OfficialEventEvidence;
  ticketResult?: VerifiedTicketCompleteResult;
}

export async function finalizeOfficialEventEvidence(
  input: FinalizeOfficialEventEvidenceInput,
): Promise<FinalizeOfficialEventEvidenceResult> {
  const skipPast = input.evidence.enrichmentGaps.includes('past_event_skipped');
  let evidence = input.evidence;

  if (evidence.officialImageUrl && !skipPast) {
    for (const host of buildImageHostAllowlist([evidence.officialImageUrl])) {
      input.allowedImageHosts.add(host);
    }
    evidence = await enrichOfficialEvidenceWithMedia(evidence, {
      counters: input.counters,
      mediaCounters: input.mediaCounters,
      allowedImageHosts: input.allowedImageHosts,
      sourceObservedAt: input.fetchedAt,
      mediaContext: input.buildMediaContext(evidence),
    });
  }

  let ticketResult: VerifiedTicketCompleteResult | undefined;
  if (input.processTickets && !skipPast) {
    ticketResult = await processOfficialEventTickets(
      {
        sourceEventKey: evidence.sourceEventKey,
        officialUrl: evidence.officialUrl,
        title: evidence.title,
        startsAt: evidence.startsAt,
        endsAt: evidence.endsAt,
        venueName: evidence.venue?.name,
        organizerName: evidence.organizerLabel,
      },
      {
        prefetchedHtml: input.prefetchedHtml,
        observedAt: input.fetchedAt,
      },
    );
  }

  const withSupplemental = reconcileVerifiedTicketSupplementalEvidence(evidence, ticketResult);

  if (ticketResult?.providerEvidence?.event.imageUrl && !skipPast) {
    for (const host of buildImageHostAllowlist([ticketResult.providerEvidence.event.imageUrl])) {
      input.allowedImageHosts.add(host);
    }
    await enrichVerifiedTicketProviderMediaImage(withSupplemental, ticketResult, {
      counters: input.counters,
      mediaCounters: input.mediaCounters,
      allowedImageHosts: input.allowedImageHosts,
      sourceObservedAt: input.fetchedAt,
      mediaContext: input.buildMediaContext(withSupplemental),
    });
  }

  const withMedia = reconcileEventMediaEvidence(withSupplemental, ticketResult, evidence.officialImageUrl);

  return {
    evidence: withMedia,
    ticketResult,
  };
}
