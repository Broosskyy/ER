import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

export type BillingRelationship = 'b2b' | 'f2f' | 'vs' | 'live' | 'support' | 'hosted_by';

export interface ExpandedLineupArtist {
  displayName: string;
  isB2b?: boolean;
  isF2f?: boolean;
  isLiveSet?: boolean;
  role?: string;
}

const BILLING_SPLIT_PATTERN = /\s+(?:b2b|f2f|vs\.?)\s+/gi;
const LINE_BREAK_PATTERN = /<br\s*\/?>/gi;
const BLOCK_BREAK_PATTERN = /<\/(?:p|li|div|tr)>\s*<(?:p|li|div|tr)[^>]*>/gi;

const ROLE_PREFIX_PATTERN = /^(live|support|hosted\s+by)\s*:?\s*/i;

function titleCasePreserve(token: string): string {
  return token.trim().replace(/\s+/g, ' ');
}

function detectRelationship(token: string): BillingRelationship | undefined {
  const lower = token.toLowerCase().replace(/\./g, '');
  if (lower.includes('b2b')) return 'b2b';
  if (lower.includes('f2f')) return 'f2f';
  if (lower.includes('vs')) return 'vs';
  return undefined;
}

function extractBillingDelimiters(body: string): BillingRelationship[] {
  const relationships: BillingRelationship[] = [];
  const pattern = /\s+(b2b|f2f|vs\.?)\s+/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    relationships.push(detectRelationship(match[1] ?? '') ?? 'b2b');
  }
  return relationships;
}

/** Split HTML/plain lineup blocks into logical lines without collapsing boundaries. */
export function splitLineupTextIntoLines(text: string): string[] {
  if (!text?.trim()) {
    return [];
  }

  const withBreaks = text
    .replace(LINE_BREAK_PATTERN, '\n')
    .replace(BLOCK_BREAK_PATTERN, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n');

  const decoded = decodeHtmlEntities(withBreaks);
  const withoutScripts = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const plain = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();

  return plain
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Expand one lineup line into individual artists, preserving billing semantics. */
export function expandLineupLine(line: string): ExpandedLineupArtist[] {
  let body = line.trim();
  if (!body) {
    return [];
  }

  let isLiveSet = false;
  const rolePrefix = body.match(ROLE_PREFIX_PATTERN);
  if (rolePrefix) {
    const prefix = rolePrefix[1]?.toLowerCase() ?? '';
    if (prefix === 'live') {
      isLiveSet = true;
    }
    if (prefix === 'support' || prefix === 'hosted by') {
      return [];
    }
    body = body.slice(rolePrefix[0].length).trim();
  }

  const splitParts = body.split(BILLING_SPLIT_PATTERN);
  if (splitParts.length <= 1) {
    const name = titleCasePreserve(body);
    if (!name) {
      return [];
    }
    return [
      {
        displayName: name,
        isLiveSet: isLiveSet || undefined,
        role: isLiveSet ? 'live' : undefined,
      },
    ];
  }

  const relationships = extractBillingDelimiters(body);
  const relationship = relationships[0] ?? 'b2b';
  const artists = splitParts.map(titleCasePreserve).filter(Boolean);

  if (artists.length < 2) {
    return artists.map((displayName) => ({ displayName }));
  }

  return artists.map((displayName) => ({
    displayName,
    isB2b: relationship === 'b2b' ? true : undefined,
    isF2f: relationship === 'f2f' ? true : undefined,
    isLiveSet: isLiveSet || undefined,
    role: relationship === 'b2b' ? 'b2b' : relationship === 'f2f' ? 'f2f' : relationship,
  }));
}

/** Expand a token that may contain line breaks or billing pairs into artist names. */
export function expandLineupArtistName(name: string): string[] {
  const lines = splitLineupTextIntoLines(name);
  const sourceLines = lines.length > 0 ? lines : [name];
  return sourceLines.flatMap((line) => expandLineupLine(line).map((entry) => entry.displayName));
}

/** Expand and dedupe lineup names while preserving order. */
export function expandSegmentedLineupNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    for (const expanded of expandLineupArtistName(name)) {
      const key = normalizeMatchText(expanded);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(expanded);
    }
  }

  return result;
}

/** Detect artist entities that incorrectly contain multiple performers. */
export function isCollapsedLineupArtistName(name: string | undefined): boolean {
  if (!name?.trim()) {
    return false;
  }
  if (/\n/.test(name)) {
    return true;
  }

  const billingTokenCount = (name.match(/\b(?:b2b|f2f|vs\.?)\b/gi) ?? []).length;
  if (billingTokenCount === 0) {
    return false;
  }

  const expanded = expandLineupArtistName(name);
  return expanded.length > 1;
}

export function countBillingRelationshipsInName(name: string): number {
  return (name.match(/\b(?:b2b|f2f|vs\.?)\b/gi) ?? []).length;
}
