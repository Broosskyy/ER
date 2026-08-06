import { PHASE481_FIELD_DECISION_RULES } from '@/features/import/contracts';
import type { FieldEvidenceCandidate, UnifiedImportResult } from '@/features/import/contracts';
import { classifyStaleTicketDestination, staleEvidenceCannotWinMerge } from '@/features/import/domain/stale-evidence-policy';

export interface MergeSimulationFieldDecision {
  field: string;
  candidates: Array<{
    sourceId: string;
    sourceRole: string;
    normalizedValue: unknown;
    evidenceType: string;
    originUrl: string;
    confidence: number;
    explicit: boolean;
  }>;
  winner?: {
    sourceId: string;
    normalizedValue: unknown;
    reason: string;
  };
  rejected: Array<{ sourceId: string; reason: string }>;
  reviewRequired: boolean;
  conflict?: string;
}

export interface MergeSimulationResult {
  eventId: string;
  eventKey: string;
  canonicalIdentity: string;
  fieldDecisions: MergeSimulationFieldDecision[];
  contaminationIssues: string[];
}

function explicitRank(candidate: FieldEvidenceCandidate): number {
  return candidate.explicit ? 10 : 0;
}

function roleRank(role: string, field: string): number {
  const rule = PHASE481_FIELD_DECISION_RULES.find((r) => r.field === field || r.field === field.replace('_', ''));
  if (field.includes('ticket') || field === 'consumer_cta' || field === 'official_event_url') {
    if (role === 'ticket_platform') return 8;
    if (role === 'official_website_source') return 7;
    if (role === 'checkout_provider') return 3;
  }
  if (field === 'price' || field === 'ticket_phases') {
    if (role === 'checkout_provider') return 6;
    if (role === 'ticket_platform') return 5;
  }
  if (field === 'venue' || field === 'city' || field === 'address') {
    if (role === 'official_website_source') return 7;
    if (role === 'venue') return 8;
  }
  if (field === 'description' || field === 'flyer' || field === 'gallery' || field === 'lineup') {
    if (role === 'official_website_source') return 8;
    if (role === 'organizer') return 7;
  }
  return rule ? 5 : 1;
}

function isShopRootUrl(url: string): boolean {
  return /ticket\.io\/$|ticket\.io\/\?/i.test(url) || /ticketkings\.de\/event\/$/i.test(url);
}

export function simulateMultiSourceMerge(
  eventId: string,
  eventKey: string,
  pilotResults: UnifiedImportResult[],
): MergeSimulationResult {
  const relevant = pilotResults.filter((r) =>
    r.fieldEvidenceCandidates.some((c) => c.eventIdentityMatch === eventId),
  );

  const byField = new Map<string, FieldEvidenceCandidate[]>();
  for (const result of relevant) {
    for (const candidate of result.fieldEvidenceCandidates) {
      if (candidate.eventIdentityMatch !== eventId) continue;
      const key = String(candidate.fieldName);
      const list = byField.get(key) ?? [];
      list.push(candidate);
      byField.set(key, list);
    }
  }

  const fieldDecisions: MergeSimulationFieldDecision[] = [];
  const contaminationIssues: string[] = [];

  for (const [field, candidates] of byField) {
    const scored = candidates.map((c) => ({
      candidate: c,
      score: c.confidence * 0.5 + explicitRank(c) + roleRank(c.sourceRole, field),
    }));

    // Policy: event-specific URL beats shop root; stale candidates cannot win consumer fields
    if (field.includes('ticket') || field === 'consumer_cta') {
      const verifiedUrl = candidates.find((c) => c.fieldName === 'ticket_destination')?.normalizedValue as string | undefined;
      for (const s of scored) {
        const url = String(s.candidate.normalizedValue ?? '');
        if (isShopRootUrl(url)) s.score -= 20;
        if (s.candidate.sourceRole === 'checkout_provider') s.score -= 5;
        if (s.candidate.fieldName === 'ticket_destination_candidate') {
          const stale = classifyStaleTicketDestination({
            candidateUrl: url,
            verifiedUrl,
            source: 'json_ld_offer',
          });
          if (staleEvidenceCannotWinMerge(stale)) {
            s.score -= stale.mergePenalty;
          }
        }
        if (s.candidate.rejectionReason?.includes('Stale')) s.score -= 30;
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const winner = scored[0];
    const rejected = scored.slice(1).map((s) => ({
      sourceId: s.candidate.sourceId,
      reason: `Lower score (${s.score}) vs winner (${winner?.score})`,
    }));

    const distinctValues = new Set(scored.map((s) => JSON.stringify(s.candidate.normalizedValue)));
    const reviewRequired = distinctValues.size > 1 && (winner?.score ?? 0) < 12;

    fieldDecisions.push({
      field,
      candidates: candidates.map((c) => ({
        sourceId: c.sourceId,
        sourceRole: c.sourceRole,
        normalizedValue: c.normalizedValue,
        evidenceType: c.evidenceType,
        originUrl: c.originUrl,
        confidence: c.confidence,
        explicit: c.explicit,
      })),
      winner: winner
        ? {
            sourceId: winner.candidate.sourceId,
            normalizedValue: winner.candidate.normalizedValue,
            reason: `Score ${winner.score}: ${winner.candidate.inclusionReason}`,
          }
        : undefined,
      rejected,
      reviewRequired,
      conflict: distinctValues.size > 1 ? 'multiple_distinct_values' : undefined,
    });
  }

  // Cross-event contamination check
  const venueCandidates = pilotResults.flatMap((r) => r.fieldEvidenceCandidates.filter((c) => c.fieldName === 'venue'));
  const venueByEvent = new Map<string, string>();
  for (const c of venueCandidates) {
    const eid = c.eventIdentityMatch ?? 'unknown';
    const val = normalizeCompare(c.normalizedValue);
    if (!val) continue;
    if (venueByEvent.has(val) && venueByEvent.get(val) !== eid) {
      contaminationIssues.push(`Venue value "${val}" shared across events ${venueByEvent.get(val)} and ${eid}`);
    }
    venueByEvent.set(val, eid);
  }

  return {
    eventId,
    eventKey,
    canonicalIdentity: eventId,
    fieldDecisions,
    contaminationIssues,
  };
}

function normalizeCompare(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(normalizeCompare).join('|').toLowerCase();
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}
