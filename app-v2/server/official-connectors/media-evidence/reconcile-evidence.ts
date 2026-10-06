import { normalizeOfficialGenreLabels } from '../shared/normalize-genre';
import {
  canonicalActKey,
  inferLineupEvidenceRole,
  preferDisplayName,
  sanitizeFinalLineupCandidates,
  validateOfficialLineupAct,
  type LineupValidationContext,
} from '../shared/lineup-normalization';
import { applyMediaBillingOrder } from '../shared/media-billing-order';
import {
  classifyGenreEvidenceGaps,
  replaceLegacyGenreGaps,
} from '../shared/genre-gap-classification';
import {
  extractVerifiedTitleLineupCandidates,
  mergeTitleLineupCandidates,
} from '../shared/title-lineup-evidence';
import { buildMediaEvidenceContextFromEvidence, type MediaEvidenceContext } from '../shared/media-evidence-context';
import { parseDescriptionExplicitGenres } from '../shared/parse-description-genres';
import type {
  OfficialEventEvidence,
  OfficialLineupCandidate,
  RejectedOfficialCandidate,
} from '../types';
import type { EventMediaEvidence } from './types';

function withoutGap(gaps: string[], gapPrefix: string): string[] {
  return gaps.filter((gap) => !gap.startsWith(gapPrefix));
}

function applyClassifiedGenreGaps(
  enrichmentGaps: string[],
  explicitGenreLabels: string[],
  textEvidence: OfficialEventEvidence,
  mediaEvidence?: EventMediaEvidence,
): string[] {
  const withoutLegacy = replaceLegacyGenreGaps(enrichmentGaps);
  if (explicitGenreLabels.length > 0) {
    return withoutLegacy;
  }

  const classified = classifyGenreEvidenceGaps(
    {
      ...textEvidence,
      explicitGenreLabels,
      enrichmentGaps: withoutLegacy,
    },
    mediaEvidence,
  );
  return [...withoutLegacy, ...classified];
}

export interface ReconciledOfficialEvidence {
  evidence: OfficialEventEvidence;
  rejectedCandidates: RejectedOfficialCandidate[];
  conflicts: string[];
}

export interface ReconcileOfficialEvidenceOptions {
  mediaContext?: MediaEvidenceContext;
  validationContext?: LineupValidationContext;
}

function finalizeLineupEvidence(
  textEvidence: OfficialEventEvidence,
  lineupCandidates: OfficialLineupCandidate[],
  rejectedCandidates: RejectedOfficialCandidate[],
  validationContext: LineupValidationContext,
  mediaEvidence?: EventMediaEvidence,
): {
  lineupCandidates: OfficialLineupCandidate[];
  rejectedCandidates: RejectedOfficialCandidate[];
} {
  const titleEvidence = extractVerifiedTitleLineupCandidates({
    eventTitle: textEvidence.title,
    organizerLabel: textEvidence.organizerLabel,
    validationContext,
  });

  const merged = mergeTitleLineupCandidates(lineupCandidates, titleEvidence.candidates);
  rejectedCandidates.push(...titleEvidence.rejectedCandidates);

  const sanitized = sanitizeFinalLineupCandidates(merged, {
    eventTitle: textEvidence.title,
    validationContext,
    showTitleFragmentKeys: titleEvidence.showTitleFragmentKeys,
  });

  return {
    lineupCandidates: applyMediaBillingOrder(
      sanitized.lineupCandidates,
      mediaEvidence,
    ),
    rejectedCandidates: [...rejectedCandidates, ...sanitized.rejectedCandidates],
  };
}

export function reconcileOfficialAndMediaEvidence(
  textEvidence: OfficialEventEvidence,
  mediaEvidence: EventMediaEvidence | undefined,
  options: ReconcileOfficialEvidenceOptions = {},
): ReconciledOfficialEvidence {
  const rejectedCandidates = [...textEvidence.rejectedCandidates];
  const conflicts: string[] = [];
  let enrichmentGaps = [...textEvidence.enrichmentGaps];
  let lineupCandidates = [...textEvidence.lineupCandidates];
  let explicitGenreLabels = [...textEvidence.explicitGenreLabels];

  const mediaContext =
    options.mediaContext ??
    buildMediaEvidenceContextFromEvidence({
      venueName: textEvidence.venue?.name,
      organizerLabel: textEvidence.organizerLabel,
      city: textEvidence.venue?.city,
      officialUrl: textEvidence.officialUrl,
      officialImageUrl: textEvidence.officialImageUrl,
    });
  const validationContext: LineupValidationContext = {
    mediaContext,
    knownGenreLabels: textEvidence.explicitGenreLabels,
    ...options.validationContext,
  };

  if (!mediaEvidence) {
    const finalized = finalizeLineupEvidence(
      textEvidence,
      lineupCandidates,
      rejectedCandidates,
      validationContext,
    );
    return {
      evidence: {
        ...textEvidence,
        lineupCandidates: finalized.lineupCandidates,
        rejectedCandidates: finalized.rejectedCandidates,
        enrichmentGaps: applyClassifiedGenreGaps(
          textEvidence.enrichmentGaps,
          textEvidence.explicitGenreLabels,
          textEvidence,
        ),
      },
      rejectedCandidates: finalized.rejectedCandidates,
      conflicts,
    };
  }

  if (mediaEvidence.mediaClassification === 'unreadable') {
    if (!enrichmentGaps.includes('media_ocr_unreadable')) {
      enrichmentGaps.push('media_ocr_unreadable');
    }
    const finalized = finalizeLineupEvidence(
      textEvidence,
      lineupCandidates,
      rejectedCandidates,
      validationContext,
    );
    return {
      evidence: {
        ...textEvidence,
        lineupCandidates: finalized.lineupCandidates,
        enrichmentGaps: applyClassifiedGenreGaps(enrichmentGaps, explicitGenreLabels, textEvidence, mediaEvidence),
        rejectedCandidates: finalized.rejectedCandidates,
        evidenceAudit: {
          lineupBlocks: textEvidence.evidenceAudit?.lineupBlocks ?? [],
          normalizedGenres: textEvidence.evidenceAudit?.normalizedGenres ?? [],
          unmappedGenreLabels: textEvidence.evidenceAudit?.unmappedGenreLabels ?? [],
          mediaEvidence,
        },
      },
      rejectedCandidates: finalized.rejectedCandidates,
      conflicts,
    };
  }

  const textActKeys = new Map(
    lineupCandidates.map((act) => [canonicalActKey(act.displayName), act] as const),
  );
  const mediaActsToAppend: OfficialLineupCandidate[] = [];

  for (const mediaAct of mediaEvidence.lineupCandidates) {
    const key = canonicalActKey(mediaAct.displayName);
    const existing = textActKeys.get(key);
    if (existing) {
      const preferred = preferDisplayName(existing.displayName, mediaAct.displayName);
      lineupCandidates = lineupCandidates.map((act) =>
        canonicalActKey(act.displayName) === key
          ? {
              ...act,
              displayName: preferred,
              evidenceOrigin: 'official_media',
            }
          : act,
      );
      continue;
    }

    const fuzzyConflict = lineupCandidates.find((act) => {
      const actKey = canonicalActKey(act.displayName);
      return actKey.includes(key) || key.includes(actKey);
    });
    if (fuzzyConflict && fuzzyConflict.displayName !== mediaAct.displayName) {
      conflicts.push(`lineup_evidence_conflict:${mediaAct.displayName}`);
      rejectedCandidates.push({
        rawText: mediaAct.rawText,
        reason: 'lineup_evidence_conflict',
      });
      continue;
    }

    const mediaValidation = validateOfficialLineupAct(
      mediaAct.rawText,
      'official_media',
      validationContext,
    );
    if (!mediaValidation.accepted) {
      rejectedCandidates.push({
        rawText: mediaAct.rawText,
        reason: mediaValidation.reason ?? 'invalid_media_lineup_entry',
      });
      continue;
    }

    mediaActsToAppend.push({
      displayName: mediaAct.displayName,
      rawText: mediaAct.rawText,
      billingOrder: lineupCandidates.length + mediaActsToAppend.length,
      evidenceRole: mediaAct.evidenceRole ?? inferLineupEvidenceRole(mediaAct.displayName, lineupCandidates.length),
      evidenceOrigin: 'official_media',
    });
  }

  if (conflicts.length > 0) {
    for (const mediaAct of mediaActsToAppend) {
      rejectedCandidates.push({
        rawText: mediaAct.rawText,
        reason: 'lineup_media_ambiguous',
      });
    }
    mediaActsToAppend.length = 0;
  }

  lineupCandidates = [
    ...lineupCandidates.map((act, index) => ({ ...act, billingOrder: index })),
    ...mediaActsToAppend.map((act, offset) => ({
      ...act,
      billingOrder: lineupCandidates.length + offset,
    })),
  ];

  const textGenreKeys = new Set(
    normalizeOfficialGenreLabels(explicitGenreLabels).normalized.map((entry) => entry.genreKey),
  );
  const descriptionGenreLabels = parseDescriptionExplicitGenres(
    textEvidence.descriptionClean ?? textEvidence.descriptionRaw,
  );
  if (descriptionGenreLabels.length === 0) {
    for (const mediaGenre of mediaEvidence.genreCandidates) {
      if (!mediaGenre.normalizedLabel) {
        continue;
      }
      const normalized = normalizeOfficialGenreLabels([mediaGenre.rawLabel]).normalized[0];
      if (!normalized || textGenreKeys.has(normalized.genreKey)) {
        continue;
      }
      textGenreKeys.add(normalized.genreKey);
      explicitGenreLabels.push(normalized.displayName);
    }
  }

  if (lineupCandidates.length > 0) {
    enrichmentGaps = withoutGap(enrichmentGaps, 'lineup_media_required');
    enrichmentGaps = withoutGap(enrichmentGaps, 'lineup_not_announced');
  }

  if (mediaEvidence.genreCandidates.length > 0) {
    enrichmentGaps = withoutGap(enrichmentGaps, 'genres_media_required');
  }

  if (conflicts.length > 0 && !enrichmentGaps.includes('lineup_media_ambiguous')) {
    enrichmentGaps.push('lineup_media_ambiguous');
  }

  for (const rejected of mediaEvidence.rejectedCandidates) {
    rejectedCandidates.push({
      rawText: rejected.rawText,
      reason: `media_${rejected.reason}`,
    });
  }

  const finalized = finalizeLineupEvidence(
    textEvidence,
    lineupCandidates,
    rejectedCandidates,
    validationContext,
    mediaEvidence,
  );

  if (finalized.lineupCandidates.length > 0) {
    enrichmentGaps = withoutGap(enrichmentGaps, 'lineup_media_required');
    enrichmentGaps = withoutGap(enrichmentGaps, 'lineup_not_announced');
  }

  return {
    evidence: {
      ...textEvidence,
      lineupCandidates: finalized.lineupCandidates,
      explicitGenreLabels,
      enrichmentGaps: applyClassifiedGenreGaps(enrichmentGaps, explicitGenreLabels, textEvidence, mediaEvidence),
      rejectedCandidates: finalized.rejectedCandidates,
      evidenceAudit: {
        lineupBlocks: textEvidence.evidenceAudit?.lineupBlocks ?? [],
        normalizedGenres:
          textEvidence.evidenceAudit?.normalizedGenres ??
          normalizeOfficialGenreLabels(explicitGenreLabels).normalized.map((entry) => ({
            rawLabel: entry.rawLabel,
            genreKey: entry.genreKey,
            displayName: entry.displayName,
            status: entry.status,
          })),
        unmappedGenreLabels: textEvidence.evidenceAudit?.unmappedGenreLabels ?? [],
        mediaEvidence,
      },
    },
    rejectedCandidates: finalized.rejectedCandidates,
    conflicts,
  };
}
