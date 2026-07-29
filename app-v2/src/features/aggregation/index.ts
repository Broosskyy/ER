export type {
  AggregationSource,
  AggregationSourceStatus,
  ImportStrategy,
} from './domain/aggregation-source';
export {
  AGGREGATION_SOURCE_STATUSES,
  IMPORT_STRATEGIES,
  mapSourceRecordToAggregationSource,
  resolveAggregationSourceStatus,
  resolveImportStrategy,
} from './domain/aggregation-source';

export type {
  AggregationPipelineStatus,
  AggregationPipelineStepName,
} from './domain/import-pipeline-status';
export {
  AGGREGATION_PIPELINE_STATUSES,
  AGGREGATION_PIPELINE_STEP_NAMES,
  isAggregationPipelineStatus,
  isAggregationPipelineStepName,
} from './domain/import-pipeline-status';

export type { CanonicalImportEvent } from './domain/canonical-import-event';
export {
  extractTimeLabel,
  mapNormalizedCandidateToCanonical,
} from './domain/canonical-import-event';

export type { SourceAuthConfig, SourceAuthType } from './domain/source-auth-config';
export {
  SOURCE_AUTH_TYPES,
  createPreparedAuthConfig,
  isSourceAuthType,
} from './domain/source-auth-config';

export type {
  PipelineRecordEnvelope,
  PipelineRunContext,
  PipelineRunResult,
  PipelineRunSummary,
  PipelineStep,
  PipelineStepResult,
} from './pipeline/types';

export {
  AggregationPipeline,
  createAdapterFetchProvider,
  createAggregationPipelineFromSource,
} from './pipeline/aggregation-pipeline';

export type { FetchProvider, FetchedImportPayload } from './pipeline/steps/fetch-step';
export type { NormalizedImportPayload } from './pipeline/steps/normalize-step';
export type { ValidatedImportPayload } from './pipeline/steps/validate-step';
export type { DuplicateCheckedPayload } from './pipeline/steps/duplicate-check-step';
export type { MergedPipelinePayload } from './pipeline/steps/merge-step';
export type { ReviewQueuedPayload } from './pipeline/steps/review-step';

export type {
  DuplicateStrategy,
  DuplicateStrategyResult,
  DuplicateSignalField,
} from './duplicate/duplicate-strategy';
export {
  DUPLICATE_SIGNAL_FIELDS,
  ScoreBasedDuplicateStrategy,
  scoreBasedDuplicateStrategy,
} from './duplicate/duplicate-strategy';

export type {
  MergeStrategy,
  MergeDecision,
  MergedImportEvent,
  SourceContribution,
  MergeChangeEntry,
} from './merge/merge-strategy';
export {
  PriorityBasedMergeStrategy,
  priorityBasedMergeStrategy,
} from './merge/merge-strategy';

export type { AggregationLogEntry, AggregationRunLog } from './logging/aggregation-log-types';
export { AggregationLogService } from './logging/aggregation-log-service';

export {
  mapPipelineStatusToImportRecordStatus,
  mapImportRecordStatusToPipelineStatus,
} from './mappers/status-mapper';

export type {
  RawImportedEvent,
  SourceConnector,
  SourceConnectorKey,
  ReferenceSourceConfig,
} from './connectors/types';
export {
  rawEventToFetchedPayload,
  SOURCE_CONNECTOR_KEYS,
} from './connectors/types';
export {
  SourceConnectorRegistry,
  createDefaultSourceConnectorRegistry,
  sourceConnectorRegistry,
} from './connectors/source-connector-registry';
export {
  createSourceConnectorFetchProvider,
  resolveConnectorKeyFromSourceRecord,
  createAggregationSourceContext,
} from './connectors/create-source-connector-fetch-provider';
export { ManualReferenceConnector } from './connectors/manual-reference-connector';
export { ClubWebsiteConnector } from './connectors/club-website-connector';
export { OrganizerWebsiteConnector } from './connectors/organizer-website-connector';
export { IcalFeedConnector } from './connectors/ical-feed-connector';
export { OpenDataApiConnector } from './connectors/open-data-api-connector';

export type {
  SourceConnectorCapabilities,
  SourceConnectorVersionInfo,
  SourceConnectorHealthStatus,
  SourceConnectorHealthSnapshot,
  SourceConnectorErrorCode,
  SourceConnectorErrorDetail,
  SourceConnectorRetryConfig,
  SourceConnectorRateLimitConfig,
  SourceConnectorDiagnostics,
  SourceConnectorMetrics,
  SourceConnectorDescriptor,
  RegisteredSourceConnector,
  SourceConnectorExecutionResult,
} from './connectors/framework';
export {
  SOURCE_CONNECTOR_REGISTRY_VERSION,
  SOURCE_CONNECTOR_HEALTH_STATUSES,
  SOURCE_CONNECTOR_ERROR_CODES,
  SOURCE_CONNECTOR_DEFINITIONS,
  SourceConnectorError,
  SourceConnectorExecutor,
  SourceConnectorRateLimiter,
  BaseSourceConnector,
  createSourceConnectorCapabilities,
  createSourceConnectorVersion,
  classifySourceConnectorError,
  resolveSourceConnectorRetry,
} from './connectors/framework';

export { ImportAggregationService } from './services/import-aggregation-service';
export {
  ImportUpdateService,
  importUpdateService,
  IMPORT_CHANGE_FIELDS,
} from './services/import-update-service';
export type {
  ImportChangeField,
  ImportChangeType,
  ImportChangeSet,
  ImportUpdateContext,
} from './services/import-update-service';
