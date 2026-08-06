/**
 * Phase 4.6.5 — Generic publish quality gate.
 * Publishing must never reduce canonical quality.
 */

import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';
import { getSourceFieldOwnership } from '@/features/events/domain/source-field-ownership-matrix';
import {
  shouldRejectBlockedOriginOverwrite,
  type DetailFetchBlockReason,
} from '@/features/events/domain/blocked-origin-guard';
import {
  classifyTicketUrl,
  resolveBetterTicketUrl,
} from '@/features/events/domain/ticket-url-quality';
import type { SourcePriorityTier } from '@/features/events/domain/field-ownership-policy';

export type PublishQualityRejectReason =
  | 'empty_overwrites_populated'
  | 'shorter_description_weaker_evidence'
  | 'fewer_genres'
  | 'worse_ticket_url'
  | 'never_downgrade_rule'
  | 'blocked_origin_clear'
  | 'parser_failure_clear'
  | DetailFetchBlockReason;

export interface PublishQualityGateInput {
  field: string;
  existingValue: unknown;
  incomingValue: unknown;
  incomingTier: SourcePriorityTier;
  existingTier?: SourcePriorityTier;
  isEnrichment: boolean;
  sourceMetadata?: Record<string, unknown>;
  parserFailed?: boolean;
}

export interface PublishQualityGateResult {
  allowed: boolean;
  reason?: PublishQualityRejectReason;
  detail?: string;
}

function countArrayItems(value: unknown): number {
  return Array.isArray(value) ? value.filter(hasMeaningfulEventValue).length : 0;
}

function descriptionLength(value: unknown): number {
  return typeof value === 'string' ? value.trim().length : 0;
}

function tierRank(tier: SourcePriorityTier | undefined): number {
  const order: SourcePriorityTier[] = [
    'official_organizer',
    'official_venue',
    'official_festival',
    'promoter',
    'specialized_platform',
    'ticket_platform',
    'aggregator',
    'community',
  ];
  if (!tier) {
    return order.length;
  }
  const index = order.indexOf(tier);
  return index === -1 ? order.length : index;
}

export function evaluatePublishQualityGate(input: PublishQualityGateInput): PublishQualityGateResult {
  const hasExisting = hasMeaningfulEventValue(input.existingValue);
  const hasIncoming = hasMeaningfulEventValue(input.incomingValue);

  if (hasExisting && !hasIncoming) {
    return {
      allowed: false,
      reason: 'empty_overwrites_populated',
      detail: `${input.field}: populated canonical would be cleared`,
    };
  }

  if (input.parserFailed && !hasIncoming && hasExisting) {
    return {
      allowed: false,
      reason: 'parser_failure_clear',
      detail: `${input.field}: parser failure must not clear data`,
    };
  }

  const blocked = shouldRejectBlockedOriginOverwrite({
    field: input.field,
    existingValue: input.existingValue,
    incomingValue: input.incomingValue,
    metadata: input.sourceMetadata,
    isEnrichment: input.isEnrichment,
  });
  if (blocked.reject) {
    return {
      allowed: false,
      reason: 'blocked_origin_clear',
      detail: blocked.reason,
    };
  }

  const ownership = getSourceFieldOwnership(input.field);
  if (ownership?.mergeRule === 'never_downgrade' && hasExisting && !hasIncoming) {
    return {
      allowed: false,
      reason: 'never_downgrade_rule',
      detail: ownership.notes,
    };
  }

  if (input.field === 'description' && hasExisting && hasIncoming) {
    const existingLen = descriptionLength(input.existingValue);
    const incomingLen = descriptionLength(input.incomingValue);
    const incomingStronger = tierRank(input.incomingTier) < tierRank(input.existingTier);
    if (incomingLen < existingLen * 0.6 && !incomingStronger) {
      return {
        allowed: false,
        reason: 'shorter_description_weaker_evidence',
        detail: `incoming ${incomingLen} chars vs existing ${existingLen}`,
      };
    }
  }

  if (input.field === 'genreLabels' && hasExisting && hasIncoming) {
    const existingCount = countArrayItems(input.existingValue);
    const incomingCount = countArrayItems(input.incomingValue);
    if (incomingCount < existingCount) {
      return {
        allowed: false,
        reason: 'fewer_genres',
        detail: `${incomingCount} < ${existingCount}`,
      };
    }
  }

  if (input.field === 'ticketUrl' && hasExisting && hasIncoming) {
    const resolution = resolveBetterTicketUrl(
      String(input.existingValue),
      String(input.incomingValue),
    );
    if (resolution.decision !== 'accepted_incoming' && resolution.decision !== 'filled_empty') {
      const existingClass = classifyTicketUrl(String(input.existingValue));
      const incomingClass = classifyTicketUrl(String(input.incomingValue));
      if (incomingClass.score < existingClass.score) {
        return {
          allowed: false,
          reason: 'worse_ticket_url',
          detail: resolution.reason,
        };
      }
    }
  }

  return { allowed: true };
}

export interface PublishQualityGateLogEntry {
  field: string;
  allowed: boolean;
  reason?: PublishQualityRejectReason;
  detail?: string;
  existingPreview?: string;
  incomingPreview?: string;
}

export function summarizeQualityGateResults(
  results: PublishQualityGateLogEntry[],
): { accepted: number; rejected: number; byReason: Record<string, number> } {
  const byReason: Record<string, number> = {};
  let rejected = 0;
  for (const entry of results) {
    if (!entry.allowed) {
      rejected += 1;
      const key = entry.reason ?? 'unknown';
      byReason[key] = (byReason[key] ?? 0) + 1;
    }
  }
  return { accepted: results.length - rejected, rejected, byReason };
}
