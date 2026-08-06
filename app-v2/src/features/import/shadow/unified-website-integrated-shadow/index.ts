export {
  APPROVED_INTEGRATED_SHADOW_SOURCE_IDS,
  INTEGRATED_SHADOW_EXECUTION_MODE,
  buildDefaultIntegratedShadowFeatureFlagSnapshot,
  isIntegratedShadowEnabledForSource,
  parseSourceIdAllowlist,
  resolveApprovedIntegratedShadowSourceIds,
  resolveIntegratedShadowConfig,
  type IntegratedShadowConfig,
  type IntegratedShadowConfigOverrides,
} from './config';
export {
  IntegratedShadowCollector,
  beginIntegratedShadowSession,
  endIntegratedShadowSession,
  getActiveIntegratedShadowCollector,
  resetIntegratedShadowSession,
  type IntegratedShadowEventRecord,
  type IntegratedShadowPerformance,
  type IntegratedShadowSessionReport,
} from './collector';
export {
  INTEGRATED_COMPARISON_FIELDS,
  classifyIntegratedFieldComparison,
  extractLegacyIntegratedField,
  extractUnifiedIntegratedField,
  findUnexplainedClaimedFieldGaps,
  summarizeIntegratedFieldComparisons,
  type IntegratedComparisonField,
  type IntegratedFieldComparison,
  type IntegratedFieldStatus,
} from './field-comparison';
export { validateIntegratedShadowIdentities, type IdentityValidationResult } from './identity-validation';
export {
  INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
  IntegratedShadowBranchAbortedError,
  maybeRunIntegratedShadowExtraction,
} from './runner';
export { runIntegratedShadowWebsitePipeline, type IntegratedShadowPipelineResult } from './pipeline';
