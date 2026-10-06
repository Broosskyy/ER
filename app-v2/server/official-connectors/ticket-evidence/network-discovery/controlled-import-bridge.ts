import { createHash } from 'node:crypto';

import { reconcileEventMediaEvidence } from '../../media-evidence/reconcile-event-media-evidence';
import type { OfficialEventEvidence, OfficialLineupCandidate } from '../../types';
import { processOfficialEventTickets } from '../ticket-evidence-pipeline';
import { reconcileVerifiedTicketSupplementalEvidence } from '../reconcile-verified-ticket-supplemental';
import type { VerifiedTicketCompleteResult } from '../ticket-audit-metrics';
import { classifyEventMediaAcceptability } from './event-media-quality';
import type { DetailFetchResult } from './detail-fetch';
import type { EnrichedTicketIoEvent } from './detail-types';
import { dedupeDescription, qualifyLineup } from './field-evidence';
import type { LiveFirstBatchVerification } from './first-batch-live-verify';
import { TICKET_IO_NETWORK_DISCOVERY_CONNECTOR_ID } from './constants';
import type { EventWritePlan } from '../../../ingestion/types/event-candidate';
import { isPlanIdempotent } from '../../../ingestion/planning/event-write-planner';

export { TICKET_IO_NETWORK_DISCOVERY_CONNECTOR_ID };

export function buildPageFingerprint(
  fetchResult: DetailFetchResult,
  enriched?: EnrichedTicketIoEvent,
): string {
  if (enriched) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          title: enriched.title,
          startsAt: enriched.startsAt,
          endsAt: enriched.endsAt ?? null,
          venueName: enriched.venueName ?? null,
          city: enriched.city ?? null,
          description: enriched.description ?? null,
          lineup: enriched.lineupHints,
          genres: enriched.genreCandidates.map((genre) => genre.label),
          imageUrl: enriched.bestMediaUrl ?? null,
          products: enriched.products.map((product) => ({
            label: product.label,
            amountMinor: product.amountMinor ?? null,
            availability: product.availability,
            selected: product.selectedAsCurrentAdmission,
          })),
        }),
      )
      .digest('hex');
  }
  if (fetchResult.contentFingerprint?.trim()) {
    return fetchResult.contentFingerprint;
  }
  return createHash('sha256').update(fetchResult.html).digest('hex');
}

function buildLineupCandidates(lineup: string[]): OfficialLineupCandidate[] {
  const filtered = lineup
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && !/^(?:early bird|sold out|tickets?|phase \d+)$/i.test(name));
  return filtered.map((name, index) => ({
    displayName: name,
    rawText: name,
    billingOrder: index,
    evidenceRole: index === 0 ? 'headliner' : 'artist',
    evidenceOrigin: 'official_title',
  }));
}

function explicitGenreLabels(enriched: EnrichedTicketIoEvent): string[] {
  return [
    ...new Set(
      enriched.genreCandidates
        .filter((genre) => genre.confidence === 'explicit' || genre.confidence === 'strong_inferred')
        .map((genre) => genre.label.trim())
        .filter(Boolean),
    ),
  ];
}

export function buildOfficialEvidenceFromEnriched(
  enriched: EnrichedTicketIoEvent,
  fetchResult: DetailFetchResult,
  fetchedAt: string,
): OfficialEventEvidence {
  const media = classifyEventMediaAcceptability(enriched.imageUrls, { title: enriched.title });
  const imageUrl = media.bestMediaUrl ?? enriched.bestMediaUrl;
  const description = dedupeDescription(enriched.description);
  const lineup = buildLineupCandidates(enriched.lineupHints);
  const enrichmentGaps: string[] = [];

  if (enriched.lifecycle === 'ENDED') {
    enrichmentGaps.push('past_event_skipped');
  }
  if (!description) {
    enrichmentGaps.push('missing_description');
  }
  if (qualifyLineup(enriched.lineupHints) === 'NO_LINEUP') {
    enrichmentGaps.push('partial_lineup');
  }

  return {
    connectorId: TICKET_IO_NETWORK_DISCOVERY_CONNECTOR_ID,
    sourceEventKey: enriched.identityKey,
    listUrl: enriched.listingUrl,
    officialUrl: enriched.canonicalUrl || enriched.eventUrl,
    fetchedAt,
    pageFingerprint: buildPageFingerprint(fetchResult, enriched),
    title: enriched.title,
    startsAt: enriched.startsAt!,
    endsAt: enriched.endsAt,
    sourceTimezone: 'Europe/Berlin',
    venue: enriched.venueName
      ? {
          name: enriched.venueName,
          address: enriched.address,
          city: enriched.city,
          countryCode: 'DE',
        }
      : undefined,
    organizerLabel: enriched.organizerName,
    descriptionClean: description,
    descriptionRaw: enriched.description,
    officialImageUrl: imageUrl,
    linkedTicketUrl: enriched.eventUrl,
    lineupCandidates: lineup,
    explicitGenreLabels: explicitGenreLabels(enriched),
    enrichmentGaps,
    rejectedCandidates: [],
  };
}

export interface FinalizeControlledImportResult {
  evidence: OfficialEventEvidence;
  ticketResult?: VerifiedTicketCompleteResult;
}

export async function finalizeControlledImportEvidence(
  enriched: EnrichedTicketIoEvent,
  fetchResult: DetailFetchResult,
  fetchedAt: string,
): Promise<FinalizeControlledImportResult> {
  const baseEvidence = buildOfficialEvidenceFromEnriched(enriched, fetchResult, fetchedAt);
  if (baseEvidence.enrichmentGaps.includes('past_event_skipped')) {
    return { evidence: baseEvidence };
  }

  const ticketResult = await processOfficialEventTickets(
    {
      sourceEventKey: baseEvidence.sourceEventKey,
      officialUrl: baseEvidence.officialUrl,
      title: baseEvidence.title,
      startsAt: baseEvidence.startsAt,
      endsAt: baseEvidence.endsAt,
      venueName: baseEvidence.venue?.name,
      organizerName: baseEvidence.organizerLabel,
    },
    {
      prefetchedHtml: fetchResult.html,
      observedAt: fetchedAt,
    },
  );

  const withSupplemental = reconcileVerifiedTicketSupplementalEvidence(baseEvidence, ticketResult);
  const evidence = reconcileEventMediaEvidence(
    withSupplemental,
    ticketResult,
    baseEvidence.officialImageUrl,
  );

  return { evidence, ticketResult };
}

export function isEligibleForControlledImport(
  verification: LiveFirstBatchVerification,
  referenceInstant: Date,
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!verification.liveAccessible) {
    reasons.push('not_live_accessible');
  }
  if (verification.detailAccess !== 'DETAIL_ACCESSIBLE') {
    reasons.push(`detail_access:${verification.detailAccess}`);
  }
  if (verification.uncertainties.includes('event_past_redirect')) {
    reasons.push('event_past_redirect');
  }
  if (verification.ticketAction !== 'PURCHASE') {
    reasons.push(`ticket_action:${verification.ticketAction}`);
  }
  if (verification.currentAdmissionPriceMinor == null) {
    reasons.push('missing_admission_price');
  }
  if (verification.mediaAcceptability !== 'ACCEPTABLE_EVENT_MEDIA') {
    reasons.push(verification.mediaAcceptability);
  }
  if (verification.relevance === 'IRRELEVANT' || verification.relevance === 'AMBIGUOUS') {
    reasons.push(`relevance:${verification.relevance}`);
  }
  if (!verification.title?.trim() || !verification.startsAt || !verification.venueName || !verification.city) {
    reasons.push('missing_core_fields');
  }

  if (verification.startsAt) {
    const startsAt = new Date(verification.startsAt);
    const ended =
      startsAt < referenceInstant &&
      (!verification.products.length || verification.ticketAvailability === 'SOLD_OUT');
    if (ended) {
      reasons.push('event_past');
    }
  }

  return { eligible: reasons.length === 0, reasons };
}

export interface WritePlanReviewIssue {
  identityKey: string;
  severity: 'block' | 'warn';
  code: string;
  detail: string;
}

export function reviewControlledImportWritePlan(plan: EventWritePlan): WritePlanReviewIssue[] {
  const issues: WritePlanReviewIssue[] = [];
  const identityKey = plan.candidate.origin.kind === 'official_connector'
    ? plan.candidate.origin.sourceEventKey
    : 'unknown';

  if (plan.validation.decision === 'rejected') {
    issues.push({
      identityKey,
      severity: 'block',
      code: 'validation_rejected',
      detail: plan.validation.reasons.join(','),
    });
  }

  if (
    plan.identity &&
    (plan.identity.decision === 'possible_match' || plan.identity.decision === 'review_required')
  ) {
    issues.push({
      identityKey,
      severity: 'warn',
      code: `identity_${plan.identity.decision}`,
      detail: plan.identity.reasons.join(','),
    });
  }

  if (plan.reconciliation?.reviewRequired) {
    issues.push({
      identityKey,
      severity: 'warn',
      code: 'reconciliation_review_required',
      detail: plan.reconciliation.reasons.join(','),
    });
  }

  const imageUrl = plan.candidate.imageUrl ?? '';
  if (
    imageUrl &&
    /MAGIC_MOMENT\.jpg|\/companies\/[^/]+\/logo/i.test(imageUrl) &&
    !/holder-|flyer|event/i.test(imageUrl)
  ) {
    issues.push({
      identityKey,
      severity: 'block',
      code: 'generic_media_selected',
      detail: imageUrl,
    });
  }

  return issues;
}

export function summarizeWritePlanMutations(plans: EventWritePlan[]) {
  return plans.reduce(
    (acc, plan) => {
      acc.eventInserts += plan.expectedRowCounts.eventsInserted;
      acc.eventUpdates += plan.expectedRowCounts.eventsUpdated;
      acc.lineupWrites += plan.lineupAction === 'replace' ? plan.expectedRowCounts.lineupInserted : 0;
      acc.genreWrites += plan.genresAction === 'replace' ? plan.expectedRowCounts.genresInserted : 0;
      acc.sourceBindingWrites += plan.expectedRowCounts.sourcesInserted + plan.expectedRowCounts.sourcesUpdated;
      acc.reviewRequiredCount += plan.reconciliation?.reviewRequired ? 1 : 0;
      acc.idempotentPlans += isPlanIdempotent(plan) ? 1 : 0;
      return acc;
    },
    {
      eventInserts: 0,
      eventUpdates: 0,
      lineupWrites: 0,
      genreWrites: 0,
      sourceBindingWrites: 0,
      reviewRequiredCount: 0,
      idempotentPlans: 0,
    },
  );
}
