import type { ConnectorErrorCounters, OfficialEventConsumerPreview, OfficialEventEvidence } from './types';

function containsBoilerplate(text: string | undefined): boolean {
  if (!text) {
    return false;
  }

  const normalized = text.toLowerCase();
  return (
    normalized.includes('bootshaus mobile app') ||
    normalized.includes('bootshaus merchandise') ||
    normalized.includes('einlass ab 18') ||
    normalized.includes('www.bootshaus.tv')
  );
}

export function buildConsumerPreview(
  evidence: OfficialEventEvidence,
  counters: ConnectorErrorCounters,
): OfficialEventConsumerPreview {
  const reviewReasons: string[] = [];

  if (!evidence.title) {
    reviewReasons.push('missing_title');
  }
  if (!evidence.startsAt) {
    reviewReasons.push('missing_starts_at');
  }
  if (!evidence.pageFingerprint) {
    reviewReasons.push('missing_fingerprint');
  }
  if (!evidence.officialUrl) {
    reviewReasons.push('missing_official_url');
  }
  if (!evidence.venue?.name) {
    reviewReasons.push('missing_venue');
  }
  if (evidence.endsAt && evidence.startsAt && Date.parse(evidence.endsAt) < Date.parse(evidence.startsAt)) {
    reviewReasons.push('end_before_start');
  }
  if (containsBoilerplate(evidence.descriptionClean)) {
    reviewReasons.push('boilerplate_in_description');
    counters.boilerplateInDescriptions += 1;
  }
  if (evidence.enrichmentGaps.includes('lineup_evidence_ambiguous')) {
    reviewReasons.push('lineup_evidence_ambiguous');
  }

  return {
    ...evidence,
    decision: reviewReasons.length === 0 ? 'preview_ready' : 'review_required',
    reviewReasons,
  };
}
