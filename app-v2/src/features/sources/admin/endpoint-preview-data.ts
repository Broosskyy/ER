/**
 * UI-only preview types and sample data for the Endpoint Management section.
 * Not a domain model — not wired to repositories or persistence.
 */

export type EndpointPreviewHttpMethod = 'GET' | 'HEAD';

export interface EndpointPreviewItem {
  id: string;
  name: string;
  url: string;
  httpMethod: EndpointPreviewHttpMethod;
  connectorKey: string;
  enabled: boolean;
  priority: number;
  description?: string;
}

/** Clearly marked preview data — max three items for screen verification. */
export const ENDPOINT_PREVIEW_SAMPLE_DATA: EndpointPreviewItem[] = [
  {
    id: 'ep-preview-1',
    name: 'Events listing page',
    url: 'https://example-venue.de/events',
    httpMethod: 'GET',
    connectorKey: 'website',
    enabled: true,
    priority: 80,
    description: 'Primary HTML page for upcoming club nights.',
  },
  {
    id: 'ep-preview-2',
    name: 'RSS fallback feed',
    url: 'https://example-venue.de/feed.xml',
    httpMethod: 'GET',
    connectorKey: 'website',
    enabled: false,
    priority: 40,
    description: 'Reserved for a future RSS connector — inactive in preview.',
  },
  {
    id: 'ep-preview-3',
    name: 'Health check HEAD',
    url: 'https://example-venue.de/events',
    httpMethod: 'HEAD',
    connectorKey: 'website',
    enabled: true,
    priority: 10,
    description: 'Lightweight reachability probe without body download.',
  },
];

export const ENDPOINT_PREVIEW_HTTP_METHODS: EndpointPreviewHttpMethod[] = ['GET', 'HEAD'];

export function createEmptyEndpointPreviewDraft(): Omit<EndpointPreviewItem, 'id'> {
  return {
    name: '',
    url: '',
    httpMethod: 'GET',
    connectorKey: 'website',
    enabled: true,
    priority: 50,
    description: '',
  };
}

export function createEndpointPreviewId(): string {
  return `ep-preview-${Date.now()}`;
}
