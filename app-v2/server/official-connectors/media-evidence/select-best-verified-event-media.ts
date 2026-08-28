import type { EventMediaCandidate, EventMediaSelectionResult } from './event-media-candidate';
import { isAutoSelectableIdentity } from './event-media-candidate';
import { collectEventMediaCandidates } from './collect-event-media-candidates';
import {
  hasConflictingLineup,
  isUnsafeMediaCandidate,
  rankEventMediaCandidates,
} from './score-event-media-candidate';
import type { OfficialEventEvidence } from '../types';
import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';

function buildSelectionReason(candidate: EventMediaCandidate): string {
  const parts = [
    candidate.sourceType,
    candidate.mediaType,
    candidate.identityConfidence,
    `score=${candidate.score}`,
  ];
  if (candidate.contentSignals.lineupActCount > 0) {
    parts.push(`lineupActs=${candidate.contentSignals.lineupActCount}`);
  }
  if (candidate.contentSignals.lineupOverlapWithVerified > 0) {
    parts.push(`lineupOverlap=${candidate.contentSignals.lineupOverlapWithVerified}`);
  }
  return parts.join(';');
}

export function selectBestVerifiedEventMedia(
  evidence: OfficialEventEvidence,
  ticketResult?: VerifiedTicketCompleteResult,
  existingImageUrl?: string,
): EventMediaSelectionResult {
  const rawCandidates = collectEventMediaCandidates(evidence, ticketResult);
  const ranked = rankEventMediaCandidates(rawCandidates);
  const rejectedCandidates: EventMediaSelectionResult['rejectedCandidates'] = [];

  let selected: EventMediaCandidate | undefined;
  for (const candidate of ranked) {
    if (isUnsafeMediaCandidate(candidate)) {
      rejectedCandidates.push({
        candidateId: candidate.candidateId,
        imageUrl: candidate.imageUrl,
        reason: `unsafe_media_type:${candidate.mediaType}`,
      });
      continue;
    }
    if (!isAutoSelectableIdentity(candidate.identityConfidence)) {
      rejectedCandidates.push({
        candidateId: candidate.candidateId,
        imageUrl: candidate.imageUrl,
        reason: `identity_${candidate.identityConfidence}`,
      });
      continue;
    }
    if (hasConflictingLineup(candidate)) {
      rejectedCandidates.push({
        candidateId: candidate.candidateId,
        imageUrl: candidate.imageUrl,
        reason: 'lineup_conflict_with_verified_evidence',
      });
      continue;
    }
    selected = { ...candidate, selectionReason: buildSelectionReason(candidate) };
    break;
  }

  if (!selected) {
    return {
      candidates: ranked,
      rejectedCandidates,
      retainedExisting: Boolean(existingImageUrl),
      selectionReason: existingImageUrl ? 'retain_existing_no_safe_candidate' : 'no_safe_candidate',
    };
  }

  if (existingImageUrl && existingImageUrl === selected.imageUrl) {
    return {
      selected,
      candidates: ranked,
      rejectedCandidates,
      retainedExisting: true,
      selectionReason: 'existing_image_already_best',
    };
  }

  return {
    selected,
    candidates: ranked,
    rejectedCandidates,
    retainedExisting: false,
    selectionReason: selected.selectionReason ?? 'best_verified_candidate',
  };
}

export function applyEventMediaSelectionToEvidence(
  evidence: OfficialEventEvidence,
  selection: EventMediaSelectionResult,
): OfficialEventEvidence {
  if (!selection.selected || selection.retainedExisting && selection.selectionReason === 'existing_image_already_best') {
    return {
      ...evidence,
      evidenceAudit: {
        ...evidence.evidenceAudit,
        lineupBlocks: evidence.evidenceAudit?.lineupBlocks ?? [],
        normalizedGenres: evidence.evidenceAudit?.normalizedGenres ?? [],
        unmappedGenreLabels: evidence.evidenceAudit?.unmappedGenreLabels ?? [],
        mediaEvidence: evidence.evidenceAudit?.mediaEvidence,
        mediaSelection: selection,
      },
    };
  }

  const selected = selection.selected;
  const selectedMediaEvidence =
    selected.mediaEvidence ??
    (selected.sourceType === 'primary_official' ? evidence.evidenceAudit?.mediaEvidence : undefined);

  return {
    ...evidence,
    officialImageUrl: selected.imageUrl,
    evidenceAudit: {
      ...evidence.evidenceAudit,
      lineupBlocks: evidence.evidenceAudit?.lineupBlocks ?? [],
      normalizedGenres: evidence.evidenceAudit?.normalizedGenres ?? [],
      unmappedGenreLabels: evidence.evidenceAudit?.unmappedGenreLabels ?? [],
      mediaEvidence: selectedMediaEvidence,
      mediaSelection: selection,
    },
  };
}
