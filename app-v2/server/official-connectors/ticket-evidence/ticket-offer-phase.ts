/**
 * Ranks ticket product phases so "current" admission can be selected over stale cheaper tiers.
 */
const EARLY_BIRD_PATTERN = /\bearly\s*bird\b/i;
const FINAL_PHASE_PATTERN = /\b(?:final|finale)\s+phase\b/i;
const BLIND_TICKET_PATTERN = /\bblind\s+ticket\b/i;
const PHASE_NUMBER_PATTERN = /\bphase\s*([0-9]+|[ivx]+)\b/i;
const ROMAN_PHASE_VALUES: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

export interface OfferPhaseMetadata {
  rank: number;
  phaseNumber: number | null;
  label: string;
}

function parsePhaseNumber(token: string): number | null {
  const normalized = token.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }
  return ROMAN_PHASE_VALUES[normalized] ?? null;
}

export function extractOfferPhaseMetadata(label: string, phaseLabel?: string): OfferPhaseMetadata {
  const combined = `${label} ${phaseLabel ?? ''}`.replace(/\s+/g, ' ').trim();
  if (FINAL_PHASE_PATTERN.test(combined)) {
    return { rank: 900, phaseNumber: 99, label: combined };
  }
  if (BLIND_TICKET_PATTERN.test(combined)) {
    return { rank: 50, phaseNumber: 0, label: combined };
  }
  if (EARLY_BIRD_PATTERN.test(combined)) {
    return { rank: 100, phaseNumber: 0, label: combined };
  }
  const phaseMatch = combined.match(PHASE_NUMBER_PATTERN);
  if (phaseMatch?.[1]) {
    const phaseNumber = parsePhaseNumber(phaseMatch[1]);
    if (phaseNumber != null) {
      return { rank: 200 + phaseNumber * 10, phaseNumber, label: combined };
    }
  }
  return { rank: 150, phaseNumber: null, label: combined };
}

export function compareCurrentAdmissionPhaseRank(leftLabel: string, rightLabel: string, leftPhase?: string, rightPhase?: string): number {
  const left = extractOfferPhaseMetadata(leftLabel, leftPhase);
  const right = extractOfferPhaseMetadata(rightLabel, rightPhase);
  if (right.rank !== left.rank) {
    return right.rank - left.rank;
  }
  const leftPhaseNumber = left.phaseNumber ?? -1;
  const rightPhaseNumber = right.phaseNumber ?? -1;
  if (rightPhaseNumber !== leftPhaseNumber) {
    return rightPhaseNumber - leftPhaseNumber;
  }
  return 0;
}
