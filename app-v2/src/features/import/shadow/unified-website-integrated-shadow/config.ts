import { env } from '@/core/config/env';
import { featureFlags } from '@/core/config/feature-flags';
import {
  PRODUCTION_AFFENKAEFIG_SOURCE_ID,
  PRODUCTION_BOOTSHAUS_SOURCE_ID,
} from '@/features/sources/production/production-source-records';

export const INTEGRATED_SHADOW_EXECUTION_MODE = 'unified_website_integrated_shadow' as const;

export const APPROVED_INTEGRATED_SHADOW_SOURCE_IDS = [
  PRODUCTION_BOOTSHAUS_SOURCE_ID,
  PRODUCTION_AFFENKAEFIG_SOURCE_ID,
] as const;

export type IntegratedShadowConfig = {
  enabled: boolean;
  sourceIds: readonly string[];
  sampleLimit: number;
  noWrite: boolean;
  executionMode: typeof INTEGRATED_SHADOW_EXECUTION_MODE;
};

export type IntegratedShadowConfigOverrides = Partial<IntegratedShadowConfig>;

function parseSourceIdAllowlist(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function resolveIntegratedShadowConfig(
  overrides?: IntegratedShadowConfigOverrides,
): IntegratedShadowConfig {
  const enabled =
    overrides?.enabled ?? featureFlags.unifiedWebsiteIntegratedShadowEnabled;
  const configuredIds =
    overrides?.sourceIds ??
  (env.unifiedWebsiteIntegratedShadowSourceIds.length > 0
    ? env.unifiedWebsiteIntegratedShadowSourceIds
    : []);

  return {
    enabled,
    sourceIds: configuredIds,
    sampleLimit: overrides?.sampleLimit ?? env.unifiedWebsiteIntegratedShadowSampleLimit,
    noWrite: overrides?.noWrite ?? env.unifiedWebsiteIntegratedShadowNoWrite,
    executionMode: INTEGRATED_SHADOW_EXECUTION_MODE,
  };
}

export function isIntegratedShadowEnabledForSource(
  sourceId: string,
  overrides?: IntegratedShadowConfigOverrides,
): boolean {
  const config = resolveIntegratedShadowConfig(overrides);
  if (!config.enabled) return false;
  if (config.sourceIds.length === 0) return false;
  return config.sourceIds.includes(sourceId);
}

export function resolveApprovedIntegratedShadowSourceIds(
  overrides?: IntegratedShadowConfigOverrides,
): string[] {
  const config = resolveIntegratedShadowConfig(overrides);
  if (!config.enabled) return [];
  const allowed = new Set<string>(APPROVED_INTEGRATED_SHADOW_SOURCE_IDS);
  return config.sourceIds.filter((id) => allowed.has(id));
}

export function buildDefaultIntegratedShadowFeatureFlagSnapshot(): Record<string, unknown> {
  return {
    unifiedWebsiteIntegratedShadowEnabled: featureFlags.unifiedWebsiteIntegratedShadowEnabled,
    unifiedWebsiteIntegratedShadowSourceIds: [...env.unifiedWebsiteIntegratedShadowSourceIds],
    unifiedWebsiteIntegratedShadowSampleLimit: env.unifiedWebsiteIntegratedShadowSampleLimit,
    unifiedWebsiteIntegratedShadowNoWrite: env.unifiedWebsiteIntegratedShadowNoWrite,
    executionMode: INTEGRATED_SHADOW_EXECUTION_MODE,
    approvedSources: [...APPROVED_INTEGRATED_SHADOW_SOURCE_IDS],
    defaultsSafe: !featureFlags.unifiedWebsiteIntegratedShadowEnabled,
  };
}

export { parseSourceIdAllowlist };
