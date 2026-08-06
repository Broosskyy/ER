import { createHash } from 'node:crypto';

export type DetailFetchOutcome = 'success' | 'blocked' | 'failed' | 'skipped';

export interface DetailExtractionSnapshot {
  sourceId?: string;
  externalEventId: string;
  url: string;
  fetchedAt: string;
  httpOutcome: DetailFetchOutcome;
  parserVersion: string;
  connectorVersion?: string;
  contentHash?: string;
  blockedReason?: string;
  extractionWarnings: string[];
  fieldCoverage: string[];
  normalizedPayload?: Record<string, unknown>;
}

export function hashDetailContent(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

export function buildDetailSnapshot(input: {
  externalEventId: string;
  url: string;
  parserVersion: string;
  connectorVersion?: string;
  httpOutcome: DetailFetchOutcome;
  blockedReason?: string;
  warnings?: string[];
  fieldCoverage?: string[];
  normalizedPayload?: Record<string, unknown>;
}): DetailExtractionSnapshot {
  const fetchedAt = new Date().toISOString();
  return {
    externalEventId: input.externalEventId,
    url: input.url,
    fetchedAt,
    httpOutcome: input.httpOutcome,
    parserVersion: input.parserVersion,
    connectorVersion: input.connectorVersion,
    blockedReason: input.blockedReason,
    extractionWarnings: input.warnings ?? [],
    fieldCoverage: input.fieldCoverage ?? [],
    normalizedPayload: input.normalizedPayload,
    contentHash: input.normalizedPayload
      ? hashDetailContent(input.normalizedPayload)
      : undefined,
  };
}

/**
 * When a detail fetch is blocked, retain the last successful snapshot fields.
 */
export function mergeDetailWithPreviousSnapshot(
  current: Record<string, unknown>,
  previousSnapshot?: DetailExtractionSnapshot | null,
  blocked?: boolean,
): Record<string, unknown> {
  if (!blocked || !previousSnapshot?.normalizedPayload) {
    return current;
  }

  const previous = previousSnapshot.normalizedPayload;
  const merged: Record<string, unknown> = { ...current };

  for (const [key, value] of Object.entries(previous)) {
    const currentValue = merged[key];
    const isEmptyArray = Array.isArray(currentValue) && currentValue.length === 0;
    const isEmpty =
      currentValue === undefined ||
      currentValue === null ||
      currentValue === '' ||
      isEmptyArray;

    if (isEmpty && value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  return merged;
}
