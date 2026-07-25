export type { EndpointType } from '@/features/endpoints/domain/endpoint-types';
export {
  ENDPOINT_TYPES,
  ENDPOINT_TYPE_CONNECTOR_KEYS,
  isEndpointType,
  resolveDefaultConnectorKeyForEndpointType,
} from '@/features/endpoints/domain/endpoint-types';

export type { EndpointHealthStatus } from '@/features/endpoints/domain/endpoint-health';
export {
  ENDPOINT_HEALTH_STATUSES,
  isEndpointHealthStatus,
} from '@/features/endpoints/domain/endpoint-health';

export type {
  WebsiteEndpointConfig,
  RssEndpointConfig,
  ApiEndpointConfig,
  IcalEndpointConfig,
  TicketPlatformEndpointConfig,
  SocialEndpointConfig,
  WebhookEndpointConfig,
  UnknownEndpointConfig,
  EndpointTypeConfig,
} from '@/features/endpoints/domain/endpoint-config';
export { createEmptyEndpointConfig } from '@/features/endpoints/domain/endpoint-config';

export type {
  AcquisitionEndpoint,
  EndpointList,
} from '@/features/endpoints/domain/endpoint-model';

export {
  mapEndpointToConnectorRef,
  createConnectorEndpointRef,
} from '@/features/endpoints/domain/endpoint-mapper';

export type { EndpointConnectorResolution } from '@/features/endpoints/domain/endpoint-connector-resolution';
export {
  EndpointConnectorResolutionError,
  resolveConnectorKeyForEndpoint,
  applyDefaultConnectorKeyForEndpoint,
  resolveEndpointConnector,
  assertEndpointConnectorRegistered,
  suggestConnectorKeyForEndpointType,
} from '@/features/endpoints/domain/endpoint-connector-resolution';

export type {
  EndpointValidationIssue,
  EndpointValidationResult,
} from '@/features/endpoints/domain/endpoint-validation';
export { validateAcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-validation';

export type {
  HttpMethod,
  HttpRequestOptions,
  HttpResponse,
  HttpClient,
  HttpClientErrorCode,
  HttpClientErrorOptions,
} from '@/features/endpoints/contracts/http-abstraction';
export {
  HTTP_CLIENT_ERROR_CODES,
  HttpClientError,
  mapHttpErrorToConnectorCategory,
} from '@/features/endpoints/contracts/http-abstraction';

export {
  mapWebsiteAcquisitionError,
  mapHttpClientErrorToConnectorDetail,
} from '@/features/endpoints/domain/website-error-mapping';

export { DefaultHttpClient, DEFAULT_HTTP_MAX_REDIRECTS } from '@/features/endpoints/http/default-http-client';
export type { FetchImplementation } from '@/features/endpoints/http/default-http-client';
export {
  assertHttpUrl,
  normalizeContentType,
  isAcceptedContentType,
} from '@/features/endpoints/http/http-client-utils';
