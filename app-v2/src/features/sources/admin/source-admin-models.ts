import type { SourceConnectorDiagnostics } from '@/features/aggregation/connectors/framework';
import type { SourceConnectorHealthSnapshot } from '@/features/aggregation/connectors/framework/health';
import type { SourceConnectorMetrics } from '@/features/aggregation/connectors/framework/metrics';
import type { SourceRecord } from '@/data/types/records';
import type { SourceCategory } from '@/features/sources/domain/source-categories';
import type { SourceImportHistoryEntry } from '@/features/sources/domain/source-import-history';
import type { SourceManagementStatus } from '@/features/sources/domain/source-status';
import type { SourceValidationIssue } from '@/features/sources/domain/source-management-validation';
import type { WebsiteDetectionReport, WebsiteExtractionDiagnostics } from '@/features/aggregation/connectors/website/types';
import type { WebsiteStrategyKey } from '@/features/aggregation/connectors/website/types';

export interface SourceAdminListItem {
  id: string;
  displayName: string;
  slug: string;
  category: SourceCategory;
  status: SourceManagementStatus;
  connectorKey?: string;
  enabled: boolean;
  archived: boolean;
  priority: number;
  trustScore: number;
  countryCode?: string;
  city?: string;
  lastImportAt?: string;
  lastSuccessfulSyncAt?: string;
  lastFailedImportAt?: string;
  updatedAt: string;
}

export interface SourceAdminDetailView extends SourceAdminListItem {
  description?: string;
  baseUrl?: string;
  website?: string;
  region?: string;
  stateCode?: string;
  genreNames?: string[];
  organizerId?: string;
  organizerName?: string;
  venueId?: string;
  venueName?: string;
  tags?: string[];
  languageCode?: string;
  defaultTimezone?: string;
  pollingIntervalMinutes?: number;
  reviewRequired?: boolean;
  autoEnabled?: boolean;
  sourceType: SourceRecord['sourceType'];
  parserType: SourceRecord['parserType'];
  acquisitionStrategy: SourceRecord['acquisitionStrategy'];
  validationIssues: SourceValidationIssue[];
  connectorHealth?: SourceConnectorHealthSnapshot;
  connectorMetrics?: SourceConnectorMetrics;
  importHistory: SourceImportHistoryEntry[];
  createdAt: string;
}

export interface SourceAdminTestImportResult {
  sourceId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  eventCount: number;
  diagnostics: SourceConnectorDiagnostics;
  previewEvents: Array<{
    externalId: string;
    title?: string;
    startDate?: string;
    cityName?: string;
    venueName?: string;
  }>;
}

export interface SourceAdminEditorModel {
  record: SourceRecord;
  category: SourceCategory;
  status: SourceManagementStatus;
  connectorKey?: string;
  validation: { valid: boolean; issues: SourceValidationIssue[] };
  canEnable: boolean;
  canArchive: boolean;
  canTestImport: boolean;
  canRunWebsiteDetection: boolean;
}

export interface SourceAdminWebsiteDetectionResult {
  sourceId: string;
  requestedUrl: string;
  detection: WebsiteDetectionReport;
  recommendedStrategy: WebsiteStrategyKey;
}

export interface SourceAdminWebsiteExtractionPreview {
  sourceId: string;
  strategy: WebsiteStrategyKey;
  eventCount: number;
  diagnostics: WebsiteExtractionDiagnostics;
  previewEvents: Array<{
    externalId: string;
    title?: string;
    rawStartDate?: string;
    rawVenue?: string;
    extractionStrategy: WebsiteStrategyKey;
    extractionConfidence: number;
  }>;
}
