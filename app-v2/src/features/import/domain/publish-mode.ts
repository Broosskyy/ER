export const PUBLISH_MODES = ['auto_publish', 'manual_review', 'conditional_review'] as const;

export type PublishMode = (typeof PUBLISH_MODES)[number];

export const DEFAULT_PUBLISH_MODE: PublishMode = 'manual_review';

export interface PublishPolicyConfig {
  mode: PublishMode;
  minTrustScore?: number;
  minExtractionConfidence?: number;
  blockOnDuplicate?: boolean;
}

export const DEFAULT_PUBLISH_POLICY: PublishPolicyConfig = {
  mode: 'manual_review',
  minTrustScore: 70,
  minExtractionConfidence: 0.6,
  blockOnDuplicate: true,
};

export function isPublishMode(value: unknown): value is PublishMode {
  return typeof value === 'string' && (PUBLISH_MODES as readonly string[]).includes(value);
}

export function parsePublishMode(value: unknown, fallback: PublishMode = DEFAULT_PUBLISH_MODE): PublishMode {
  return isPublishMode(value) ? value : fallback;
}

export function resolveReviewRequiredFromPublishMode(publishMode: PublishMode): boolean {
  return publishMode === 'manual_review';
}

export function resolvePublishPolicy(source: {
  publishMode?: PublishMode;
  trustScore?: number;
  sourceConfig?: { publishPolicy?: Partial<PublishPolicyConfig> };
}): PublishPolicyConfig {
  const mode = source.publishMode ?? DEFAULT_PUBLISH_MODE;
  const overrides = source.sourceConfig?.publishPolicy ?? {};
  return {
    mode,
    minTrustScore: overrides.minTrustScore ?? DEFAULT_PUBLISH_POLICY.minTrustScore,
    minExtractionConfidence:
      overrides.minExtractionConfidence ?? DEFAULT_PUBLISH_POLICY.minExtractionConfidence,
    blockOnDuplicate: overrides.blockOnDuplicate ?? DEFAULT_PUBLISH_POLICY.blockOnDuplicate,
  };
}
