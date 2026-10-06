import { extractEditorialDescription, classifyDescriptionParagraph } from './description-quality';
import {
  isFloorOrStageHeader,
  isLineupIntroMarker,
  isLineupMainInlineMarker,
  isLineupPlaceholderLine,
  normalizeLineupName,
} from './lineup-normalization';
import { parseDescriptionExplicitGenres } from './parse-description-genres';

export type StructuredFragmentCategory =
  | 'EDITORIAL'
  | 'STRUCTURED_LINEUP'
  | 'STRUCTURED_GENRE'
  | 'STRUCTURED_SCHEDULE'
  | 'STRUCTURED_TICKET'
  | 'LEGAL_BOILERPLATE'
  | 'PROMOTIONAL_METADATA'
  | 'MIXED'
  | 'UNKNOWN';

export interface StructuredContentFragment {
  text: string;
  category: StructuredFragmentCategory;
}

export interface StructuredContentProvenance {
  field: 'description' | 'lineup' | 'genre' | 'schedule' | 'ticket';
  sourceFragment: string;
  category: StructuredFragmentCategory;
}

export interface StructuredContentSeparationResult {
  rawContent: string;
  editorialText?: string;
  descriptionResidual?: string;
  lineupCandidates: string[];
  genreCandidates: string[];
  scheduleCandidates: string[];
  ticketCandidates: string[];
  metadataFragments: string[];
  rejectedFragments: Array<{ text: string; reason: string }>;
  fragments: StructuredContentFragment[];
  provenance: StructuredContentProvenance[];
  classification: 'PURE_STRUCTURED' | 'MIXED' | 'EDITORIAL_ONLY' | 'EMPTY';
}

const BULLET_SPLIT_PATTERN = /[●•▪◦|]\s*/;
const STAR_BULLET_SPLIT_PATTERN = /\s+\*\s+/;
const LINEUP_HEADER_PATTERN = /^(?:line\s*-?\s*up)\s*:?\s*/i;
const LINEUP_MAIN_HEADER_PATTERN = /^lineup\s+main(?:\s*\([^)]*\))?\s*:?\s*/i;
const ARTIST_SECTION_HEADER_PATTERN = /^(?:artists?|djs?|acts?)\s*:\s*/i;
const INLINE_LINEUP_PATTERN = /^(?:line\s*-?\s*up|artists?|djs?|acts?)\s*:\s*(.+)$/i;
const FLOOR_HOSTED_BY_PATTERN = /^(?:\d+(?:st|nd|rd|th)\s+)?(?:main|second|third|upper|lower|basement|outdoor)\s+floor(?:\s+hosted\s+by.*)?$/i;
const PROSE_TRANSITION_PATTERN =
  /\b(?:to assure|if you are affected|be aware of your own|safer space|dress\s*code|verkleide|garderobe)\b/i;
const SCHEDULE_HEADER_PATTERN = /^(?:schedule|timetable|programm|ablauf)\s*:?\s*/i;
const TICKET_HEADER_PATTERN = /^(?:tickets?|ticket\s*info|preise?)\s*:?\s*/i;
const HASHTAG_TOKEN_PATTERN = /#[\w-]+/g;

function isHashtagGenreOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.includes('#')) {
    return false;
  }
  const withoutHashtags = trimmed.replace(HASHTAG_TOKEN_PATTERN, '').replace(/\s+/g, '').trim();
  return withoutHashtags.length === 0;
}

function extractHashtagGenres(text: string): string[] {
  const tags = text.match(HASHTAG_TOKEN_PATTERN) ?? [];
  const corpus = tags
    .map((tag) => tag.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' '))
    .join(' ');
  return parseDescriptionExplicitGenres(corpus);
}

function acceptArtistSegment(segment: string): string | undefined {
  const trimmed = normalizeLineupName(segment);
  if (!trimmed || trimmed.length < 2 || trimmed.length > 80) {
    return undefined;
  }
  if (isLineupPlaceholderLine(trimmed)) {
    return undefined;
  }
  if (isHashtagGenreOnly(trimmed)) {
    return undefined;
  }
  if (/^#/.test(trimmed)) {
    return undefined;
  }
  if (/^(?:line\s*-?\s*up|artists?|djs?|acts?)$/i.test(trimmed)) {
    return undefined;
  }
  if (/^main\s*\([^)]*\)$/i.test(trimmed) || isLineupMainInlineMarker(trimmed)) {
    return undefined;
  }
  if (
    /\b(?:present|celebrate|featuring|invite you|witness|upcoming album|never-seen-before|official launch)\b/i.test(
      trimmed,
    )
  ) {
    return undefined;
  }
  if (trimmed.split(/\s+/).length > 8 && !/\bb2b\b/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function splitArtistList(segment: string): string[] {
  const trimmed = normalizeLineupName(segment);
  if (!trimmed) {
    return [];
  }
  if (/\bb2b\b/i.test(trimmed)) {
    const accepted = acceptArtistSegment(trimmed);
    return accepted ? [accepted] : [];
  }
  if (trimmed.includes(',') && !/\bb2b\b/i.test(trimmed)) {
    return trimmed
      .split(/\s*,\s*/)
      .map((part) => acceptArtistSegment(part))
      .filter(Boolean) as string[];
  }
  const accepted = acceptArtistSegment(trimmed);
  return accepted ? [accepted] : [];
}

function preprocessRunTogetherDescription(raw: string): string {
  let text = raw;
  text = text.replace(/([a-z])(Lineup\s+Main)/gi, '$1\n$2');
  text = text.replace(/(Lineup\s+Main\s*\([^)]*\))/gi, '\n$1\n');
  text = text.replace(
    /\b((?:MAIN|SECOND|THIRD|UPPER|LOWER|BASEMENT|OUTDOOR)\s+FLOOR(?:\s+HOSTED\s+BY[^*]+)?)/gi,
    '\n$1\n',
  );
  text = text.replace(/\bLINE\s*-?\s*UP\s*:/gi, '\nLINEUP:\n');
  if ((text.match(/\s\*\s/g) ?? []).length >= 3) {
    text = text.replace(/\s*\*\s+/g, '\n* ');
  }
  return text;
}

function truncateAtProseTransition(segment: string): string {
  const match = segment.match(PROSE_TRANSITION_PATTERN);
  if (match?.index != null && match.index > 0) {
    return segment.slice(0, match.index).trim();
  }
  const gluedProse = segment.match(/to assure\b/i);
  if (gluedProse?.index != null && gluedProse.index > 0) {
    return segment.slice(0, gluedProse.index).trim();
  }
  return segment;
}

function stripTrailingProseGlue(segment: string): string {
  const glued = segment.match(/^(.{2,}?)(?:to assure\b.*)$/i);
  if (glued?.[1]) {
    return glued[1].trim();
  }
  return segment;
}

function cleanStarBulletSegment(segment: string): string {
  return stripTrailingProseGlue(stripFloorSuffix(segment.replace(/^\*\s*/, '').trim()));
}

function stripFloorSuffix(segment: string): string {
  const floorIndex = segment.search(
    /\s{1,}(?:SECOND|THIRD|MAIN|UPPER|LOWER|BASEMENT|OUTDOOR)\s+FLOOR\b/i,
  );
  if (floorIndex > 0) {
    return segment.slice(0, floorIndex).trim();
  }
  return segment;
}

function parseStarBulletArtistBlock(body: string): string[] {
  const artists: string[] = [];
  const truncated = truncateAtProseTransition(body);
  const segments = truncated.split(STAR_BULLET_SPLIT_PATTERN).map((part) => cleanStarBulletSegment(part)).filter(Boolean);
  for (const segment of segments) {
    if (FLOOR_HOSTED_BY_PATTERN.test(segment) || isFloorOrStageHeader(segment)) {
      continue;
    }
    if (/^(?:second|third|main|upper|lower)\s+floor/i.test(segment)) {
      continue;
    }
    if (/hosted\s+by/i.test(segment) && !/\bb2b\b/i.test(segment)) {
      continue;
    }
    for (const artist of splitArtistList(segment)) {
      artists.push(artist);
    }
  }
  return [...new Set(artists)];
}

function extractEmbeddedLineupSections(raw: string): { artists: string[]; consumedSpans: Array<{ start: number; end: number }> } {
  const artists: string[] = [];
  const consumedSpans: Array<{ start: number; end: number }> = [];
  const inlineMainPattern = /lineup\s+main(?:\s*\([^)]*\))?\s*:?\s*/gi;
  for (const match of raw.matchAll(inlineMainPattern)) {
    const start = match.index ?? 0;
    const bodyStart = start + match[0].length;
    const body = raw.slice(bodyStart);
    const parsed = parseStarBulletArtistBlock(body);
    if (parsed.length > 0) {
      artists.push(...parsed);
      const proseBreak = body.search(PROSE_TRANSITION_PATTERN);
      const gluedBreak = body.search(/to assure\b/i);
      const breakAt = [proseBreak, gluedBreak].filter((index) => index > 0).sort((a, b) => a - b)[0];
      const end = breakAt != null ? bodyStart + breakAt : bodyStart + body.length;
      consumedSpans.push({ start, end });
    }
  }

  const floorSections = raw.match(
    /\b(?:MAIN|SECOND|THIRD|UPPER|LOWER|BASEMENT|OUTDOOR)\s+FLOOR(?:\s+HOSTED\s+BY[^*\n]+)?[\s\S]*?(?=(?:\b(?:MAIN|SECOND|THIRD|UPPER|LOWER|BASEMENT|OUTDOOR)\s+FLOOR\b)|$)/gi,
  );
  for (const section of floorSections ?? []) {
    const parsed = parseStarBulletArtistBlock(section);
    artists.push(...parsed);
  }

  return { artists: [...new Set(artists)], consumedSpans };
}

function stripExtractedLineupFromRaw(raw: string): string {
  let text = raw;
  text = text.replace(/lineup\s+main(?:\s*\([^)]*\))?\s*:?[\s\S]*?(?=to assure\b|$)/gi, ' ');
  text = text.replace(/\n\*\s+[^\n]+/g, '\n');
  text = text.replace(
    /\b(?:SECOND|THIRD|MAIN|UPPER|LOWER|BASEMENT|OUTDOOR)\s+FLOOR(?:\s+HOSTED\s+BY[^\n]*)?/gi,
    ' ',
  );
  return text.replace(/\s+/g, ' ').trim();
}

function parseCondensedLineupBody(body: string): { genres: string[]; artists: string[] } {
  const genres: string[] = [];
  const artists: string[] = [];
  const normalizedBody = truncateAtProseTransition(body.replace(/\s+/g, ' ').trim());
  if ((normalizedBody.match(STAR_BULLET_SPLIT_PATTERN) ?? []).length >= 2) {
    artists.push(...parseStarBulletArtistBlock(normalizedBody));
    return { genres: [...new Set(genres)], artists: [...new Set(artists)] };
  }
  const segments = normalizedBody.split(BULLET_SPLIT_PATTERN).map((part) => part.trim()).filter(Boolean);
  const parts = segments.length > 1 ? segments : normalizedBody.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);

  for (const segment of parts.length > 0 ? parts : [normalizedBody]) {
    if (isHashtagGenreOnly(segment)) {
      genres.push(...extractHashtagGenres(segment));
      continue;
    }
    const inlineTags = segment.match(HASHTAG_TOKEN_PATTERN) ?? [];
    if (inlineTags.length > 0) {
      genres.push(...extractHashtagGenres(inlineTags.join(' ')));
      const withoutTags = segment.replace(HASHTAG_TOKEN_PATTERN, '').replace(/\s+/g, ' ').trim();
      if (withoutTags) {
        for (const artist of splitArtistList(withoutTags)) {
          artists.push(artist);
        }
      }
      continue;
    }
    for (const artist of splitArtistList(segment)) {
      artists.push(artist);
    }
  }

  return {
    genres: [...new Set(genres)],
    artists: [...new Set(artists)],
  };
}

function parseLineOrientedLineupBlock(
  lines: string[],
  rejectedFragments: StructuredContentSeparationResult['rejectedFragments'],
): { genres: string[]; artists: string[] } {
  const genres: string[] = [];
  const artists: string[] = [];
  for (const line of lines) {
    const trimmed = normalizeLineupName(line);
    if (!trimmed) {
      continue;
    }
    if (isLineupPlaceholderLine(trimmed)) {
      rejectedFragments.push({ text: trimmed, reason: 'lineup_placeholder' });
      continue;
    }
    if (isHashtagGenreOnly(trimmed)) {
      genres.push(...extractHashtagGenres(trimmed));
      continue;
    }
    for (const artist of splitArtistList(trimmed)) {
      artists.push(artist);
    }
  }
  return {
    genres: [...new Set(genres)],
    artists: [...new Set(artists)],
  };
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitLinesWithinParagraph(paragraph: string): string[] {
  return paragraph
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeBulletParagraph(paragraph: string): string {
  return paragraph
    .split(/\n+/)
    .map((line) => line.replace(BULLET_SPLIT_PATTERN, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function isLineupSectionHeader(line: string): boolean {
  const trimmed = normalizeLineupName(line);
  return (
    isLineupIntroMarker(trimmed) ||
    LINEUP_HEADER_PATTERN.test(trimmed) ||
    LINEUP_MAIN_HEADER_PATTERN.test(trimmed) ||
    ARTIST_SECTION_HEADER_PATTERN.test(trimmed) ||
    isLineupMainInlineMarker(trimmed)
  );
}

function pushUnique(target: string[], values: string[]): void {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

export function separateStructuredEventContent(rawContent?: string): StructuredContentSeparationResult {
  const raw = preprocessRunTogetherDescription(rawContent?.trim() ?? '');
  const result: StructuredContentSeparationResult = {
    rawContent: raw,
    lineupCandidates: [],
    genreCandidates: [],
    scheduleCandidates: [],
    ticketCandidates: [],
    metadataFragments: [],
    rejectedFragments: [],
    fragments: [],
    provenance: [],
    classification: 'EMPTY',
  };

  if (!raw) {
    return result;
  }

  const embeddedLineup = extractEmbeddedLineupSections(raw);
  let contentForParagraphs = raw;
  if (embeddedLineup.artists.length > 0) {
    pushUnique(result.lineupCandidates, embeddedLineup.artists);
    for (const artist of embeddedLineup.artists) {
      result.fragments.push({ text: artist, category: 'STRUCTURED_LINEUP' });
      result.provenance.push({ field: 'lineup', sourceFragment: artist, category: 'STRUCTURED_LINEUP' });
    }
    contentForParagraphs = stripExtractedLineupFromRaw(raw);
  }

  const ticketLead = contentForParagraphs.match(/^(tickets?\s+online\b[^.!?\n]{0,120})/i);
  if (ticketLead?.[1]) {
    result.ticketCandidates.push(ticketLead[1].trim());
    result.fragments.push({ text: ticketLead[1].trim(), category: 'STRUCTURED_TICKET' });
    contentForParagraphs = contentForParagraphs.slice(ticketLead[1].length).trim();
  }

  const editorialParagraphs: string[] = [];
  let inLineupBlock = false;
  let lineupBuffer: string[] = [];

  const flushLineupBuffer = (): void => {
    if (lineupBuffer.length === 0) {
      return;
    }
    const parsed = parseLineOrientedLineupBlock(lineupBuffer, result.rejectedFragments);
    pushUnique(result.lineupCandidates, parsed.artists);
    pushUnique(result.genreCandidates, parsed.genres);
    for (const artist of parsed.artists) {
      result.fragments.push({ text: artist, category: 'STRUCTURED_LINEUP' });
      result.provenance.push({ field: 'lineup', sourceFragment: artist, category: 'STRUCTURED_LINEUP' });
    }
    for (const genre of parsed.genres) {
      result.fragments.push({ text: genre, category: 'STRUCTURED_GENRE' });
      result.provenance.push({ field: 'genre', sourceFragment: genre, category: 'STRUCTURED_GENRE' });
    }
    lineupBuffer = [];
    inLineupBlock = false;
  };

  const wholeLineMatch = raw.match(/^line\s*-?\s*up\s*:\s*(.+)$/i);
  if (wholeLineMatch?.[1] && !raw.includes('\n\n') && !raw.includes('\n')) {
    const parsed = parseCondensedLineupBody(wholeLineMatch[1]);
    pushUnique(result.lineupCandidates, parsed.artists);
    pushUnique(result.genreCandidates, parsed.genres);
    result.classification = parsed.artists.length + parsed.genres.length > 0 ? 'PURE_STRUCTURED' : 'EMPTY';
    result.descriptionResidual = undefined;
    return result;
  }

  for (const paragraph of splitParagraphs(contentForParagraphs)) {
    const normalizedParagraph = normalizeBulletParagraph(paragraph);
    const inlineLineup = normalizedParagraph.match(INLINE_LINEUP_PATTERN);
    if (inlineLineup?.[1] && normalizedParagraph.length < 400) {
      const parsed = parseCondensedLineupBody(inlineLineup[1]);
      pushUnique(result.lineupCandidates, parsed.artists);
      pushUnique(result.genreCandidates, parsed.genres);
      result.fragments.push({ text: normalizedParagraph, category: 'STRUCTURED_LINEUP' });
      continue;
    }

    if (SCHEDULE_HEADER_PATTERN.test(normalizedParagraph)) {
      flushLineupBuffer();
      result.scheduleCandidates.push(normalizedParagraph.replace(SCHEDULE_HEADER_PATTERN, '').trim());
      result.fragments.push({ text: normalizedParagraph, category: 'STRUCTURED_SCHEDULE' });
      continue;
    }

    if (TICKET_HEADER_PATTERN.test(normalizedParagraph)) {
      flushLineupBuffer();
      result.ticketCandidates.push(normalizedParagraph.replace(TICKET_HEADER_PATTERN, '').trim());
      result.fragments.push({ text: normalizedParagraph, category: 'STRUCTURED_TICKET' });
      continue;
    }

    const lines = splitLinesWithinParagraph(normalizedParagraph);
    if (lines.length === 0) {
      continue;
    }

    if (lines.length === 1 && isLineupSectionHeader(lines[0]!)) {
      const body = lines[0]!
        .replace(LINEUP_HEADER_PATTERN, '')
        .replace(LINEUP_MAIN_HEADER_PATTERN, '')
        .replace(ARTIST_SECTION_HEADER_PATTERN, '')
        .trim();
      if (body) {
        const parsed = parseCondensedLineupBody(body);
        pushUnique(result.lineupCandidates, parsed.artists);
        pushUnique(result.genreCandidates, parsed.genres);
        result.fragments.push({ text: lines[0]!, category: 'STRUCTURED_LINEUP' });
      } else {
        inLineupBlock = true;
      }
      continue;
    }

    let paragraphHandled = false;
    for (const line of lines) {
      if (isLineupSectionHeader(line)) {
        flushLineupBuffer();
        const inlineBody = line
          .replace(LINEUP_HEADER_PATTERN, '')
          .replace(ARTIST_SECTION_HEADER_PATTERN, '')
          .trim();
        if (inlineBody) {
          const parsed = parseCondensedLineupBody(inlineBody);
          pushUnique(result.lineupCandidates, parsed.artists);
          pushUnique(result.genreCandidates, parsed.genres);
          result.fragments.push({ text: line, category: 'STRUCTURED_LINEUP' });
        } else {
          inLineupBlock = true;
        }
        paragraphHandled = true;
        continue;
      }
      if (inLineupBlock) {
        lineupBuffer.push(line);
        paragraphHandled = true;
        continue;
      }
      const category = classifyDescriptionParagraph(line);
      if (category === 'LINEUP_CONTEXT') {
        const parsed = parseCondensedLineupBody(line.replace(LINEUP_HEADER_PATTERN, ''));
        pushUnique(result.lineupCandidates, parsed.artists);
        pushUnique(result.genreCandidates, parsed.genres);
        result.fragments.push({ text: line, category: 'STRUCTURED_LINEUP' });
        paragraphHandled = true;
        continue;
      }
      if (
        category === 'ADMISSION_POLICY' ||
        category === 'TICKET_POLICY' ||
        category === 'LEGAL' ||
        category === 'PRIVACY' ||
        category === 'CHECKOUT_BOILERPLATE'
      ) {
        result.metadataFragments.push(line);
        result.fragments.push({ text: line, category: 'LEGAL_BOILERPLATE' });
        paragraphHandled = true;
        continue;
      }
      editorialParagraphs.push(line);
      paragraphHandled = true;
    }

    if (!paragraphHandled) {
      const category = classifyDescriptionParagraph(normalizedParagraph);
      if (category === 'LINEUP_CONTEXT') {
        const parsed = parseCondensedLineupBody(
          normalizedParagraph.replace(LINEUP_HEADER_PATTERN, '').replace(ARTIST_SECTION_HEADER_PATTERN, ''),
        );
        pushUnique(result.lineupCandidates, parsed.artists);
        pushUnique(result.genreCandidates, parsed.genres);
        result.fragments.push({ text: normalizedParagraph, category: 'STRUCTURED_LINEUP' });
      } else if (
        category === 'ADMISSION_POLICY' ||
        category === 'TICKET_POLICY' ||
        category === 'LEGAL' ||
        category === 'PRIVACY' ||
        category === 'CHECKOUT_BOILERPLATE'
      ) {
        result.metadataFragments.push(normalizedParagraph);
        result.fragments.push({ text: normalizedParagraph, category: 'LEGAL_BOILERPLATE' });
      } else {
        editorialParagraphs.push(normalizedParagraph);
      }
    }
  }

  flushLineupBuffer();

  const joinedEditorial = editorialParagraphs.join('\n\n').trim();
  const cleanedEditorial = extractEditorialDescription(joinedEditorial) ?? joinedEditorial;
  result.editorialText = cleanedEditorial.length > 0 ? cleanedEditorial : undefined;
  result.descriptionResidual = result.editorialText;

  if (result.lineupCandidates.length + result.genreCandidates.length > 0 && !result.editorialText) {
    result.classification = 'PURE_STRUCTURED';
  } else if (result.lineupCandidates.length + result.genreCandidates.length > 0 && result.editorialText) {
    result.classification = 'MIXED';
  } else if (result.editorialText) {
    result.classification = 'EDITORIAL_ONLY';
  } else {
    result.classification = 'EMPTY';
  }

  return result;
}

export interface StructuredDescriptionLeakage {
  lineupLeakage: boolean;
  genreLeakage: boolean;
  ticketLeakage: boolean;
  scheduleLeakage: boolean;
  legalBoilerplate: boolean;
  placeholderLeakage: boolean;
  recoverable: boolean;
}

export function detectStructuredDescriptionLeakage(description?: string): StructuredDescriptionLeakage {
  const clean = description?.trim();
  if (!clean) {
    return {
      lineupLeakage: false,
      genreLeakage: false,
      ticketLeakage: false,
      scheduleLeakage: false,
      legalBoilerplate: false,
      placeholderLeakage: false,
      recoverable: false,
    };
  }

  const separated = separateStructuredEventContent(clean);
  const residual = separated.descriptionResidual?.trim() ?? '';
  const lineupLeakage =
    separated.lineupCandidates.length > 0 &&
    (LINEUP_HEADER_PATTERN.test(clean) || /●/.test(clean) || /\bline\s*-?\s*up\b/i.test(clean));
  const genreLeakage =
    separated.genreCandidates.length > 0 &&
    (HASHTAG_TOKEN_PATTERN.test(clean) || /\b(?:techno|trance|house|hardstyle)\b/i.test(clean)) &&
    clean !== residual;
  const ticketLeakage = TICKET_HEADER_PATTERN.test(clean) || separated.ticketCandidates.length > 0;
  const scheduleLeakage = SCHEDULE_HEADER_PATTERN.test(clean) || separated.scheduleCandidates.length > 0;
  const legalBoilerplate = separated.metadataFragments.length > 0;
  const placeholderLeakage = /\b(?:tba|tbc|tbd|folgt|coming soon|more tba)\b/i.test(clean);

  return {
    lineupLeakage,
    genreLeakage,
    ticketLeakage,
    scheduleLeakage,
    legalBoilerplate,
    placeholderLeakage,
    recoverable:
      lineupLeakage ||
      genreLeakage ||
      ticketLeakage ||
      scheduleLeakage ||
      legalBoilerplate ||
      (clean.length > 0 && residual !== clean),
  };
}

export function publishedDescriptionStructuredLeakage(description?: string): boolean {
  return detectStructuredDescriptionLeakage(description).recoverable;
}
