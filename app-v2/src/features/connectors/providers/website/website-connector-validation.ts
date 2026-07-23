import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import type { ConnectorValidationResult } from '@/features/connectors/contracts/connector';
import type { AcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-model';
import type { WebsiteEndpointConfig } from '@/features/endpoints/domain/endpoint-config';
import { DEFAULT_CONNECTOR_FRAMEWORK_SETTINGS } from '@/features/connectors/domain/connector-config';
import {
  WEBSITE_CONNECTOR_KEY,
  WEBSITE_DEFAULT_CONTENT_TYPES,
  WEBSITE_DEFAULT_MAX_REDIRECTS,
  WEBSITE_DEFAULT_USER_AGENT,
} from '@/features/connectors/providers/website/website-connector-constants';
import { assertHttpUrl } from '@/features/endpoints/http/http-client-utils';

export interface ResolvedWebsiteEndpoint {
  endpointId: string;
  sourceId: string;
  url: string;
  enabled: boolean;
  connectorKey: string;
  endpointType: string;
  websiteConfig: WebsiteEndpointConfig;
  timeoutMs: number;
  maxRedirects: number;
  acceptedContentTypes: string[];
  followRedirects: boolean;
  userAgent: string;
}

function issue(
  code: string,
  message: string,
  field?: string,
): ConnectorValidationResult['issues'][number] {
  return { code, message, field };
}

function findSourceEndpoint(
  context: ConnectorContext,
): AcquisitionEndpoint | undefined {
  const endpointId = context.endpoint?.id;
  if (!endpointId) {
    return undefined;
  }
  return context.source.sourceConfig?.endpoints?.find((entry) => entry.id === endpointId);
}

export function resolveWebsiteEndpoint(context: ConnectorContext): ResolvedWebsiteEndpoint | null {
  const endpointRef = context.endpoint;
  if (!endpointRef?.id || !endpointRef.url) {
    return null;
  }

  const stored = findSourceEndpoint(context);
  const websiteConfig =
    stored?.config?.type === 'website' ? stored.config.website : {};

  const timeoutMs = DEFAULT_CONNECTOR_FRAMEWORK_SETTINGS.defaultTimeoutMs;
  const maxRedirects = websiteConfig.maxRedirects ?? WEBSITE_DEFAULT_MAX_REDIRECTS;
  const acceptedContentTypes =
    websiteConfig.acceptedContentTypes && websiteConfig.acceptedContentTypes.length > 0
      ? websiteConfig.acceptedContentTypes
      : [...WEBSITE_DEFAULT_CONTENT_TYPES];

  return {
    endpointId: endpointRef.id,
    sourceId: context.source.id,
    url: endpointRef.url,
    enabled: stored?.enabled ?? true,
    connectorKey: stored?.connectorKey ?? WEBSITE_CONNECTOR_KEY,
    endpointType: endpointRef.endpointType ?? stored?.endpointType ?? 'website',
    websiteConfig,
    timeoutMs,
    maxRedirects,
    acceptedContentTypes,
    followRedirects: websiteConfig.followRedirects ?? true,
    userAgent: websiteConfig.userAgent ?? WEBSITE_DEFAULT_USER_AGENT,
  };
}

export function validateWebsiteConnectorConfiguration(
  context: ConnectorContext,
): ConnectorValidationResult {
  const issues: ConnectorValidationResult['issues'] = [];

  if (!context.endpoint?.id) {
    issues.push(issue('WEBSITE_ENDPOINT_REQUIRED', 'Website execution requires an endpoint reference.', 'endpoint'));
  }

  if (!context.endpoint?.url?.trim()) {
    issues.push(issue('WEBSITE_URL_REQUIRED', 'Website endpoint URL is required.', 'endpoint.url'));
  }

  if (context.endpoint?.endpointType && context.endpoint.endpointType !== 'website') {
    issues.push(
      issue(
        'WEBSITE_ENDPOINT_TYPE',
        `Expected endpoint type "website" but received "${context.endpoint.endpointType}".`,
        'endpoint.endpointType',
      ),
    );
  }

  const resolved = resolveWebsiteEndpoint(context);
  if (!resolved && context.endpoint?.url) {
    try {
      assertHttpUrl(context.endpoint.url);
    } catch (error) {
      issues.push(
        issue(
          'WEBSITE_URL_INVALID',
          error instanceof Error ? error.message : 'Website URL is invalid.',
          'endpoint.url',
        ),
      );
    }
  }

  if (resolved) {
    if (!resolved.enabled) {
      issues.push(issue('WEBSITE_ENDPOINT_DISABLED', 'Website endpoint is disabled.', 'endpoint.enabled'));
    }

    if (resolved.connectorKey !== WEBSITE_CONNECTOR_KEY) {
      issues.push(
        issue(
          'WEBSITE_CONNECTOR_KEY',
          `Expected connectorKey "${WEBSITE_CONNECTOR_KEY}" but received "${resolved.connectorKey}".`,
          'endpoint.connectorKey',
        ),
      );
    }

    if (resolved.endpointType !== 'website') {
      issues.push(
        issue(
          'WEBSITE_ENDPOINT_TYPE',
          `Expected endpoint type "website" but received "${resolved.endpointType}".`,
          'endpoint.endpointType',
        ),
      );
    }

    try {
      assertHttpUrl(resolved.url);
    } catch (error) {
      issues.push(
        issue(
          'WEBSITE_URL_INVALID',
          error instanceof Error ? error.message : 'Website URL is invalid.',
          'endpoint.url',
        ),
      );
    }

    if (resolved.websiteConfig.requiresJavaScriptRendering) {
      issues.push(
        issue(
          'WEBSITE_JS_RENDERING_UNSUPPORTED',
          'JavaScript rendering is not supported in ER-014 Part 2.',
          'endpoint.config.requiresJavaScriptRendering',
        ),
      );
    }

    if (!Number.isFinite(resolved.timeoutMs) || resolved.timeoutMs <= 0) {
      issues.push(
        issue('WEBSITE_TIMEOUT_INVALID', 'Website timeout configuration is invalid.', 'timeoutMs'),
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
