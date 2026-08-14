import { normalizeOfficialGenreLabels } from '../bootshaus/normalize-genre';
import type {
  OfficialEventEvidence,
  OfficialLineupCandidate,
  RejectedOfficialCandidate,
} from '../types';
import type { EventMediaEvidence } from './types';

function canonicalActKey(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function preferDisplayName(current: string, next: string): string {
  const currentHasUpper = /[A-Z]/.test(current);
  const nextHasUpper = /[A-Z]/.test(next);
  if (nextHasUpper && !currentHasUpper) {
    return next;
  }
  if (current.length >= next.length) {
    return current;
  }
  return next;
}

function inferEvidenceRole(
  displayName: string,
  billingOrder: number,
): OfficialLineupCandidate['evidenceRole'] {
  if (
    displayName.includes('&') ||
    /\bx\b/i.test(displayName) ||
    /\bb2b\b/i.test(displayName) ||
    /\bvs\.?\b/i.test(displayName)
  ) {
    return 'compound_act';
  }
  return billingOrder === 0 ? 'headliner' : 'artist';
}

function withoutGap(gaps: string[], gapPrefix: string): string[] {
  return gaps.filter((gap) => !gap.startsWith(gapPrefix));
}

export interface ReconciledOfficialEvidence {
  evidence: OfficialEventEvidence;
  rejectedCandidates: RejectedOfficialCandidate[];
  conflicts: string[];
}

export function reconcileOfficialAndMediaEvidence(
  textEvidence: OfficialEventEvidence,
  mediaEvidence: EventMediaEvidence | undefined,
): ReconciledOfficialEvidence {
  const rejectedCandidates = [...textEvidence.rejectedCandidates];
  const conflicts: string[] = [];
  let enrichmentGaps = [...textEvidence.enrichmentGaps];
  let lineupCandidates = [...textEvidence.lineupCandidates];
  let explicitGenreLabels = [...textEvidence.explicitGenreLabels];

  if (!mediaEvidence) {
    return { evidence: textEvidence, rejectedCandidates, conflicts };
  }

  if (mediaEvidence.mediaClassification === 'unreadable') {
    if (!enrichmentGaps.includes('media_ocr_unreadable')) {
      enrichmentGaps.push('media_ocr_unreadable');
    }
    return {
      evidence: {
        ...textEvidence,
        enrichmentGaps,
        evidenceAudit: {
          lineupBlocks: textEvidence.evidenceAudit?.lineupBlocks ?? [],
          normalizedGenres: textEvidence.evidenceAudit?.normalizedGenres ?? [],
          unmappedGenreLabels: textEvidence.evidenceAudit?.unmappedGenreLabels ?? [],
          mediaEvidence,
        },
      },
      rejectedCandidates,
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
      if (preferred !== existing.displayName) {
        lineupCandidates = lineupCandidates.map((act) =>
          canonicalActKey(act.displayName) === key ? { ...act, displayName: preferred } : act,
        );
      }
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

    mediaActsToAppend.push({
      displayName: mediaAct.displayName,
      rawText: mediaAct.rawText,
      billingOrder: lineupCandidates.length + mediaActsToAppend.length,
      evidenceRole: mediaAct.evidenceRole ?? inferEvidenceRole(mediaAct.displayName, lineupCandidates.length),
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

  return {
    evidence: {
      ...textEvidence,
      lineupCandidates,
      explicitGenreLabels,
      enrichmentGaps,
      rejectedCandidates,
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
    rejectedCandidates,
    conflicts,
  };
}
