import type { UnifiedImportResult } from '@/features/import/contracts';
import { validateUnifiedImportResult } from '@/features/import/contracts/unified-import-schema';
import type { RawWebsiteEvent } from '@/features/aggregation/connectors/website/types';
import {
  buildImportContextForIntegratedShadow,
  runUnifiedWebsiteImport,
} from '@/features/import/unified-website';

import { getActiveIntegratedShadowCollector } from './collector';
import { resolveIntegratedShadowConfig, type IntegratedShadowConfigOverrides } from './config';

export const INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL =
  'https://shadow.test/unified-integrated-shadow-deliberate-failure';

export class IntegratedShadowBranchAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegratedShadowBranchAbortedError';
  }
}

function stableShadowEventId(detailUrl: string): string {
  return `shadow-${detailUrl.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 80)}`;
}

export function maybeRunIntegratedShadowExtraction(input: {
  sourceId: string;
  sourceName: string;
  detailUrl: string;
  html: string;
  finalUrl: string;
  httpStatus: number;
  legacyEvent: RawWebsiteEvent;
  configOverrides?: IntegratedShadowConfigOverrides;
}): UnifiedImportResult | undefined {
  const config = resolveIntegratedShadowConfig(input.configOverrides);
  const collector = getActiveIntegratedShadowCollector();
  if (!config.enabled || !collector || collector.sourceId !== input.sourceId) {
    return undefined;
  }
  if (!config.sourceIds.includes(input.sourceId)) {
    return undefined;
  }
  if (collector.processedEventCount >= config.sampleLimit) {
    return undefined;
  }

  const started = Date.now();
  let unifiedResult: UnifiedImportResult | undefined;
  let unifiedError: string | undefined;

  try {
    if (input.detailUrl === INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL) {
      throw new Error('Deliberate integrated shadow extraction failure');
    }

    unifiedResult = runUnifiedWebsiteImport({
      context: buildImportContextForIntegratedShadow({
        sourceId: input.sourceId,
        sourceName: input.sourceName,
        eventId: stableShadowEventId(input.detailUrl),
        websiteUrl: input.detailUrl,
        verifiedTicketUrl: input.legacyEvent.rawTicketLinks?.[0],
      }),
      html: input.html,
      fetchMeta: {
        status: input.httpStatus,
        finalUrl: input.finalUrl,
      },
    });
    validateUnifiedImportResult(unifiedResult);
  } catch (error) {
    unifiedError = error instanceof Error ? error.message : String(error);
    if (config.noWrite && error instanceof IntegratedShadowBranchAbortedError) {
      throw error;
    }
  }

  collector.recordExtraction({
    detailUrl: input.detailUrl,
    externalId: input.legacyEvent.externalId,
    legacyTitle: input.legacyEvent.title,
    htmlBytes: input.html.length,
    htmlReused: true,
    extraHttpRequests: 0,
    unifiedResult,
    unifiedError,
    legacyEvent: input.legacyEvent,
    unifiedDurationMs: Date.now() - started,
  });

  return unifiedResult;
}
