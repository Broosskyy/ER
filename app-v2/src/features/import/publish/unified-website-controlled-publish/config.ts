import { env } from '@/core/config/env';
import { featureFlags } from '@/core/config/feature-flags';

export const PHASE486_EXECUTION_MODE = 'unified_website_controlled_publish' as const;
export const PHASE486_IMPORTER_VERSION = 'phase4841-unified-website-v1';

export const PHASE486_PUBLISHABLE_FIELDS = [
  'title',
  'description',
  'imageUrl',
  'gallery',
  'genres',
  'lineup',
  'websiteUrl',
  'ticketUrl',
] as const;

export type Phase486PublishableField = (typeof PHASE486_PUBLISHABLE_FIELDS)[number];

export const PHASE486_FORBIDDEN_PUBLISH_FIELDS = [
  'priceText',
  'ticketStatus',
  'ticketPhases',
  'venueName',
  'venueId',
  'venueCity',
  'venueAddress',
  'coordinates',
  'organizerName',
  'sourceId',
  'startDate',
  'endDate',
  'timezone',
  'subtitle',
  'ageRestriction',
] as const;

export type UnifiedWebsitePublishConfig = {
  enabled: boolean;
  sourceIds: readonly string[];
  eventIds: readonly string[];
  fields: readonly string[];
  dryRun: boolean;
  executionMode: typeof PHASE486_EXECUTION_MODE;
};

export type UnifiedWebsitePublishConfigOverrides = Partial<UnifiedWebsitePublishConfig>;

export function resolveUnifiedWebsitePublishConfig(
  overrides?: UnifiedWebsitePublishConfigOverrides,
): UnifiedWebsitePublishConfig {
  return {
    enabled: overrides?.enabled ?? featureFlags.unifiedWebsitePublishEnabled,
    sourceIds:
      overrides?.sourceIds ??
      (env.unifiedWebsitePublishSourceIds.length > 0 ? env.unifiedWebsitePublishSourceIds : []),
    eventIds:
      overrides?.eventIds ??
      (env.unifiedWebsitePublishEventIds.length > 0 ? env.unifiedWebsitePublishEventIds : []),
    fields:
      overrides?.fields ??
      (env.unifiedWebsitePublishFields.length > 0 ? env.unifiedWebsitePublishFields : []),
    dryRun: overrides?.dryRun ?? env.unifiedWebsitePublishDryRun,
    executionMode: PHASE486_EXECUTION_MODE,
  };
}

/** Fachliche Zulässigkeit — unabhängig vom Rollout-Scope. */
export function evaluatePublishEligibility(input: {
  sourceId: string;
  eventId: string;
  config?: UnifiedWebsitePublishConfigOverrides;
}): { eligible: boolean; issues: string[] } {
  const config = resolveUnifiedWebsitePublishConfig(input.config);
  const issues: string[] = [];

  if (config.sourceIds.length > 0 && !config.sourceIds.includes(input.sourceId)) {
    issues.push(`Source ${input.sourceId} not in configured source allowlist`);
  }

  return { eligible: issues.length === 0, issues };
}

/** Rollout-Scope — zusätzlich zur fachlichen Eligibility erforderlich. */
export function verifyPublishScope(input: {
  sourceId: string;
  eventId: string;
  config?: UnifiedWebsitePublishConfigOverrides;
}): { ok: boolean; issues: string[] } {
  const config = resolveUnifiedWebsitePublishConfig(input.config);
  const issues: string[] = [];

  if (!config.enabled && !input.config?.enabled) {
    issues.push('unifiedWebsitePublishEnabled is false');
  }

  const eligibility = evaluatePublishEligibility(input);
  issues.push(...eligibility.issues);

  if (config.eventIds.length === 0) {
    issues.push('publish_event_allowlist_empty');
  } else if (!config.eventIds.includes(input.eventId)) {
    issues.push(`Event ${input.eventId} not in publish event allowlist`);
  }

  return { ok: issues.length === 0, issues };
}

export function buildDefaultUnifiedWebsitePublishFlagSnapshot(): Record<string, unknown> {
  return {
    unifiedWebsitePublishEnabled: featureFlags.unifiedWebsitePublishEnabled,
    unifiedWebsitePublishSourceIds: [...env.unifiedWebsitePublishSourceIds],
    unifiedWebsitePublishEventIds: [...env.unifiedWebsitePublishEventIds],
    unifiedWebsitePublishFields: [...env.unifiedWebsitePublishFields],
    unifiedWebsitePublishDryRun: env.unifiedWebsitePublishDryRun,
    executionMode: PHASE486_EXECUTION_MODE,
    rolloutActivated: false,
    defaultsSafe: !featureFlags.unifiedWebsitePublishEnabled,
    shadowFlagsSeparate: true,
  };
}

export function isForbiddenPublishField(field: string): boolean {
  return (PHASE486_FORBIDDEN_PUBLISH_FIELDS as readonly string[]).includes(field);
}

export function isPublishableField(
  field: string,
  config?: UnifiedWebsitePublishConfigOverrides,
): boolean {
  const resolved = resolveUnifiedWebsitePublishConfig(config);
  if (isForbiddenPublishField(field)) return false;
  if (resolved.fields.length === 0) {
    return (PHASE486_PUBLISHABLE_FIELDS as readonly string[]).includes(field);
  }
  return resolved.fields.includes(field);
}
