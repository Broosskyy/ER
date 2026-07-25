import type { EndpointHealthStatus } from '@/features/endpoints/domain/endpoint-health';
import type { EndpointTypeConfig } from '@/features/endpoints/domain/endpoint-config';
import type { EndpointType } from '@/features/endpoints/domain/endpoint-types';

/**
 * Canonical acquisition endpoint model.
 *
 * An Endpoint is an addressable acquisition target owned by a Source.
 * One Source may own many Endpoints. Each Endpoint executes via one Connector.
 *
 * ER-014 Part 1: domain model only — no persistence table, no HTTP, no parsing.
 */
export interface AcquisitionEndpoint {
  /** Stable endpoint identity within a source. */
  id: string;
  /** Parent source id — denormalized for execution context assembly. */
  sourceId: string;
  displayName: string;
  endpointType: EndpointType;
  /** Connector registry key — resolved at execution time. */
  connectorKey: string;
  /** Acquisition URL where applicable (website page, feed URL, API path base). */
  url?: string;
  enabled: boolean;
  /** Type-specific declarative configuration. */
  config?: EndpointTypeConfig;
  /** Operational metadata — never secrets. */
  metadata?: Record<string, unknown>;
  /** Framework readiness placeholder — not runtime health in ER-014 Part 1. */
  healthStatus?: EndpointHealthStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointList {
  sourceId: string;
  endpoints: AcquisitionEndpoint[];
}
