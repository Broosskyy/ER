import type { UnifiedImportResult } from '@/features/import/contracts';
import type { RawWebsiteEvent } from '@/features/aggregation/connectors/website/types';

import type { IntegratedShadowConfig } from './config';

export type IntegratedShadowEventRecord = {
  detailUrl: string;
  externalId: string;
  legacyTitle?: string;
  htmlBytes: number;
  htmlReused: boolean;
  extraHttpRequests: number;
  unifiedResult?: UnifiedImportResult;
  unifiedError?: string;
  legacyEvent?: RawWebsiteEvent;
  unifiedDurationMs?: number;
};

export type IntegratedShadowPerformance = {
  detailPagesProcessed: number;
  htmlReuseCount: number;
  extraHttpRequests: number;
  unifiedExtractionsMs: number;
  unifiedFailures: number;
  legacyFailures: number;
  shadowArtifactBytes: number;
};

export type IntegratedShadowSessionReport = {
  executionMode: string;
  sourceId: string;
  sourceName: string;
  startedAt: string;
  completedAt: string;
  config: IntegratedShadowConfig;
  events: IntegratedShadowEventRecord[];
  performance: IntegratedShadowPerformance;
  productionMutationsInThisRun: 0;
};

export class IntegratedShadowCollector {
  private readonly events: IntegratedShadowEventRecord[] = [];
  private readonly startedAt = new Date().toISOString();
  private htmlReuseCount = 0;
  private extraHttpRequests = 0;
  private unifiedExtractionsMs = 0;
  private unifiedFailures = 0;
  private eventCount = 0;

  constructor(
    readonly sourceId: string,
    readonly sourceName: string,
    readonly config: IntegratedShadowConfig,
  ) {}

  get processedEventCount(): number {
    return this.eventCount;
  }

  recordExtraction(record: IntegratedShadowEventRecord): void {
    this.events.push(record);
    this.eventCount += 1;
    if (record.htmlReused) this.htmlReuseCount += 1;
    this.extraHttpRequests += record.extraHttpRequests;
    if (record.unifiedDurationMs) this.unifiedExtractionsMs += record.unifiedDurationMs;
    if (record.unifiedError) this.unifiedFailures += 1;
  }

  buildReport(): IntegratedShadowSessionReport {
    const artifactBytes = JSON.stringify(this.events).length;
    return {
      executionMode: this.config.executionMode,
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      startedAt: this.startedAt,
      completedAt: new Date().toISOString(),
      config: this.config,
      events: [...this.events],
      performance: {
        detailPagesProcessed: this.events.length,
        htmlReuseCount: this.htmlReuseCount,
        extraHttpRequests: this.extraHttpRequests,
        unifiedExtractionsMs: this.unifiedExtractionsMs,
        unifiedFailures: this.unifiedFailures,
        legacyFailures: 0,
        shadowArtifactBytes: artifactBytes,
      },
      productionMutationsInThisRun: 0,
    };
  }
}

let activeCollector: IntegratedShadowCollector | null = null;

export function beginIntegratedShadowSession(
  sourceId: string,
  sourceName: string,
  config: IntegratedShadowConfig,
): IntegratedShadowCollector {
  activeCollector = new IntegratedShadowCollector(sourceId, sourceName, config);
  return activeCollector;
}

export function getActiveIntegratedShadowCollector(): IntegratedShadowCollector | null {
  return activeCollector;
}

export function endIntegratedShadowSession(): IntegratedShadowSessionReport | null {
  if (!activeCollector) return null;
  const report = activeCollector.buildReport();
  activeCollector = null;
  return report;
}

export function resetIntegratedShadowSession(): void {
  activeCollector = null;
}
