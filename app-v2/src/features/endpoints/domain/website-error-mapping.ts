import { createConnectorErrorDetail } from '@/features/connectors/errors/connector-errors';
import {
  HttpClientError,
  mapHttpErrorToConnectorCategory,
  type HttpClientErrorCode,
} from '@/features/endpoints/contracts/http-abstraction';

/**
 * Maps Website acquisition failures into the existing Connector error model.
 * No HTTP implementation — translation contract only.
 */
export function mapWebsiteAcquisitionError(input: {
  code: HttpClientErrorCode | 'WEBSITE_CONFIG' | 'WEBSITE_PARSE' | 'WEBSITE_EMPTY';
  message: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
}) {
  if (input.code === 'WEBSITE_CONFIG') {
    return createConnectorErrorDetail('configuration', input.code, input.message, {
      retryable: false,
      metadata: input.metadata,
    });
  }

  if (input.code === 'WEBSITE_PARSE') {
    return createConnectorErrorDetail('parsing', input.code, input.message, {
      retryable: false,
      metadata: input.metadata,
    });
  }

  if (input.code === 'WEBSITE_EMPTY') {
    return createConnectorErrorDetail('parsing', input.code, input.message, {
      retryable: false,
      metadata: input.metadata,
    });
  }

  const category = mapHttpErrorToConnectorCategory(input.code);
  return createConnectorErrorDetail(category, input.code, input.message, {
    retryable: input.retryable,
    metadata: input.metadata,
  });
}

export function mapHttpClientErrorToConnectorDetail(error: HttpClientError) {
  return createConnectorErrorDetail(
    mapHttpErrorToConnectorCategory(error.code),
    error.code,
    error.message,
    {
      retryable: error.retryable,
      metadata: {
        status: error.status,
        url: error.url,
      },
    },
  );
}
