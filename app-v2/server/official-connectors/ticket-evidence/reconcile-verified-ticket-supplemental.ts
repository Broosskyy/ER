import type { OfficialEventEvidence } from '../types';
import type { VerifiedTicketCompleteResult } from './ticket-audit-metrics';
import {
  inferLineupEvidenceRole,
  isOcrFlyerNoiseLine,
  sanitizeFinalLineupCandidates,
  validateOfficialLineupAct,
  type LineupValidationContext,
} from '../shared/lineup-normalization';
import { buildMediaEvidenceContextFromEvidence } from '../shared/media-evidence-context';
import { extractLineupFromTicketKingsDescription } from './parse-ticket-kings-detail-dom';
import { normalizedGenresToExplicitLabels, normalizeOfficialGenreLabels } from '../shared/normalize-genre';

function identityAllowsSupplementalMerge(result: VerifiedTicketCompleteResult): boolean {
  return result.identityResult === 'ticket_identity_verified';
}

export function reconcileVerifiedTicketSupplementalEvidence(
  evidence: OfficialEventEvidence,
  ticketResult: VerifiedTicketCompleteResult | undefined,
): OfficialEventEvidence {
  if (!ticketResult || !identityAllowsSupplementalMerge(ticketResult)) {
    return evidence;
  }

  const supplemental = ticketResult.providerEvidence?.supplementalContent;
  const providerDescription =
    supplemental?.descriptionClean ?? ticketResult.providerEvidence?.event.description;
  const enrichmentGaps = [...evidence.enrichmentGaps];
  let descriptionClean = evidence.descriptionClean;
  let descriptionRaw = evidence.descriptionRaw;

  if (!descriptionClean && providerDescription && providerDescription.length >= 40) {
    descriptionClean = providerDescription;
    descriptionRaw = providerDescription;
    const gapIndex = enrichmentGaps.indexOf('description_missing');
    if (gapIndex >= 0) {
      enrichmentGaps.splice(gapIndex, 1);
    }
  } else if (
    providerDescription &&
    /line[- ]?up/i.test(providerDescription) &&
    (!descriptionClean || !/line[- ]?up/i.test(descriptionClean))
  ) {
    descriptionClean = providerDescription;
    descriptionRaw = providerDescription;
  }

  let lineupCandidates = [...evidence.lineupCandidates];
  const rejectedCandidates = [...evidence.rejectedCandidates];
  const validationContext: LineupValidationContext = {
    mediaContext: buildMediaEvidenceContextFromEvidence({
      venueName: evidence.venue?.name,
      organizerLabel: evidence.organizerLabel,
      city: evidence.venue?.city,
      officialUrl: evidence.officialUrl,
      officialImageUrl: evidence.officialImageUrl,
    }),
    eventTitle: evidence.title,
  };

  const supplementalLineup = [
    ...(supplemental?.lineupCandidates ?? []),
    ...extractLineupFromTicketKingsDescription(providerDescription),
    ...extractLineupFromTicketKingsDescription(descriptionClean),
  ];

  const mediaOnlyLineup =
    lineupCandidates.length > 0 && lineupCandidates.every((act) => act.evidenceOrigin === 'official_media');
  const mediaLineupLooksNoisy = lineupCandidates.some((act) => isOcrFlyerNoiseLine(act.displayName));
  const allLineupLooksNoisy =
    lineupCandidates.length > 0 && lineupCandidates.every((act) => isOcrFlyerNoiseLine(act.displayName));
  if (supplementalLineup.length > 0 && (allLineupLooksNoisy || (mediaOnlyLineup && mediaLineupLooksNoisy))) {
    for (const act of lineupCandidates) {
      rejectedCandidates.push({ rawText: act.rawText, reason: 'replaced_by_verified_supplemental_lineup' });
    }
    lineupCandidates = [];
  }

  if (supplementalLineup.length > 0) {
    for (const [index, act] of supplementalLineup.entries()) {
      const validation = validateOfficialLineupAct(act.rawText, 'explicit_sentence', validationContext);
      if (!validation.accepted) {
        rejectedCandidates.push({ rawText: act.rawText, reason: validation.reason ?? 'invalid_supplemental_lineup' });
        continue;
      }
      const key = act.displayName.toLowerCase();
      if (lineupCandidates.some((entry) => entry.displayName.toLowerCase() === key)) {
        continue;
      }
      lineupCandidates.push({
        displayName: act.displayName,
        rawText: act.rawText,
        billingOrder: lineupCandidates.length,
        evidenceRole: inferLineupEvidenceRole(act.displayName, lineupCandidates.length),
        evidenceOrigin: 'official_text',
      });
    }
  }

  const sanitized = sanitizeFinalLineupCandidates(lineupCandidates, {
    eventTitle: evidence.title,
    validationContext,
  });
  lineupCandidates = sanitized.lineupCandidates;
  rejectedCandidates.push(...sanitized.rejectedCandidates);

  if (lineupCandidates.length > 0) {
    for (const gap of ['lineup_media_required', 'lineup_not_announced']) {
      const index = enrichmentGaps.indexOf(gap);
      if (index >= 0) {
        enrichmentGaps.splice(index, 1);
      }
    }
  }

  let explicitGenreLabels = [...evidence.explicitGenreLabels];
  const supplementalGenres = supplemental?.genreLabels ?? [];
  if (supplementalGenres.length > 0) {
    const normalized = normalizeOfficialGenreLabels([...explicitGenreLabels, ...supplementalGenres]);
    const mergedLabels = normalizedGenresToExplicitLabels(normalized.normalized);
    if (mergedLabels.length > explicitGenreLabels.length) {
      explicitGenreLabels = mergedLabels;
      for (const gap of ['genres_missing', 'genres_media_required']) {
        const index = enrichmentGaps.indexOf(gap);
        if (index >= 0) {
          enrichmentGaps.splice(index, 1);
        }
      }
    }
  }

  return {
    ...evidence,
    descriptionClean,
    descriptionRaw,
    lineupCandidates,
    explicitGenreLabels,
    enrichmentGaps,
    rejectedCandidates,
  };
}
