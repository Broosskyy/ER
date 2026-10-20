import type { OfficialEventEvidence } from '../types';

/**
 * Text-parsed official lineup is privileged over OCR-generated alternatives.
 * Never publish OCR-only artist names from a flyer without independent
 * corroboration. The provider/media evidence remains usable for images,
 * verified ticket URLs and prices.
 */
export function restrictBootshausLineupToOfficialText(
  textEvidence: OfficialEventEvidence,
  combinedEvidence: OfficialEventEvidence,
): OfficialEventEvidence {
  const trustedLineup = textEvidence.lineupCandidates;
  const receivedUnverifiedMediaLineup =
    combinedEvidence.lineupCandidates.length > trustedLineup.length ||
    combinedEvidence.lineupCandidates.some((item) =>
      !trustedLineup.some((original) => original.displayName === item.displayName)
    );
  if (!receivedUnverifiedMediaLineup) {
    return combinedEvidence;
  }
  return {
    ...combinedEvidence,
    lineupCandidates: trustedLineup,
    enrichmentGaps: [
      ...new Set([...combinedEvidence.enrichmentGaps, 'media_lineup_requires_independent_verification']),
    ],
  };
}
