import type { IngestionErrorCategory } from './types';

export interface ClassifiedError {
  category: IngestionErrorCategory;
  message: string;
  retryable: boolean;
}

const RETRYABLE_CATEGORIES = new Set<IngestionErrorCategory>([
  'network_timeout',
  'rate_limited',
  'upstream_5xx',
]);

export function isRetryableErrorCategory(category: IngestionErrorCategory): boolean {
  return RETRYABLE_CATEGORIES.has(category);
}

function matchMessage(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

export function classifyIngestionError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (matchMessage(normalized, [/timeout/, /timed out/, /etimedout/, /econnaborted/])) {
    return { category: 'network_timeout', message, retryable: true };
  }
  if (matchMessage(normalized, [/429/, /rate.?limit/, /too many requests/])) {
    return { category: 'rate_limited', message, retryable: true };
  }
  if (matchMessage(normalized, [/\b5\d{2}\b/, /upstream_5xx/, /bad gateway/, /service unavailable/])) {
    return { category: 'upstream_5xx', message, retryable: true };
  }
  if (matchMessage(normalized, [/econnreset/, /enotfound/, /network/, /fetch failed/])) {
    return { category: 'network_timeout', message, retryable: true };
  }
  if (matchMessage(normalized, [/invalid.?url/, /policy violation/, /disallowed/, /non_https/])) {
    return { category: 'invalid_response', message, retryable: false };
  }
  if (matchMessage(normalized, [/parser/, /parse_/, /invariant/])) {
    return { category: 'parser_degraded', message, retryable: false };
  }
  if (matchMessage(normalized, [/identity_review/, /identity_ambiguous/, /possible_match/])) {
    return { category: 'identity_ambiguous', message, retryable: false };
  }
  if (matchMessage(normalized, [/validation_not_ready/, /validation_rejected/, /rejected/])) {
    return { category: 'validation_rejected', message, retryable: false };
  }
  if (matchMessage(normalized, [/reconciliation_review/, /review_required/])) {
    return { category: 'reconciliation_review', message, retryable: false };
  }
  if (matchMessage(normalized, [/precondition_failed/, /apply_precondition/])) {
    return { category: 'apply_precondition_failed', message, retryable: false };
  }
  if (matchMessage(normalized, [/unexpected_zero_results/, /zero_results/])) {
    return { category: 'unexpected_zero_results', message, retryable: false };
  }
  if (matchMessage(normalized, [/source_disabled/])) {
    return { category: 'source_disabled', message, retryable: false };
  }

  return { category: 'unknown', message, retryable: false };
}
