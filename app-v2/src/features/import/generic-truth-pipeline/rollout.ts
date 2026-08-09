import { resolveServerGenericTruthRollout } from './server-rollout-config';
import type { GenericTruthFieldGroup } from './source-evidence-contract';

export type GenericTruthPipelineMode = 'shadow' | 'controlled' | 'automatic';

export interface GenericTruthRolloutConfig {
  enabled: boolean;
  mode: GenericTruthPipelineMode;
  autoPublishEnabled: boolean;
  sourceAllowlist: readonly string[];
  maxEvents: number;
  canaryPercent: number;
  fieldGroups: readonly GenericTruthFieldGroup[];
  writesSuppressed: boolean;
}

export function resolveGenericTruthRollout(
  overrides?: Partial<GenericTruthRolloutConfig>,
): GenericTruthRolloutConfig {
  return resolveServerGenericTruthRollout(overrides);
}

export function isSourceInRolloutScope(
  sourceId: string,
  config: GenericTruthRolloutConfig = resolveGenericTruthRollout(),
): boolean {
  if (config.mode === 'shadow') {
    return true;
  }
  if (config.sourceAllowlist.length === 0) {
    return false;
  }
  return config.sourceAllowlist.includes(sourceId);
}

export function isRolloutModeAllowsActivation(
  config: GenericTruthRolloutConfig = resolveGenericTruthRollout(),
): boolean {
  return config.mode === 'controlled' || config.mode === 'automatic';
}

function stableCanaryBucket(sourceId: string, canonicalEventId: string): number {
  let hash = 0;
  const key = `${sourceId}:${canonicalEventId}`;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 10000;
  }
  return hash % 100;
}

export function isEventInCanary(
  sourceId: string,
  canonicalEventId: string,
  config: GenericTruthRolloutConfig = resolveGenericTruthRollout(),
): boolean {
  if (config.canaryPercent >= 100) {
    return true;
  }
  if (config.canaryPercent <= 0) {
    return false;
  }
  return stableCanaryBucket(sourceId, canonicalEventId) < config.canaryPercent;
}
