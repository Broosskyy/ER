import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import {
  evaluateArtistCandidate,
  filterArtistCandidatesThroughGate,
} from '@/features/events/domain/artist-candidate-quality-gate';
import {
  isLineupBlobArtistName,
  isLineupPlaceholderArtist,
} from '@/features/events/domain/lineup-artist-quality';
import { normalizeCanonicalGenreLabels } from '@/features/events/formatting/canonical-genre-normalizer';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

/** Compact identity key for lineup dedup (spacing / harmless punctuation). */
export function compactLineupArtistIdentityKey(name: string): string {
  return normalizeMatchText(name).replace(/[^a-z0-9]/g, '');
}

export function dedupeLineupEvidenceEntries(entries: LineupEvidenceEntry[]): LineupEvidenceEntry[] {
  const seen = new Set<string>();
  const result: LineupEvidenceEntry[] = [];
  for (const entry of entries) {
    const trimmed = entry.displayName.trim();
    if (!trimmed || isLineupPlaceholderArtist(trimmed) || isLineupBlobArtistName(trimmed)) {
      continue;
    }
    const gate = evaluateArtistCandidate({ name: trimmed, sourceField: 'lineup' });
    if (gate.decision === 'invalid') {
      continue;
    }
    const key = compactLineupArtistIdentityKey(trimmed);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ ...entry, displayName: trimmed, sortOrder: result.length });
  }
  return result;
}

const DESCRIPTION_CONTAMINATION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /bootshaus\s+mobile\s+app/i, reason: 'mobile_app_promotion' },
  { pattern: /bit\.ly\//i, reason: 'promotional_link' },
  { pattern: /snash\.com/i, reason: 'merchandise_promotion' },
  { pattern: /einlass\s+ab\s+\d+/i, reason: 'age_restriction_footer' },
  { pattern: /age\s+for\s+admission/i, reason: 'age_restriction_footer' },
  { pattern: /\bauenweg\s+\d+/i, reason: 'venue_address_footer' },
  { pattern: /\b51063\b/, reason: 'venue_address_footer' },
  { pattern: /www\.bootshaus/i, reason: 'provider_homepage_footer' },
  { pattern: /^events\b/i, reason: 'navigation_chrome' },
  { pattern: />\s*line-?up/i, reason: 'lineup_block_leak' },
  { pattern: /zum\s+inhalt\s+springen/i, reason: 'navigation_chrome' },
  { pattern: /verg[uü]nstigten\s+tickets\s+im\s+shop/i, reason: 'ticket_promotion' },
  { pattern: /hauen\s+wir\s+euch/i, reason: 'lineup_not_announced_promo' },
  { pattern: /https?:\/\//i, reason: 'raw_url' },
  { pattern: /\bmain\s*floor\s*:/i, reason: 'lineup_block_leak' },
  { pattern: /▔{4,}/, reason: 'decorative_divider' },
];

const LINEUP_NOT_ANNOUNCED_PATTERNS = [
  /\bhauen\s+wir\s+euch\b/i,
  /\blineup\s+(?:folgt|coming\s+soon|tba)\b/i,
  /\bartists?\s+(?:folgen|coming)\b/i,
  /\bmehr\s+infos?\s+bald\b/i,
];

const COMPOUND_ACT_SPLIT_PATTERNS = [
  /\b\d+\s+[A-Z]+\s+&\s+[A-Z]+\b/,
];

export function detectDescriptionContamination(description: string | undefined): {
  contaminated: boolean;
  reasons: string[];
} {
  if (!description?.trim()) {
    return { contaminated: false, reasons: [] };
  }
  const reasons: string[] = [];
  for (const { pattern, reason } of DESCRIPTION_CONTAMINATION_PATTERNS) {
    if (pattern.test(description)) {
      reasons.push(reason);
    }
  }
  return { contaminated: reasons.length > 0, reasons };
}

export function detectDescriptionSpacingErrors(description: string | undefined): boolean {
  if (!description?.trim()) {
    return false;
  }
  const normalized = description.replace(/\bmain\s*floor\.(?=[A-Z])/gi, 'mainfloor. ');
  if (/[a-z][A-Z]{2,}/.test(normalized)) {
    return true;
  }
  if (/[A-Z]{2,}[a-z][A-Z]/.test(normalized)) {
    return true;
  }
  return false;
}

export function isLineupChromeDescription(description: string): boolean {
  const trimmed = description.trim();
  if (!trimmed) {
    return true;
  }
  if (/^>\s*line-?up/i.test(trimmed)) {
    return true;
  }
  if (/\n\s*">\s*line-?up/i.test(trimmed) || /">\s*line-?up/i.test(trimmed)) {
    return true;
  }
  if (
    /^events\b/i.test(trimmed) &&
    /\bline\s*up\s*:/i.test(trimmed) &&
    !/\bmain\s*floor\s*:/i.test(trimmed)
  ) {
    return true;
  }
  if (/^line\s*up\s*:/i.test(trimmed) && !/\bmain\s*floor\s*:/i.test(trimmed)) {
    const body = trimmed.replace(/^line\s*up\s*:\s*/i, '').trim();
    if (trimmed.length < 120 || !/[.!?]/.test(body)) {
      return true;
    }
  }
  return false;
}

/** Remove short venue-floor hype paragraphs before the editorial body. */
export function stripVenueStageMarketingIntro(description: string): string {
  let text = description.trim();
  if (!text) {
    return '';
  }

  const paragraphs = text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    const first = paragraphs[0]!;
    const rest = paragraphs.slice(1);
    const isVenueFloorHype =
      /\bmain\s*floor\b/i.test(first) &&
      /\b(let['’]s\s+go|we['’]re\s+back)\b/i.test(first) &&
      first.length < 160;
    if (isVenueFloorHype) {
      text = rest.join('\n\n').trim();
    }
  }

  const dateLeadIn = text.match(/\bOn\s+[A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?,/);
  if (dateLeadIn?.index && dateLeadIn.index > 0) {
    const prefix = text.slice(0, dateLeadIn.index);
    if (/\bmain\s*floor\b/i.test(prefix) || /\blet['’]s\s+go\b/i.test(prefix)) {
      text = text.slice(dateLeadIn.index).trim();
    }
  }

  return text.trim();
}

export function stripNonEditorialLineupFromDescription(description: string): string {
  let text = stripVenueStageMarketingIntro(description.trim());
  if (!text) {
    return '';
  }

  const lineupStart = text.search(/\b(?:line\s*up|line-up)\s*:|\.main\s*floor\s*:/i);
  if (lineupStart >= 0) {
    text = text.slice(0, lineupStart).trim();
  }

  text = text
    .replace(/\.main\s*floor\s*:.*$/is, '')
    .replace(/\bmain\s*floor\s*:.*$/is, '')
    .trim();

  return text;
}

export function detectLineupNotAnnouncedSignals(textBlocks: string[]): boolean {
  const joined = textBlocks.join('\n');
  return LINEUP_NOT_ANNOUNCED_PATTERNS.some((pattern) => pattern.test(joined));
}

export function extractPresByHeadlinerFromTitle(title: string): string | undefined {
  const trimmed = title.trim();
  const match = trimmed.match(/^(.+?)\s+pres\.?\s+by\s+/i);
  if (!match?.[1]) {
    return undefined;
  }
  const headliner = match[1].trim();
  if (!headliner || /\bbootshaus\b/i.test(headliner)) {
    return undefined;
  }
  const gate = evaluateArtistCandidate({ name: headliner, sourceField: 'title' });
  if (gate.decision === 'invalid') {
    return undefined;
  }
  return headliner;
}

const TITLE_PRESENTED_SEGMENT_REJECT = [
  /\b20\d{2}\b/,
  /\bhalloween\b/i,
  /\bnye\b/i,
  /\bweekender\b/i,
  /\bfestival\b/i,
  /\bclosing\b/i,
  /\bsommerfest\b/i,
  /\bairport\s+session\b/i,
  /\(.*\)/,
  /\blet'?s\b/i,
  /@/,
];

function isRejectedPresentedTitleSegment(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) {
    return true;
  }
  return TITLE_PRESENTED_SEGMENT_REJECT.some((pattern) => pattern.test(trimmed));
}

/** Split presented artists from titles like "LOONYLAND pres. LUCA DANTE & 2 ENGEL & CHARLIE". */
export function extractPresentedArtistsFromTitle(title: string): string[] {
  const trimmed = title.trim();
  const presMatch = trimmed.match(/\bpres\.?\s+(.+)$/i);
  if (!presMatch?.[1]) {
    return [];
  }

  const segment = presMatch[1].trim();
  if (/^by\s+/i.test(segment) || isRejectedPresentedTitleSegment(segment)) {
    return [];
  }

  const artists: string[] = [];
  let rest = segment;

  while (rest.length > 0) {
    const compoundMatch = rest.match(/^\d+\s+[A-Z]+(?:\s+[A-Z]+)*\s+&\s+[A-Z]+/);
    if (compoundMatch) {
      artists.push(compoundMatch[0].trim());
      rest = rest.slice(compoundMatch[0].length).replace(/^[\s,&+]+/, '').trim();
      continue;
    }

    const ampIndex = rest.search(/\s+&\s+/);
    if (ampIndex > 0) {
      const beforeAmp = rest.slice(0, ampIndex).trim();
      const afterAmp = rest.slice(ampIndex + 3).trim();
      const afterCompound = afterAmp.match(
        /^\d+\s+[A-Z][A-Z0-9]*(?:\s+[A-Z][A-Z0-9]*)*\s+&\s+[A-Z][A-Z0-9]*(?:\s+[A-Z][A-Z0-9]*)*/,
      );
      if (afterCompound) {
        if (beforeAmp && !isRejectedPresentedTitleSegment(beforeAmp)) {
          artists.push(beforeAmp);
        }
        if (!isRejectedPresentedTitleSegment(afterCompound[0].trim())) {
          artists.push(afterCompound[0].trim());
        }
        rest = afterAmp.slice(afterCompound[0].length).replace(/^[\s,&+]+/, '').trim();
        continue;
      }
      if (beforeAmp && !isRejectedPresentedTitleSegment(beforeAmp)) {
        artists.push(beforeAmp);
      }
      rest = afterAmp;
      continue;
    }

    if (rest.trim()) {
      if (!isRejectedPresentedTitleSegment(rest)) {
        artists.push(rest.trim());
      }
    }
    break;
  }

  return filterArtistCandidatesThroughGate(
    artists
      .filter((name) => !isRejectedPresentedTitleSegment(name))
      .filter((name) => !isLineupBlobArtistName(name)),
    { sourceField: 'title' },
  );
}

export function isInvalidStructuredLineupValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isLineupPlaceholderArtist(trimmed) || isLineupBlobArtistName(trimmed)) {
    return true;
  }
  if (/^>\s*line-?up/i.test(trimmed)) {
    return true;
  }
  if (/^hauen\s+wir\s+euch/i.test(trimmed)) {
    return true;
  }
  if (/^genres?$/i.test(trimmed)) {
    return true;
  }
  if (/tickets?\s+im\s+shop/i.test(trimmed)) {
    return true;
  }
  return evaluateArtistCandidate({ name: trimmed, sourceField: 'lineup' }).decision === 'invalid';
}

export function extractStructuredRunningOrderNames(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) {
    return [];
  }

  const names: string[] = [];
  const sources = [
    (metadata.textualEnrichment as Record<string, unknown> | undefined)?.runningOrder,
    metadata.runningOrder,
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) {
      continue;
    }
    for (const entry of source) {
      const displayName =
        typeof entry === 'string' ? entry : (entry as { displayName?: string }).displayName;
      if (!displayName?.trim() || isInvalidStructuredLineupValue(displayName)) {
        continue;
      }
      names.push(displayName.trim());
    }
  }

  return names;
}

export function normalizeOfficialStructuredGenres(genreLabels: string[] | undefined): string[] | undefined {
  if (!genreLabels?.length) {
    return undefined;
  }
  const normalized = normalizeCanonicalGenreLabels(
    genreLabels.filter((label) => label.trim().length > 0),
  );
  return normalized.length > 0 ? normalized : undefined;
}

export function detectCompoundActSplitRisk(
  sourceText: string,
  lineupNames: string[],
): boolean {
  for (const pattern of COMPOUND_ACT_SPLIT_PATTERNS) {
    const match = sourceText.match(pattern);
    if (!match?.[0]) {
      continue;
    }
    const compound = match[0].trim();
    const compoundKey = compactLineupArtistIdentityKey(compound);
    const hasWholeCompound = lineupNames.some(
      (name) => compactLineupArtistIdentityKey(name) === compoundKey,
    );
    if (!hasWholeCompound) {
      const parts = compound.split(/\s+&\s+/);
      if (parts.length > 1 && parts.every((part) => lineupNames.some((name) => name.includes(part.trim())))) {
        return true;
      }
    }
  }
  return false;
}

export function hasDuplicateLineupNames(lineupNames: string[]): boolean {
  const seen = new Set<string>();
  for (const name of lineupNames) {
    const key = compactLineupArtistIdentityKey(name);
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}
