/**
 * Source categories for admin classification and filtering.
 */
export const SOURCE_CATEGORIES = [
  'website',
  'api',
  'ticket_provider',
  'rss',
  'ical',
  'json_ld',
  'html',
  'partner_feed',
  'manual',
  'social',
  'other',
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

export function isSourceCategory(value: string): value is SourceCategory {
  return (SOURCE_CATEGORIES as readonly string[]).includes(value);
}

export function inferSourceCategory(input: {
  category?: string;
  sourceType?: string;
  parserType?: string;
  connectorKey?: string;
}): SourceCategory {
  if (input.category && isSourceCategory(input.category)) {
    return input.category;
  }
  if (input.connectorKey === 'open_data_api' || input.connectorKey === 'partner_feed') {
    return 'partner_feed';
  }
  if (input.connectorKey === 'ical_feed' || input.sourceType === 'ical') {
    return 'ical';
  }
  if (input.sourceType === 'rss' || input.parserType === 'rss') {
    return 'rss';
  }
  if (input.parserType === 'json-ld' || input.parserType === 'json_ld') {
    return 'json_ld';
  }
  if (input.parserType === 'html') {
    return 'html';
  }
  if (input.sourceType === 'api' || input.parserType === 'api') {
    return 'api';
  }
  if (input.sourceType === 'ticket_platform') {
    return 'ticket_provider';
  }
  if (input.sourceType === 'social') {
    return 'social';
  }
  if (input.sourceType === 'manual') {
    return 'manual';
  }
  if (input.sourceType === 'website') {
    return 'website';
  }
  return 'other';
}
