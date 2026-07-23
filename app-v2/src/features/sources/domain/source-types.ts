export const SOURCE_TYPES = [
  'website',
  'api',
  'rss',
  'ical',
  'ticket_platform',
  'social',
  'manual',
  'unknown',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const PARSER_TYPES = [
  'html',
  'rss',
  'json',
  'ical',
  'api',
  'csv',
  'json-ld',
  'unknown',
] as const;

export type ParserType = (typeof PARSER_TYPES)[number];

export const ACQUISITION_STRATEGIES = ['manual', 'scheduled', 'webhook', 'future'] as const;

export type AcquisitionStrategy = (typeof ACQUISITION_STRATEGIES)[number];

export const POLLING_STRATEGIES = ['interval', 'cron', 'none'] as const;

export type PollingStrategy = (typeof POLLING_STRATEGIES)[number];

export function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

export function isParserType(value: string): value is ParserType {
  return (PARSER_TYPES as readonly string[]).includes(value);
}

export function isAcquisitionStrategy(value: string): value is AcquisitionStrategy {
  return (ACQUISITION_STRATEGIES as readonly string[]).includes(value);
}

export function isPollingStrategy(value: string): value is PollingStrategy {
  return (POLLING_STRATEGIES as readonly string[]).includes(value);
}

export const SOURCE_PRIORITY_MIN = 0;
export const SOURCE_PRIORITY_MAX = 100;
export const SOURCE_TRUST_MIN = 0;
export const SOURCE_TRUST_MAX = 100;
/** Neutral default trust level for new sources (not explicitly untrusted). */
export const SOURCE_DEFAULT_TRUST_SCORE = 50;
export const SOURCE_POLLING_INTERVAL_MIN_MINUTES = 5;
