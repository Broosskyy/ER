export type DetailEvidenceFetchStatus =
  | 'ok'
  | 'pow_challenge'
  | 'not_found'
  | 'timeout'
  | 'http_error'
  | 'content_unusable';

export interface DetailEvidenceRequest {
  sourceId: string;
  sourceRole: string;
  eventUrl: string;
  sourceExternalId?: string;
  expectedIdentity?: {
    title?: string;
    eventDate?: string;
    venueName?: string;
  };
}

export interface DetailEvidenceResult {
  sourceId: string;
  eventUrl: string;
  observedAt: string;
  verifiedAt?: string;
  fetchStatus: DetailEvidenceFetchStatus;
  identity?: {
    pageTitle?: string;
    eventDate?: string;
    venueName?: string;
  };
  content?: {
    description?: string;
    genreLabels?: string[];
    lineup?: string[];
    minimumAge?: number;
    venueEnvironment?: string;
    startDate?: string;
    endDate?: string;
    imageUrl?: string;
  };
  ticketEvidence?: unknown;
  diagnostics: string[];
}

export interface DetailFetchMetrics {
  uniqueDetailUrls: number;
  embeddedHtmlHits: number;
  cacheHits: number;
  executedRequests: number;
  httpRetries: number;
  successfulFetches: number;
  powChallenges: number;
  timeouts: number;
  httpErrors: number;
  unusableContent: number;
  elapsedMs: number;
}
