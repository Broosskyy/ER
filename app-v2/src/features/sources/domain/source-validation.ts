import {
  ACQUISITION_STRATEGIES,
  isAcquisitionStrategy,
  isParserType,
  isPollingStrategy,
  isSourceType,
  PARSER_TYPES,
  POLLING_STRATEGIES,
  SOURCE_POLLING_INTERVAL_MIN_MINUTES,
  SOURCE_PRIORITY_MAX,
  SOURCE_PRIORITY_MIN,
  SOURCE_DEFAULT_TRUST_SCORE,
  SOURCE_TRUST_MAX,
  SOURCE_TRUST_MIN,
  SOURCE_TYPES,
} from '@/features/sources/domain/source-types';
import { isValidSourceSlug } from '@/features/sources/domain/source-slug';

export interface SourceInput {
  id?: string;
  slug?: string;
  displayName: string;
  description?: string;
  sourceType: string;
  baseUrl?: string;
  parserType: string;
  acquisitionStrategy: string;
  pollingStrategy?: string;
  pollingIntervalMinutes?: number;
  rateLimitPerHour?: number;
  priority: number;
  trustScore?: number;
  requiresAuthentication?: boolean;
  enabled?: boolean;
  archived?: boolean;
  notes?: string;
  website?: string;
  defaultTimezone?: string;
  reviewRequired?: boolean;
}

export interface ValidatedSourceInput {
  slug?: string;
  displayName: string;
  description?: string;
  sourceType: (typeof SOURCE_TYPES)[number];
  baseUrl?: string;
  parserType: (typeof PARSER_TYPES)[number];
  acquisitionStrategy: (typeof ACQUISITION_STRATEGIES)[number];
  pollingStrategy?: (typeof POLLING_STRATEGIES)[number];
  pollingIntervalMinutes?: number;
  rateLimitPerHour?: number;
  priority: number;
  trustScore: number;
  requiresAuthentication: boolean;
  enabled: boolean;
  archived: boolean;
  notes?: string;
  website?: string;
  defaultTimezone?: string;
  reviewRequired: boolean;
}

function normalizeUrl(value: string): string {
  return value.trim();
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateSourceInput(input: SourceInput): ValidatedSourceInput {
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error('Display name is required.');
  }

  if (displayName.length > 200) {
    throw new Error('Display name must be 200 characters or fewer.');
  }

  if (input.slug !== undefined && input.slug.trim() && !isValidSourceSlug(input.slug.trim())) {
    throw new Error('Slug must use lowercase letters, numbers, and hyphens.');
  }

  if (!isSourceType(input.sourceType)) {
    throw new Error(`Source type must be one of: ${SOURCE_TYPES.join(', ')}.`);
  }

  if (!isParserType(input.parserType)) {
    throw new Error(`Parser type must be one of: ${PARSER_TYPES.join(', ')}.`);
  }

  if (!isAcquisitionStrategy(input.acquisitionStrategy)) {
    throw new Error(`Acquisition strategy must be one of: ${ACQUISITION_STRATEGIES.join(', ')}.`);
  }

  if (input.pollingStrategy !== undefined && input.pollingStrategy !== '' && !isPollingStrategy(input.pollingStrategy)) {
    throw new Error(`Polling strategy must be one of: ${POLLING_STRATEGIES.join(', ')}.`);
  }

  if (input.priority < SOURCE_PRIORITY_MIN || input.priority > SOURCE_PRIORITY_MAX) {
    throw new Error(`Priority must be between ${SOURCE_PRIORITY_MIN} and ${SOURCE_PRIORITY_MAX}.`);
  }

  const trustScore = input.trustScore ?? SOURCE_DEFAULT_TRUST_SCORE;
  if (trustScore < SOURCE_TRUST_MIN || trustScore > SOURCE_TRUST_MAX) {
    throw new Error(`Trust score must be between ${SOURCE_TRUST_MIN} and ${SOURCE_TRUST_MAX}.`);
  }

  const baseUrl = input.baseUrl?.trim();
  if (baseUrl && !isValidHttpUrl(baseUrl)) {
    throw new Error('Base URL must be a valid http or https URL.');
  }

  const website = input.website?.trim();
  if (website && !isValidHttpUrl(website)) {
    throw new Error('Website must be a valid http or https URL.');
  }

  if (
    input.pollingIntervalMinutes !== undefined &&
    input.pollingIntervalMinutes < SOURCE_POLLING_INTERVAL_MIN_MINUTES
  ) {
    throw new Error(
      `Polling interval must be at least ${SOURCE_POLLING_INTERVAL_MIN_MINUTES} minutes when set.`,
    );
  }

  if (input.rateLimitPerHour !== undefined && input.rateLimitPerHour < 1) {
    throw new Error('Rate limit per hour must be at least 1 when set.');
  }

  const archived = input.archived ?? false;
  const enabled = archived ? false : (input.enabled ?? true);

  if (archived && input.enabled) {
    throw new Error('Archived sources cannot be enabled.');
  }

  return {
    slug: input.slug?.trim() || undefined,
    displayName,
    description: input.description?.trim() || undefined,
    sourceType: input.sourceType,
    baseUrl: baseUrl || undefined,
    parserType: input.parserType,
    acquisitionStrategy: input.acquisitionStrategy,
    pollingStrategy:
      input.pollingStrategy && input.pollingStrategy.trim()
        ? input.pollingStrategy
        : undefined,
    pollingIntervalMinutes: input.pollingIntervalMinutes,
    rateLimitPerHour: input.rateLimitPerHour,
    priority: input.priority,
    trustScore,
    requiresAuthentication: input.requiresAuthentication ?? false,
    enabled,
    archived,
    notes: input.notes?.trim() || undefined,
    website: website || undefined,
    defaultTimezone: input.defaultTimezone?.trim() || undefined,
    reviewRequired: input.reviewRequired ?? true,
  };
}
