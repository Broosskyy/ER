import type { AcquisitionCandidate } from '@/features/connectors/contracts/connector-result';
import type { ConnectorErrorDetail } from '@/features/connectors/errors/connector-errors';
import { createConnectorErrorDetail } from '@/features/connectors/errors/connector-errors';

export interface CandidateValidationResult {
  valid: boolean;
  errors: ConnectorErrorDetail[];
}

const EVENT_ENTITY_MARKERS = ['eventId', 'eventStatus', 'publishedAt'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Minimum framework contract for connector output.
 * Invalid candidates fail the entire execution — none are silently discarded.
 */
export function validateAcquisitionCandidates(input: {
  candidates: unknown;
  endpointId: string;
  sourceId: string;
}): CandidateValidationResult {
  const errors: ConnectorErrorDetail[] = [];

  if (!Array.isArray(input.candidates)) {
    errors.push(
      createConnectorErrorDetail(
        'configuration',
        'CONNECTOR_CONTRACT_VIOLATION',
        'Connector must return an array of acquisition candidates.',
      ),
    );
    return { valid: false, errors };
  }

  for (let index = 0; index < input.candidates.length; index += 1) {
    const candidate = input.candidates[index];
    const path = `candidates[${index}]`;

    if (!isRecord(candidate)) {
      errors.push(
        createConnectorErrorDetail(
          'configuration',
          'CONNECTOR_CONTRACT_VIOLATION',
          `Candidate at ${path} must be an object.`,
          { metadata: { path } },
        ),
      );
      continue;
    }

    if (typeof candidate.externalId !== 'string' || !candidate.externalId.trim()) {
      errors.push(
        createConnectorErrorDetail(
          'configuration',
          'CONNECTOR_CONTRACT_VIOLATION',
          `Candidate at ${path} requires a non-empty externalId.`,
          { metadata: { path } },
        ),
      );
    }

    if (!isRecord(candidate.rawPayload)) {
      errors.push(
        createConnectorErrorDetail(
          'configuration',
          'CONNECTOR_CONTRACT_VIOLATION',
          `Candidate at ${path} requires an opaque rawPayload object.`,
          { metadata: { path } },
        ),
      );
    }

    const metadata = isRecord(candidate.metadata) ? candidate.metadata : undefined;
    const retrievedAt = metadata?.retrievedAt;
    if (typeof retrievedAt !== 'string' || !retrievedAt.trim()) {
      errors.push(
        createConnectorErrorDetail(
          'configuration',
          'CONNECTOR_CONTRACT_VIOLATION',
          `Candidate at ${path} requires metadata.retrievedAt.`,
          { metadata: { path } },
        ),
      );
    }

    if (metadata?.endpointId && metadata.endpointId !== input.endpointId) {
      errors.push(
        createConnectorErrorDetail(
          'configuration',
          'CONNECTOR_CONTRACT_VIOLATION',
          `Candidate at ${path} references a different endpoint.`,
          { metadata: { path, endpointId: metadata.endpointId } },
        ),
      );
    }

    if (metadata?.sourceId && metadata.sourceId !== input.sourceId) {
      errors.push(
        createConnectorErrorDetail(
          'configuration',
          'CONNECTOR_CONTRACT_VIOLATION',
          `Candidate at ${path} references a different source.`,
          { metadata: { path, sourceId: metadata.sourceId } },
        ),
      );
    }

    for (const marker of EVENT_ENTITY_MARKERS) {
      if (marker in candidate) {
        errors.push(
          createConnectorErrorDetail(
            'configuration',
            'CONNECTOR_CONTRACT_VIOLATION',
            `Candidate at ${path} must not return Event entity fields.`,
            { metadata: { path, field: marker } },
          ),
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidAcquisitionCandidates(
  candidates: AcquisitionCandidate[],
  endpointId: string,
  sourceId: string,
): void {
  const result = validateAcquisitionCandidates({ candidates, endpointId, sourceId });
  if (!result.valid) {
    throw new Error(result.errors.map((entry) => entry.message).join(' '));
  }
}
