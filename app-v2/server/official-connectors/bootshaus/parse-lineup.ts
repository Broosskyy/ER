import type {
  OfficialLineupCandidate,
  RejectedOfficialCandidate,
} from '../types';

export type LineupEvidenceBlockType =
  | 'structured_lineup_header'
  | 'artists_section'
  | 'floor_billing'
  | 'timetable'
  | 'explicit_sentence';

export type LineupEvidenceConfidence = 'high' | 'medium';

export interface LineupEvidenceBlock {
  blockType: LineupEvidenceBlockType;
  headerText?: string;
  rawLines: string[];
  confidence: LineupEvidenceConfidence;
}

export type LineupSentenceKind = 'lineup_list' | 'billing_note';

export interface ParsedLineupAct {
  displayName: string;
  rawText: string;
  evidenceRole: OfficialLineupCandidate['evidenceRole'];
  blockType: LineupEvidenceBlockType;
  blockIndex: number;
  lineIndex: number;
  confidence: LineupEvidenceConfidence;
  sentenceKind?: LineupSentenceKind;
}

const INVALID_LINEUP_PATTERNS = [
  /^tickets?$/i,
  /^and more$/i,
  /^tba$/i,
  /^more tba$/i,
  /^\.{2,}\s*more tba$/i,
  /^\*+\s*$/,
  /^bootshaus$/i,
  /^auenweg/i,
  /^https?:\/\//i,
  /ticket\.io/i,
  /^\d{1,2}:\d{2}\s*-/i,
  /^till late$/i,
  /^line\s*-?\s*up$/i,
  /^lineup$/i,
];

const FLOOR_STAGE_HEADER_PATTERN =
  /^(?:MAIN\s*FLOOR|MAINFLOOR|UPPER\s*FLOOR|UPPERFLOOR|LOWER\s*FLOOR|LOWERFLOOR|1ST\s*FLOOR|BASEMENT|OUTDOOR|BLCKBX|DREHEREI|MAIN|UPPER|LOWER)(?:\s*:|)?$/i;

const LINEUP_INTRO_MARKER_PATTERN = /^(?:line\s*-?\s*up|artists)\s*:?\s*$/i;
const DJ_LINEUP_INTRO_MARKER_PATTERN = /^dj\s+line\s*-?\s*up\s*:?\s*$/i;
const NON_LINEUP_SECTION_HEADER_PATTERN =
  /^(?:ELEMENTS|STYLE|INFO|INFOS|DETAILS|PROGRAM|LIVE THE|PUBLIC TRANSPORT INFO)\s*:?$/i;
const NON_LINEUP_BOILERPLATE_PATTERN =
  /public transport|travel pass|passengers wishing|valid for \d|inbound travel|return journey|vrs network/i;
const DECOR_BULLET_PATTERN = /^\*[^*].*\*$/;
const PROSE_LINEUP_MAX_LENGTH = 100;
const TIMETABLE_TIME_PREFIX = /^\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*/;
const DECORATIVE_SEPARATOR_PATTERN = /^[▔_\-\s]{6,}$/;

function isLineupBlockTerminator(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return true;
  }

  if (DECORATIVE_SEPARATOR_PATTERN.test(normalized)) {
    return true;
  }

  return (
    /einlass ab|age for admission|bootshaus mobile app|bootshaus merchandise|www\.bootshaus\.tv/i.test(
      normalized,
    ) || /^https?:\/\//i.test(normalized)
  );
}

function normalizeLineupName(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function inferEvidenceRole(
  displayName: string,
  billingOrder: number,
): OfficialLineupCandidate['evidenceRole'] {
  if (
    displayName.includes('&') ||
    /\bx\b/i.test(displayName) ||
    /\bb2b\b/i.test(displayName) ||
    /\bvs\.?\b/i.test(displayName)
  ) {
    return 'compound_act';
  }

  return billingOrder === 0 ? 'headliner' : 'artist';
}

export function isLineupIntroMarker(text: string): boolean {
  const normalized = normalizeLineupName(text);
  return (
    LINEUP_INTRO_MARKER_PATTERN.test(normalized) || DJ_LINEUP_INTRO_MARKER_PATTERN.test(normalized)
  );
}

export function isNonLineupSectionHeader(text: string): boolean {
  return NON_LINEUP_SECTION_HEADER_PATTERN.test(normalizeLineupName(text));
}

export function isFloorOrStageHeader(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }

  if (isLineupIntroMarker(normalized) || isNonLineupSectionHeader(normalized)) {
    return false;
  }

  if (FLOOR_STAGE_HEADER_PATTERN.test(normalized)) {
    return true;
  }

  if (/^blckbx\b/i.test(normalized)) {
    return true;
  }

  if (/^dreherei\b/i.test(normalized)) {
    return true;
  }

  return /^[A-Z0-9][A-Z0-9\s/&-]{1,40}:$/.test(normalized.toUpperCase());
}

export function isShowcaseLabelLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  return (
    /showcase$/i.test(normalized) ||
    /^.+\sby\s.+\s(?:label|friends|showcase)\b/i.test(normalized) ||
    /^blckbx\s+by\s/i.test(normalized)
  );
}

export function isSuspectedFlyerArtifactName(text: string): boolean {
  const normalized = normalizeLineupName(text);
  return /^[A-Z0-9]{2,5}-[A-Z0-9]{1,3}$/.test(normalized) && !normalized.includes(' ');
}

export function stripTimetableTimePrefix(text: string): string {
  return normalizeLineupName(text.replace(TIMETABLE_TIME_PREFIX, ''));
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

export function stripVenueSuffix(text: string): string {
  const decoded = decodeHtmlEntities(text);
  const venueMatch = decoded.match(/^(.+?)\s*<[^>]+>\s*$/);
  return normalizeLineupName(venueMatch?.[1] ?? decoded);
}

function splitListSegment(segment: string): string[] {
  return segment
    .split(/\s*,\s*|\s+und\s+|\s+and\s+/i)
    .map((part) => normalizeLineupName(part))
    .filter(Boolean);
}

export function parseExplicitLineupSentences(paragraphs: string[]): ParsedLineupAct[] {
  const acts: ParsedLineupAct[] = [];

  for (const paragraph of paragraphs) {
    const text = normalizeLineupName(paragraph);
    if (!text) {
      continue;
    }

    const lineupVereint = text.match(
      /(?:das\s+)?line\s*-?\s*up\s+vereint\s+mit\s+(.+?)(?:\s+zahlreiche\b|\s+des\b|\s+im\b|$)/i,
    );
    if (lineupVereint?.[1]) {
      for (const name of splitListSegment(lineupVereint[1])) {
        acts.push({
          displayName: name,
          rawText: name,
          evidenceRole: 'artist',
          blockType: 'explicit_sentence',
          blockIndex: 0,
          lineIndex: acts.length,
          confidence: 'medium',
          sentenceKind: 'lineup_list',
        });
      }
    }

    const lineupStehen = text.match(/im\s+line\s*-?\s*up\s+stehen\s+(.+?)(?:\.|$)/i);
    if (lineupStehen?.[1]) {
      for (const name of splitListSegment(lineupStehen[1])) {
        acts.push({
          displayName: name,
          rawText: name,
          evidenceRole: 'artist',
          blockType: 'explicit_sentence',
          blockIndex: 0,
          lineIndex: acts.length,
          confidence: 'medium',
          sentenceKind: 'lineup_list',
        });
      }
    }

    const ergaenzt = text.match(
      /erg[äa]nzt\s+wird\s+(?:es|das\s+line\s*-?\s*up)\s+durch\s+(.+?)(?:,|\s+die\b|\s+der\b|\s+das\b|$)/i,
    );
    if (ergaenzt?.[1]) {
      for (const name of splitListSegment(ergaenzt[1])) {
        acts.push({
          displayName: name,
          rawText: name,
          evidenceRole: 'artist',
          blockType: 'explicit_sentence',
          blockIndex: 0,
          lineIndex: acts.length,
          confidence: 'medium',
          sentenceKind: 'lineup_list',
        });
      }
    }

    if (lineupVereint || lineupStehen || ergaenzt) {
      continue;
    }

    const openingNight = text.match(/opening\s+the\s+night\s+is\s+.+?'s\s+([^,.]+)/i);
    if (openingNight?.[1]) {
      const name = normalizeLineupName(openingNight[1]);
      acts.push({
        displayName: name,
        rawText: name,
        evidenceRole: 'artist',
        blockType: 'explicit_sentence',
        blockIndex: 0,
        lineIndex: acts.length,
        confidence: 'medium',
        sentenceKind: 'billing_note',
      });
      continue;
    }

    const supportBy = text.match(/support\s+by\s+([^,.]+)/i);
    if (supportBy?.[1]) {
      const name = normalizeLineupName(supportBy[1]);
      acts.push({
        displayName: name,
        rawText: name,
        evidenceRole: 'artist',
        blockType: 'explicit_sentence',
        blockIndex: 0,
        lineIndex: acts.length,
        confidence: 'medium',
        sentenceKind: 'billing_note',
      });
    }
  }

  return acts;
}

export function classifyDescriptionLine(
  line: string,
  inLineupBlock: boolean,
): 'description' | 'lineup_marker' | 'floor_header' | 'lineup_act' | 'boilerplate' {
  const normalized = normalizeLineupName(line);
  if (!normalized) {
    return 'boilerplate';
  }

  if (isLineupIntroMarker(normalized)) {
    return 'lineup_marker';
  }

  if (inLineupBlock || isFloorOrStageHeader(normalized)) {
    if (isFloorOrStageHeader(normalized) || isShowcaseLabelLine(normalized)) {
      return 'floor_header';
    }
    if (isLineupIntroMarker(normalized)) {
      return 'lineup_marker';
    }
    return 'lineup_act';
  }

  return 'description';
}

export function splitDescriptionAndStructuredLineup(paragraphs: string[]): {
  descriptionParagraphs: string[];
  lineupBlocks: LineupEvidenceBlock[];
  lineupNotAnnounced: boolean;
} {
  const descriptionParagraphs: string[] = [];
  const lineupBlocks: LineupEvidenceBlock[] = [];
  let inLineupBlock = false;
  let currentBlock: LineupEvidenceBlock | null = null;
  let lineupNotAnnounced = false;

  const pushCurrentBlock = (): void => {
    if (currentBlock && currentBlock.rawLines.length > 0) {
      lineupBlocks.push(currentBlock);
    }
    currentBlock = null;
  };

  for (const paragraph of paragraphs) {
    const text = normalizeLineupName(paragraph);
    if (!text) {
      continue;
    }

    if (/line\s*-?\s*up.*bald|lineup.*soon|wird bald angekündigt|coming soon/i.test(text)) {
      lineupNotAnnounced = true;
      inLineupBlock = false;
      pushCurrentBlock();
      continue;
    }

    if (inLineupBlock && isLineupBlockTerminator(text)) {
      inLineupBlock = false;
      pushCurrentBlock();
      descriptionParagraphs.push(text);
      continue;
    }

    if (isLineupIntroMarker(text)) {
      inLineupBlock = true;
      pushCurrentBlock();
      currentBlock = {
        blockType: 'structured_lineup_header',
        headerText: text,
        rawLines: [],
        confidence: 'high',
      };
      continue;
    }

    if (isNonLineupSectionHeader(text)) {
      inLineupBlock = false;
      pushCurrentBlock();
      descriptionParagraphs.push(text);
      continue;
    }

    if (isFloorOrStageHeader(text) || isShowcaseLabelLine(text)) {
      inLineupBlock = true;
      pushCurrentBlock();
      currentBlock = {
        blockType: 'floor_billing',
        headerText: text,
        rawLines: [],
        confidence: 'high',
      };
      continue;
    }

    if (inLineupBlock) {
      if (isShowcaseLabelLine(text)) {
        pushCurrentBlock();
        currentBlock = {
          blockType: 'floor_billing',
          headerText: text,
          rawLines: [],
          confidence: 'high',
        };
        continue;
      }

      if (!currentBlock) {
        currentBlock = {
          blockType: 'floor_billing',
          rawLines: [],
          confidence: 'high',
        };
      }
      currentBlock.rawLines.push(text);
      continue;
    }

    descriptionParagraphs.push(text);
  }

  pushCurrentBlock();

  return {
    descriptionParagraphs,
    lineupBlocks,
    lineupNotAnnounced,
  };
}

function validateLineupAct(
  rawText: string,
  blockType: LineupEvidenceBlockType,
): { accepted: boolean; reason?: string } {
  const displayName = stripVenueSuffix(stripTimetableTimePrefix(rawText));
  if (!displayName) {
    return { accepted: false, reason: 'empty_lineup_entry' };
  }

  if (isFloorOrStageHeader(displayName) || isShowcaseLabelLine(displayName)) {
    return { accepted: false, reason: 'floor_or_boilerplate' };
  }

  if (/^STYLE\s*:/i.test(displayName)) {
    return { accepted: false, reason: 'style_metadata' };
  }

  if (DECOR_BULLET_PATTERN.test(displayName) || /^\/\//.test(displayName)) {
    return { accepted: false, reason: 'decor_bullet' };
  }

  if (DECORATIVE_SEPARATOR_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'invalid_lineup_entry' };
  }

  if (displayName.length > PROSE_LINEUP_MAX_LENGTH) {
    return { accepted: false, reason: 'prose_not_lineup' };
  }

  if (NON_LINEUP_BOILERPLATE_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'non_lineup_boilerplate' };
  }

  if (INVALID_LINEUP_PATTERNS.some((pattern) => pattern.test(displayName))) {
    return { accepted: false, reason: 'invalid_lineup_entry' };
  }

  if (blockType === 'structured_lineup_header' && isSuspectedFlyerArtifactName(displayName)) {
    return { accepted: false, reason: 'suspected_flyer_artifact' };
  }

  return { accepted: true };
}

function canonicalActKey(name: string): string {
  return normalizeLineupName(name).toLowerCase();
}

function preferDisplayName(current: string, next: string): string {
  const currentHasUpper = /[A-Z]/.test(current);
  const nextHasUpper = /[A-Z]/.test(next);
  if (nextHasUpper && !currentHasUpper) {
    return next;
  }
  if (current.length >= next.length) {
    return current;
  }
  return next;
}

const BLOCK_PRIORITY: Record<LineupEvidenceBlockType, number> = {
  structured_lineup_header: 1,
  artists_section: 1,
  floor_billing: 2,
  timetable: 3,
  explicit_sentence: 4,
};

export function mergeOfficialLineupEvidence(sources: ParsedLineupAct[]): {
  lineupCandidates: OfficialLineupCandidate[];
  rejectedCandidates: RejectedOfficialCandidate[];
} {
  const rejectedCandidates: RejectedOfficialCandidate[] = [];
  const validatedActs: ParsedLineupAct[] = [];

  for (const act of sources) {
    const validation = validateLineupAct(act.rawText, act.blockType);
    if (!validation.accepted) {
      rejectedCandidates.push({ rawText: act.rawText, reason: validation.reason ?? 'rejected' });
      continue;
    }
    validatedActs.push({
      ...act,
      displayName: stripVenueSuffix(stripTimetableTimePrefix(act.rawText)),
    });
  }

  const sentenceActs = validatedActs.filter((act) => act.blockType === 'explicit_sentence');
  const lineupListSentenceActs = sentenceActs.filter((act) => act.sentenceKind === 'lineup_list');
  const billingNoteActs = sentenceActs.filter((act) => act.sentenceKind === 'billing_note');
  const structuredActs = validatedActs.filter((act) => act.blockType !== 'explicit_sentence');

  const orderedActs: ParsedLineupAct[] = [];
  const seen = new Set<string>();

  const appendAct = (act: ParsedLineupAct): void => {
    const key = canonicalActKey(act.displayName);
    const existingIndex = orderedActs.findIndex((entry) => canonicalActKey(entry.displayName) === key);
    if (existingIndex >= 0) {
      orderedActs[existingIndex] = {
        ...orderedActs[existingIndex]!,
        displayName: preferDisplayName(orderedActs[existingIndex]!.displayName, act.displayName),
      };
      rejectedCandidates.push({ rawText: act.rawText, reason: 'duplicate_lineup_entry' });
      return;
    }
    seen.add(key);
    orderedActs.push(act);
  };

  if (lineupListSentenceActs.length > 0) {
    const structuredByKey = new Map(
      structuredActs.map((act) => [canonicalActKey(act.displayName), act] as const),
    );

    for (const sentenceAct of lineupListSentenceActs) {
      const key = canonicalActKey(sentenceAct.displayName);
      const structuredMatch = structuredByKey.get(key);
      appendAct(
        structuredMatch
          ? { ...structuredMatch, displayName: preferDisplayName(structuredMatch.displayName, sentenceAct.displayName) }
          : sentenceAct,
      );
    }

    const structuredSorted = [...structuredActs].sort((left, right) => {
      const priorityDelta = BLOCK_PRIORITY[left.blockType] - BLOCK_PRIORITY[right.blockType];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      if (left.blockIndex !== right.blockIndex) {
        return left.blockIndex - right.blockIndex;
      }
      return left.lineIndex - right.lineIndex;
    });

    for (const structuredAct of structuredSorted) {
      if (!seen.has(canonicalActKey(structuredAct.displayName))) {
        appendAct(structuredAct);
      }
    }
  } else {
    const structuredSorted = [...structuredActs].sort((left, right) => {
      const priorityDelta = BLOCK_PRIORITY[left.blockType] - BLOCK_PRIORITY[right.blockType];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      if (left.blockIndex !== right.blockIndex) {
        return left.blockIndex - right.blockIndex;
      }
      return left.lineIndex - right.lineIndex;
    });

    for (const act of structuredSorted) {
      appendAct(act);
    }
  }

  for (const billingAct of billingNoteActs) {
    if (!seen.has(canonicalActKey(billingAct.displayName))) {
      appendAct(billingAct);
    }
  }

  const lineupCandidates: OfficialLineupCandidate[] = orderedActs.map((act, index) => ({
    displayName: act.displayName,
    rawText: act.rawText,
    billingOrder: index,
    evidenceRole: inferEvidenceRole(act.displayName, index),
    evidenceOrigin: 'official_text',
  }));

  return { lineupCandidates, rejectedCandidates };
}

export function isAcceptableOfficialLineupActName(text: string): boolean {
  return validateLineupAct(text, 'structured_lineup_header').accepted;
}

export function isAcceptableOfficialMediaLineupActName(text: string): boolean {
  return validateLineupAct(text, 'floor_billing').accepted;
}

export function blocksToParsedActs(
  blocks: LineupEvidenceBlock[],
): ParsedLineupAct[] {
  const acts: ParsedLineupAct[] = [];

  blocks.forEach((block, blockIndex) => {
    block.rawLines.forEach((line, lineIndex) => {
      acts.push({
        displayName: stripTimetableTimePrefix(line),
        rawText: line,
        evidenceRole: 'artist',
        blockType: block.blockType,
        blockIndex,
        lineIndex,
        confidence: block.confidence,
      });
    });
  });

  return acts;
}

export function parseBootshausLineupParagraphs(paragraphs: string[]): {
  lineupCandidates: OfficialLineupCandidate[];
  rejectedCandidates: RejectedOfficialCandidate[];
} {
  const split = splitDescriptionAndStructuredLineup(paragraphs);
  if (split.lineupBlocks.length === 0 && paragraphs.length > 0) {
    return mergeOfficialLineupEvidence(
      blocksToParsedActs([
        {
          blockType: 'floor_billing',
          rawLines: paragraphs,
          confidence: 'high',
        },
      ]),
    );
  }

  return mergeOfficialLineupEvidence(blocksToParsedActs(split.lineupBlocks));
}
