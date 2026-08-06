import type { PublishMode, PublishPolicyConfig } from '@/features/import/domain/publish-mode';
import { resolvePublishPolicy } from '@/features/import/domain/publish-mode';
import type { SourceRecord } from '@/data/types/records';

/** Configurable publish behaviour — independent of connector platform id. */
export const SOURCE_PUBLISH_BEHAVIORS = [
  'auto_publish',
  'manual_review',
  'enrichment',
  'disabled',
] as const;

export type SourcePublishBehavior = (typeof SOURCE_PUBLISH_BEHAVIORS)[number];

export interface PublishPolicyConfigWithBehavior extends PublishPolicyConfig {
  /** Explicit publish behaviour override (preferred over legacy publishMode inference). */
  behavior?: SourcePublishBehavior;
}

export function isSourcePublishBehavior(value: unknown): value is SourcePublishBehavior {
  return typeof value === 'string' && (SOURCE_PUBLISH_BEHAVIORS as readonly string[]).includes(value);
}

function behaviorFromPublishMode(mode: PublishMode): SourcePublishBehavior {
  switch (mode) {
    case 'auto_publish':
    case 'conditional_review':
      return 'auto_publish';
    case 'manual_review':
    default:
      return 'manual_review';
  }
}

/**
 * Resolves effective publish behaviour from explicit config, descriptor defaults, and legacy fields.
 * Preserves production behaviour when `behavior` is not yet persisted on the source row.
 */
export function resolveSourcePublishBehavior(
  source: Pick<SourceRecord, 'sourceType' | 'publishMode' | 'sourceConfig' | 'sourceRoles' | 'category'>,
): SourcePublishBehavior {
  const explicit = source.sourceConfig?.publishPolicy?.behavior;
  if (isSourcePublishBehavior(explicit)) {
    return explicit;
  }

  const mode = source.publishMode ?? resolvePublishPolicy(source).mode;
  const inferred = behaviorFromPublishMode(mode);

  // Legacy: ticket_platform sources with manual_review were enrichment-only in production.
  if (inferred === 'manual_review' && source.sourceType === 'ticket_platform') {
    return 'enrichment';
  }

  if (inferred === 'manual_review') {
    return 'manual_review';
  }

  return inferred;
}

export function isEnrichmentPublishBehavior(behavior: SourcePublishBehavior): boolean {
  return behavior === 'enrichment';
}

export function isPublishBehaviorDisabled(behavior: SourcePublishBehavior): boolean {
  return behavior === 'disabled';
}

export function shouldReviewBeforePublish(behavior: SourcePublishBehavior): boolean {
  return behavior === 'manual_review' || behavior === 'enrichment';
}

export function isEnrichmentPublish(
  source: Pick<SourceRecord, 'sourceType' | 'publishMode' | 'sourceConfig' | 'sourceRoles' | 'category'>,
  hasExistingCanonicalEvent: boolean,
): boolean {
  return isEnrichmentPublishBehavior(resolveSourcePublishBehavior(source)) && hasExistingCanonicalEvent;
}
