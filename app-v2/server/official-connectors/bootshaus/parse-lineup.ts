import type { OfficialLineupCandidate, RejectedOfficialCandidate } from '../types';
import { isBoilerplateParagraph, isFloorHeader } from './parse-description';

const INVALID_LINEUP_PATTERNS = [
  /^tickets?$/i,
  /^and more$/i,
  /^tba$/i,
  /^bootshaus$/i,
  /^auenweg/i,
  /^https?:\/\//i,
  /ticket\.io/i,
];

function inferEvidenceRole(displayName: string, billingOrder: number): OfficialLineupCandidate['evidenceRole'] {
  if (displayName.includes('&') || /\bx\b/i.test(displayName) || /\bb2b\b/i.test(displayName) || /\bvs\.?\b/i.test(displayName)) {
    return 'compound_act';
  }

  return billingOrder === 0 ? 'headliner' : 'artist';
}

function normalizeLineupName(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function parseBootshausLineupParagraphs(paragraphs: string[]): {
  lineupCandidates: OfficialLineupCandidate[];
  rejectedCandidates: RejectedOfficialCandidate[];
} {
  const lineupCandidates: OfficialLineupCandidate[] = [];
  const rejectedCandidates: RejectedOfficialCandidate[] = [];
  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    const rawText = normalizeLineupName(paragraph);
    if (!rawText) {
      continue;
    }

    if (isFloorHeader(rawText) || isBoilerplateParagraph(rawText)) {
      rejectedCandidates.push({ rawText, reason: 'floor_or_boilerplate' });
      continue;
    }

    if (INVALID_LINEUP_PATTERNS.some((pattern) => pattern.test(rawText))) {
      rejectedCandidates.push({ rawText, reason: 'invalid_lineup_entry' });
      continue;
    }

    const dedupeKey = rawText.toLowerCase();
    if (seen.has(dedupeKey)) {
      rejectedCandidates.push({ rawText, reason: 'duplicate_lineup_entry' });
      continue;
    }

    seen.add(dedupeKey);
    const billingOrder = lineupCandidates.length;
    lineupCandidates.push({
      displayName: rawText,
      rawText,
      billingOrder,
      evidenceRole: inferEvidenceRole(rawText, billingOrder),
      evidenceOrigin: 'official_text',
    });
  }

  return { lineupCandidates, rejectedCandidates };
}
