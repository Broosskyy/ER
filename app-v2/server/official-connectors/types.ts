export type OfficialLineupEvidenceRole = 'headliner' | 'artist' | 'compound_act';

export interface OfficialLineupCandidate {
  displayName: string;
  rawText: string;
  billingOrder: number;
  evidenceRole: OfficialLineupEvidenceRole;
  evidenceOrigin: 'official_text';
}

export interface RejectedOfficialCandidate {
  rawText: string;
  reason: string;
}

export interface OfficialEventEvidence {
  connectorId: string;
  sourceEventKey: string;
  listUrl: string;
  officialUrl: string;
  fetchedAt: string;
  pageFingerprint: string;

  title: string;
  startsAt: string;
  endsAt?: string;
  sourceTimezone: string;

  venue?: {
    name: string;
    address?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
  };

  organizerLabel?: string;
  descriptionRaw?: string;
  descriptionClean?: string;
  officialImageUrl?: string;
  linkedTicketUrl?: string;

  lineupCandidates: OfficialLineupCandidate[];
  explicitGenreLabels: string[];
  enrichmentGaps: string[];
  rejectedCandidates: RejectedOfficialCandidate[];
}

export type ConsumerPreviewDecision = 'preview_ready' | 'review_required';

export interface OfficialEventConsumerPreview extends OfficialEventEvidence {
  decision: ConsumerPreviewDecision;
  reviewReasons: string[];
}

export interface ConnectorErrorCounters {
  duplicateListEntries: number;
  duplicateDetailFetches: number;
  nonHttpsFetches: number;
  crossOriginDetailFetches: number;
  disallowedPathFetches: number;
  missingOfficialUrls: number;
  missingFingerprints: number;
  invalidDates: number;
  endBeforeStart: number;
  boilerplateInDescriptions: number;
  invalidLineupEntries: number;
  lineupDuplicates: number;
  compoundActsSplit: number;
  artistsInventedWithoutExplicitEvidence: number;
  genresInferredWithoutExplicitEvidence: number;
  ticketPagesFetched: number;
  imagesDownloaded: number;
  databaseWriteOperations: number;
}

export function createEmptyConnectorCounters(): ConnectorErrorCounters {
  return {
    duplicateListEntries: 0,
    duplicateDetailFetches: 0,
    nonHttpsFetches: 0,
    crossOriginDetailFetches: 0,
    disallowedPathFetches: 0,
    missingOfficialUrls: 0,
    missingFingerprints: 0,
    invalidDates: 0,
    endBeforeStart: 0,
    boilerplateInDescriptions: 0,
    invalidLineupEntries: 0,
    lineupDuplicates: 0,
    compoundActsSplit: 0,
    artistsInventedWithoutExplicitEvidence: 0,
    genresInferredWithoutExplicitEvidence: 0,
    ticketPagesFetched: 0,
    imagesDownloaded: 0,
    databaseWriteOperations: 0,
  };
}
