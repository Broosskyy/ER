import type { EventMediaEvidence } from '../media-evidence/types';
import type { OfficialLineupCandidate } from '../types';
import {
  canonicalActKey,
  inferLineupEvidenceRole,
} from './lineup-normalization';

const ROSTER_DASH_PATTERN = /\s+-\s+/;

function mediaBillingOrderKeys(mediaEvidence: EventMediaEvidence): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const mediaActs = [...mediaEvidence.lineupCandidates]
    .filter((act) => act.sourceRegion !== 'ocr_corroboration')
    .sort((left, right) => (left.billingOrder ?? 0) - (right.billingOrder ?? 0));

  for (const act of mediaActs) {
    const key = canonicalActKey(act.displayName);
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }

  if (ordered.length >= 2) {
    return ordered;
  }

  const hasRosterLines = mediaEvidence.ocrLines.some((line) => ROSTER_DASH_PATTERN.test(line.text));
  if (!hasRosterLines) {
    return ordered;
  }

  const sortedLines = [...mediaEvidence.ocrLines].sort((left, right) => {
    if (left.bbox.y0 !== right.bbox.y0) {
      return left.bbox.y0 - right.bbox.y0;
    }
    return left.bbox.x0 - right.bbox.x0;
  });

  for (const line of sortedLines) {
    const text = line.text.replace(/\s+/g, ' ').trim();
    if (!text) {
      continue;
    }

    const segments = ROSTER_DASH_PATTERN.test(text)
      ? text.split(ROSTER_DASH_PATTERN).map((part) => part.trim()).filter(Boolean)
      : [text];

    for (const segment of segments) {
      const key = canonicalActKey(segment);
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }

  return ordered;
}

export function applyMediaBillingOrder(
  lineupCandidates: OfficialLineupCandidate[],
  mediaEvidence: EventMediaEvidence | undefined,
): OfficialLineupCandidate[] {
  if (!mediaEvidence || lineupCandidates.length === 0) {
    return lineupCandidates;
  }

  const mediaOrderKeys = mediaBillingOrderKeys(mediaEvidence).filter((key) =>
    lineupCandidates.some((act) => canonicalActKey(act.displayName) === key),
  );
  if (mediaOrderKeys.length < 2) {
    return lineupCandidates;
  }

  const lineupKeys = lineupCandidates.map((act) => canonicalActKey(act.displayName));
  const mediaKeySet = new Set(mediaOrderKeys);
  const lineupKeySet = new Set(lineupKeys);
  const sameSet =
    mediaOrderKeys.length === lineupKeys.length &&
    mediaOrderKeys.every((key) => lineupKeySet.has(key)) &&
    lineupKeys.every((key) => mediaKeySet.has(key));

  if (!sameSet) {
    return lineupCandidates;
  }

  const byKey = new Map(
    lineupCandidates.map((act) => [canonicalActKey(act.displayName), act] as const),
  );
  const ordered: OfficialLineupCandidate[] = [];

  for (const key of mediaOrderKeys) {
    const act = byKey.get(key);
    if (act) {
      ordered.push(act);
    }
  }

  for (const act of lineupCandidates) {
    const key = canonicalActKey(act.displayName);
    if (!ordered.some((entry) => canonicalActKey(entry.displayName) === key)) {
      ordered.push(act);
    }
  }

  return ordered.map((act, index) => ({
    ...act,
    billingOrder: index,
    evidenceRole: inferLineupEvidenceRole(act.displayName, index),
  }));
}
