import type { Event } from '../types/event';
import type { EventStatus } from '../types/event-status';

import type { DeduplicationVerdict } from './deduplicate';
import type { ValidationResult } from './validation-result';

export interface StatusDecision {
  status: EventStatus;
  reason: string;
}

export function decideEventStatus(input: {
  event: Event;
  normalizationErrors: string[];
  validation: ValidationResult;
  deduplicationVerdict: DeduplicationVerdict;
  forceStatus?: EventStatus;
  publishInApp?: boolean;
}): StatusDecision {
  if (input.forceStatus) {
    return { status: input.forceStatus, reason: 'Forced by source metadata' };
  }

  if (input.normalizationErrors.length > 0) {
    return {
      status: 'needs_review',
      reason: `Normalization errors: ${input.normalizationErrors.join(', ')}`,
    };
  }

  if (!input.validation.valid) {
    return {
      status: 'needs_review',
      reason: `Validation errors: ${input.validation.errors.join(', ')}`,
    };
  }

  if (input.deduplicationVerdict === 'confirmed_duplicate') {
    return {
      status: 'rejected',
      reason: 'Confirmed duplicate',
    };
  }

  if (input.deduplicationVerdict === 'possible_duplicate') {
    return {
      status: 'needs_review',
      reason: 'Possible duplicate',
    };
  }

  if (input.publishInApp === false) {
    return {
      status: 'needs_review',
      reason: 'Excluded from app publish set (pipeline test fixture)',
    };
  }

  return {
    status: 'published',
    reason: 'Valid unique event',
  };
}
