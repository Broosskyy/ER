import { BaseConnector } from '@/features/connectors/base/base-connector';
import { createConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';
import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import type { ConnectorResult } from '@/features/connectors/contracts/connector-result';
import type { ConnectorValidationResult } from '@/features/connectors/contracts/connector';
import type { HttpClient } from '@/features/endpoints/contracts/http-abstraction';
import { HttpClientError } from '@/features/endpoints/contracts/http-abstraction';
import { mapHttpClientErrorToConnectorDetail } from '@/features/endpoints/domain/website-error-mapping';
import {
  WEBSITE_CONNECTOR_KEY,
  WEBSITE_DEFAULT_USER_AGENT,
} from '@/features/connectors/providers/website/website-connector-constants';
import {
  resolveWebsiteEndpoint,
  validateWebsiteConnectorConfiguration,
} from '@/features/connectors/providers/website/website-connector-validation';

export class WebsiteConnector extends BaseConnector {
  readonly connectorKey = WEBSITE_CONNECTOR_KEY;
  readonly displayName = 'Website Connector';
  readonly capabilities = createConnectorCapabilities({
    supportsPolling: true,
    supportsPagination: false,
  });

  constructor(private readonly httpClient: HttpClient) {
    super();
  }

  validateConfiguration(context: ConnectorContext): ConnectorValidationResult {
    return validateWebsiteConnectorConfiguration(context);
  }

  async execute(context: ConnectorContext): Promise<ConnectorResult> {
    const started = Date.now();
    if (context.runtime?.abortSignal?.aborted) {
      await context.log('warning', 'WEBSITE_EXECUTE_CANCELLED', 'Website connector execution cancelled.');
      return this.createFailureResult(
        {
          errors: [
            {
              category: 'unknown',
              code: 'EXECUTION_CANCELLED',
              message: 'Website connector execution was cancelled.',
            },
          ],
        },
        Date.now() - started,
      );
    }

    await context.log('info', 'WEBSITE_EXECUTE_START', 'Website connector execution started.');

    const validation = validateWebsiteConnectorConfiguration(context);
    if (!validation.valid) {
      await context.log(
        'warning',
        'WEBSITE_VALIDATION_FAILED',
        validation.issues.map((entry) => entry.message).join(' '),
      );
      return this.createFailureResult(
        {
          errors: validation.issues.map((entry) => ({
            category: 'configuration' as const,
            code: entry.code,
            message: entry.message,
            metadata: entry.field ? { field: entry.field } : undefined,
          })),
          diagnostics: { validationFailed: true },
        },
        Date.now() - started,
      );
    }

    const resolved = resolveWebsiteEndpoint(context);
    if (!resolved) {
      await context.log('error', 'WEBSITE_VALIDATION_FAILED', 'Website endpoint could not be resolved.');
      return this.createFailureResult(
        {
          errors: [
            {
              category: 'configuration',
              code: 'WEBSITE_ENDPOINT_UNRESOLVED',
              message: 'Website endpoint could not be resolved from context.',
            },
          ],
        },
        Date.now() - started,
      );
    }

    await context.log('info', 'WEBSITE_REQUEST_START', 'Starting website HTTP request.', {
      url: resolved.url,
      timeoutMs: resolved.timeoutMs,
    });

    try {
      const response = await this.httpClient.request({
        url: resolved.url,
        method: 'GET',
        timeoutMs: resolved.timeoutMs,
        followRedirects: resolved.followRedirects,
        maxRedirects: resolved.maxRedirects,
        acceptedContentTypes: resolved.acceptedContentTypes,
        headers: {
          'User-Agent': resolved.userAgent || WEBSITE_DEFAULT_USER_AGENT,
          Accept: resolved.acceptedContentTypes.join(', '),
        },
      });

      await context.log('info', 'WEBSITE_RESPONSE_RECEIVED', 'Website HTTP response received.', {
        status: response.status,
        contentType: response.contentType,
        finalUrl: response.finalUrl,
      });

      const retrievedAt = new Date().toISOString();
      const candidate = {
        externalId: resolved.endpointId,
        sourceUrl: response.finalUrl,
        rawPayload: {
          html: response.body,
          contentType: response.contentType,
          status: response.status,
        },
        metadata: {
          endpointId: resolved.endpointId,
          sourceId: resolved.sourceId,
          connectorKey: WEBSITE_CONNECTOR_KEY,
          request: {
            url: resolved.url,
            method: 'GET',
            timeoutMs: resolved.timeoutMs,
            followRedirects: resolved.followRedirects,
            maxRedirects: resolved.maxRedirects,
          },
          response: {
            status: response.status,
            contentType: response.contentType,
            contentLength: response.body.length,
            finalUrl: response.finalUrl,
            durationMs: response.durationMs,
          },
          retrievedAt,
        },
      };

      await context.log('info', 'WEBSITE_EXECUTE_COMPLETE', 'Website connector execution completed.');

      return this.createSuccessResult(
        {
          candidates: [candidate],
          diagnostics: {
            httpStatus: response.status,
            contentType: response.contentType,
            contentLength: response.body.length,
            finalUrl: response.finalUrl,
            requestDurationMs: response.durationMs,
          },
          metadata: {
            connectorKey: WEBSITE_CONNECTOR_KEY,
            endpointId: resolved.endpointId,
            sourceId: resolved.sourceId,
          },
        },
        Date.now() - started,
      );
    } catch (error) {
      await context.log(
        'error',
        'WEBSITE_TRANSPORT_FAILED',
        error instanceof Error ? error.message : 'Website transport failed.',
      );

      const connectorError =
        error instanceof HttpClientError
          ? mapHttpClientErrorToConnectorDetail(error)
          : {
              category: 'unknown' as const,
              code: 'WEBSITE_TRANSPORT',
              message: error instanceof Error ? error.message : 'Website transport failed.',
            };

      return this.createFailureResult(
        {
          errors: [connectorError],
          diagnostics: {
            transportFailed: true,
            url: resolved.url,
          },
        },
        Date.now() - started,
      );
    }
  }
}
