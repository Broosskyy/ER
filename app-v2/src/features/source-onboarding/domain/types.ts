export const SOURCE_ONBOARDING_STATUSES = [
  'submitted',
  'probing',
  'discovered',
  'config_generated',
  'dry_run',
  'review_required',
  'ready',
  'enabled',
  'rejected',
] as const;

export type SourceOnboardingStatus = (typeof SOURCE_ONBOARDING_STATUSES)[number];

export interface DiscoveryEvidence {
  step: string;
  result: string;
  confidence: number;
  evidence: string;
  warnings?: string[];
}

export interface DeclarativeSourceConfig {
  version: number;
  sourceType: string;
  platform?: string;
  acquisition: {
    listUrl: string;
    detailUrlPattern?: string;
    strategy: string;
    pagination?: string;
  };
  selectors?: Record<string, string>;
  normalization: {
    timezone: string;
    country: string;
  };
  scope: {
    mode: string;
    allowedVenues?: string[];
    allowedOrganizers?: string[];
  };
  schedule: {
    intervalMinutes: number;
  };
}

export interface SourceOnboardingDryRunReport {
  discoveredUrls: number;
  parsedEvents: number;
  electronicEvents: number;
  rejectedEvents: number;
  completeEvents: number;
  incompleteEvents: number;
  possibleDuplicates: number;
  possibleEnrichments: number;
  newCandidates: number;
  parserConfidence: number;
  warnings: string[];
  risks: string[];
  sampleEvents: Array<{
    title: string;
    startDate?: string;
    venueName?: string;
    ticketUrl?: string;
    accepted: boolean;
    reason?: string;
  }>;
}

export interface SourceOnboardingJob {
  id: string;
  submittedUrl: string;
  normalizedUrl: string;
  hostname: string;
  status: SourceOnboardingStatus;
  detectedPlatform?: string;
  detectedFramework?: string;
  detectedSourceType?: string;
  confidence: number;
  discoveryResult?: {
    steps: DiscoveryEvidence[];
    warnings: string[];
  };
  generatedConfig?: DeclarativeSourceConfig;
  validationResult?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  dryRunReport?: SourceOnboardingDryRunReport;
  reviewNotes?: string;
  duplicateSourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceDiscoverRequest {
  url: string;
}

export interface SourceDiscoverResponse {
  job: SourceOnboardingJob;
}
