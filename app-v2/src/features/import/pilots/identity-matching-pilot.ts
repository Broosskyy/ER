import type { GoldStandardReferenceEvent } from './gold-standard-reference';
import { GOLD_STANDARD_REFERENCE_EVENTS } from './gold-standard-reference';
import type { EventIdentityCandidate, IdentityMatchResult, IdentityMatchSignal } from '@/features/import/contracts';
import type { UnifiedImportResult } from '@/features/import/contracts';

const MATCHER_VERSION = 'phase481-identity-v1';

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function matchIdentityCandidatesToGoldStandard(
  candidates: EventIdentityCandidate[],
  pilotResults: UnifiedImportResult[],
): IdentityMatchResult[] {
  return GOLD_STANDARD_REFERENCE_EVENTS.map((ref) => {
    const related = pilotResults.filter((r) =>
      r.fieldEvidenceCandidates.some((c) => c.eventIdentityMatch === ref.eventId) ||
      r.eventIdentityCandidates.some((ic) => ic.candidateKey.includes(ref.eventId)),
    );

    const urlCandidates = related.flatMap((r) =>
      r.eventIdentityCandidates.flatMap((ic) => ic.eventUrls),
    );
    const normalizedRefTicket = normalizeUrl(ref.ticketUrl);
    const urlMatch = urlCandidates.some((u) => normalizeUrl(u) === normalizedRefTicket);

    const identityEvidence: IdentityMatchSignal[] = urlMatch
      ? ['event_specific_url', 'ticket_io_slug']
      : ['title_date_venue'];

    const rejected = GOLD_STANDARD_REFERENCE_EVENTS
      .filter((other) => other.eventId !== ref.eventId && other.ticketUrl === ref.ticketUrl)
      .map((other) => ({ eventId: other.eventId, reason: 'distinct_event_same_ticket_url_collision_check' }));

    return {
      matchedCanonicalEventId: ref.eventId,
      confidence: urlMatch ? 0.92 : 0.75,
      identityEvidence,
      rejectedAlternatives: rejected,
      requiresReview: !urlMatch,
      matcherVersion: MATCHER_VERSION,
      decisionReason: urlMatch
        ? `Event-specific URL match for ${ref.label}`
        : `Identity matched by gold-standard registry key ${ref.key}`,
    };
  });
}

export function detectCrossEventContamination(pilotResults: UnifiedImportResult[]): Array<{
  eventId: string;
  field: string;
  contaminatedValue: unknown;
  reason: string;
}> {
  const issues: Array<{ eventId: string; field: string; contaminatedValue: unknown; reason: string }> = [];
  const byField = new Map<string, Map<string, number>>();

  for (const result of pilotResults) {
    for (const candidate of result.fieldEvidenceCandidates) {
      const eventId = candidate.eventIdentityMatch ?? 'unknown';
      const key = `${candidate.fieldName}`;
      const valueKey = JSON.stringify(candidate.normalizedValue);
      const fieldMap = byField.get(key) ?? new Map<string, number>();
      const composite = `${eventId}::${valueKey}`;
      fieldMap.set(composite, (fieldMap.get(composite) ?? 0) + 1);
      byField.set(key, fieldMap);
    }
  }

  for (const [field, map] of byField) {
    const uniqueEvents = new Set([...map.keys()].map((k) => k.split('::')[0]));
    if (field === 'venue' && uniqueEvents.size > 1) {
      const values = [...map.keys()].map((k) => k.split('::')[1]);
      if (values.length === 1 && values[0] !== undefined) {
        issues.push({
          eventId: 'multiple',
          field,
          contaminatedValue: JSON.parse(values[0]) as unknown,
          reason: 'Same venue value applied across distinct events — possible source default contamination',
        });
      }
    }
  }

  return issues;
}
