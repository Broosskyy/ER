import { normalizeCanonicalEventDescription } from '@/features/import/domain/canonical-description-normalizer';
import { isPlaceholderEventText } from '@/features/events/formatting/canonical-event-projection';

/**
 * Safe public description normalization for detail rendering.
 * Delegates to the canonical import/publish normalizer for consistency.
 */
export function normalizePublicEventDescription(value: string | undefined | null): string | undefined {
  if (!value || isPlaceholderEventText(value)) {
    return undefined;
  }
  return normalizeCanonicalEventDescription(value);
}
