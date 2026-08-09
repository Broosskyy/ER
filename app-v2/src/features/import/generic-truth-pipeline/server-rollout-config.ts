import type { GenericTruthPipelineMode, GenericTruthRolloutConfig } from './rollout';
import type { GenericTruthFieldGroup } from './source-evidence-contract';
import { ALL_GENERIC_TRUTH_FIELD_GROUPS } from './source-evidence-contract';

function splitEnvList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry: string) => entry.trim())
    .filter(Boolean);
}

function parseMode(raw: string | undefined): GenericTruthPipelineMode {
  if (raw === 'controlled' || raw === 'automatic') return raw;
  return 'shadow';
}

/**
 * Server/worker-only rollout flags. Never exposed via EXPO_PUBLIC_*.
 */
export function resolveServerGenericTruthRollout(
  overrides: Partial<{
    enabled: boolean;
    mode: GenericTruthPipelineMode;
    autoPublishEnabled: boolean;
    sourceAllowlist: readonly string[];
    maxEvents: number;
    canaryPercent: number;
    fieldGroups: readonly GenericTruthFieldGroup[];
    writesSuppressed: boolean;
  }> = {},
): GenericTruthRolloutConfig {
  const enabled =
    overrides.enabled ?? process.env.GENERIC_TRUTH_PIPELINE_ENABLED === 'true';
  const mode = overrides.mode ?? parseMode(process.env.GENERIC_TRUTH_PIPELINE_MODE);
  const autoPublishEnabled =
    overrides.autoPublishEnabled ??
    process.env.GENERIC_TRUTH_AUTO_PUBLISH_ENABLED === 'true';
  const sourceAllowlist =
    overrides.sourceAllowlist ?? splitEnvList(process.env.GENERIC_TRUTH_PIPELINE_SOURCE_IDS);
  const maxEvents =
    overrides.maxEvents ??
    Number.parseInt(process.env.GENERIC_TRUTH_PIPELINE_MAX_EVENTS ?? '5000', 10);
  const canaryPercent =
    overrides.canaryPercent ??
    Number.parseInt(process.env.GENERIC_TRUTH_PIPELINE_CANARY_PERCENT ?? '0', 10);
  const configuredGroups =
    overrides.fieldGroups ??
    splitEnvList(process.env.GENERIC_TRUTH_PIPELINE_FIELD_GROUPS);
  const fieldGroups =
    configuredGroups.length > 0
      ? (configuredGroups as GenericTruthFieldGroup[])
      : ALL_GENERIC_TRUTH_FIELD_GROUPS;

  const writesSuppressed =
    overrides.writesSuppressed ??
    (!enabled || mode === 'shadow' || (!autoPublishEnabled && mode !== 'automatic'));

  return {
    enabled,
    mode,
    autoPublishEnabled,
    sourceAllowlist,
    maxEvents,
    canaryPercent,
    fieldGroups,
    writesSuppressed,
  };
}
