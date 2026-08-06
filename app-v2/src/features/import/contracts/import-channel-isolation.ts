import type { ImportChannel } from './evidence-types';

export interface ImportChannelPolicy {
  channel: ImportChannel;
  mayOverwriteApprovedManualCorrections: boolean;
  triggersAutomaticSourceRuns: boolean;
  affectedBySourcePause: boolean;
  schedulingNamespace: string;
}

export const IMPORT_CHANNEL_POLICIES: ImportChannelPolicy[] = [
  {
    channel: 'manual_admin_import',
    mayOverwriteApprovedManualCorrections: false,
    triggersAutomaticSourceRuns: false,
    affectedBySourcePause: false,
    schedulingNamespace: 'manual_admin',
  },
  {
    channel: 'automatic_source_import',
    mayOverwriteApprovedManualCorrections: false,
    triggersAutomaticSourceRuns: true,
    affectedBySourcePause: true,
    schedulingNamespace: 'automatic_source',
  },
  {
    channel: 'ai_assisted_import',
    mayOverwriteApprovedManualCorrections: false,
    triggersAutomaticSourceRuns: false,
    affectedBySourcePause: false,
    schedulingNamespace: 'ai_assisted',
  },
];

export const SHARED_IMPORT_PLATFORM_COMPONENTS = [
  'unified_import_result_contract',
  'identity_matching',
  'merge_engine',
  'canonical_writers',
  'review_infrastructure',
] as const;

export const ISOLATED_PER_CHANNEL = [
  'raw_job_identity',
  'scheduling',
  'retry_policy',
  'channel_provenance',
] as const;
