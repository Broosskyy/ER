import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import type {
  RawWebsiteEvent,
  WebsiteDetectedSignal,
  WebsiteDocument,
  WebsiteStrategyKey,
} from '@/features/aggregation/connectors/website/types';

export interface WebsiteStrategyCapabilities {
  supportsListPages: boolean;
  supportsDetailPages: boolean;
  supportsPagination: boolean;
  requiresConfiguration: boolean;
}

export interface WebsiteStrategyValidationIssue {
  field?: string;
  code: string;
  message: string;
}

export interface WebsiteStrategyValidationResult {
  valid: boolean;
  issues: WebsiteStrategyValidationIssue[];
}

export interface WebsiteStrategyDetectResult {
  confidence: number;
  signals: WebsiteDetectedSignal[];
  eventCountEstimate: number;
}

export interface WebsiteStrategyDiagnostics {
  extractedCount: number;
  skippedCount: number;
  warnings: string[];
}

export interface WebsiteExtractionStrategy {
  readonly key: WebsiteStrategyKey;
  readonly version: string;
  readonly capabilities: WebsiteStrategyCapabilities;
  supports(document: WebsiteDocument, config: WebsiteConnectorConfig): boolean;
  detect(document: WebsiteDocument, config: WebsiteConnectorConfig): WebsiteStrategyDetectResult;
  validateConfiguration(config: WebsiteConnectorConfig): WebsiteStrategyValidationResult;
  extract(
    document: WebsiteDocument,
    config: WebsiteConnectorConfig,
    context: WebsiteStrategyContext,
  ): Promise<{ events: RawWebsiteEvent[]; diagnostics: WebsiteStrategyDiagnostics }>;
}

export interface WebsiteStrategyContext {
  baseUrl: string;
  connectorKey: string;
  fetchDetailPage?: (url: string) => Promise<WebsiteDocument>;
}

export function createValidationResult(
  issues: WebsiteStrategyValidationIssue[],
): WebsiteStrategyValidationResult {
  return { valid: issues.length === 0, issues };
}

export function createFieldEvidence(
  field: string,
  strategy: WebsiteStrategyKey,
  sourceUrl: string,
  options: { selectorOrPath?: string; confidence?: number; rawValue?: string } = {},
) {
  return {
    field,
    strategy,
    sourceUrl,
    selectorOrPath: options.selectorOrPath,
    confidence: options.confidence ?? 0.8,
    extractedAt: new Date().toISOString(),
    rawValue: options.rawValue,
  };
}
