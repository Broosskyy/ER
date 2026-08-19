import type {
  OfficialLineupCandidate,
  RejectedOfficialCandidate,
} from '../types';
import {
  canonicalActKey,
  inferLineupEvidenceRole,
  isFloorOrStageHeader,
  isLineupBlockTerminator,
  isLineupIntroMarker,
  isNonLineupSectionHeader,
  isShowcaseLabelLine,
  normalizeLineupName,
  preferDisplayName,
  stripTimetableTimePrefix,
  stripVenueSuffix,
  validateOfficialLineupAct,
  type LineupValidationContext,
} from '../shared/lineup-normalization';

export {
  decodeHtmlEntities,
  isAcceptableOfficialLineupActName as isAcceptableOfficialLineupActNameShared,
  isAcceptableOfficialMediaLineupActName,
  isFloorOrStageHeader,
  isLineupIntroMarker,
  isNonLineupSectionHeader,
  isShowcaseLabelLine,
  isSuspectedFlyerArtifactName,
  normalizeLineupName,
  stripTimetableTimePrefix,
  stripVenueSuffix,
} from '../shared/lineup-normalization';

const BOOTSHAUS_LINEUP_VALIDATION_CONTEXT: LineupValidationContext = {
  additionalNoiseTerms: [
    'bootshaus mobile app',
    'bootshaus merchandise',
    'www.bootshaus.tv',
    'auenweg',
  ],
};

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

    if (inLineupBlock && isLineupBlockTerminator(text, BOOTSHAUS_LINEUP_VALIDATION_CONTEXT)) {
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

export function isAcceptableOfficialLineupActName(text: string): boolean {
  return validateOfficialLineupAct(text, 'structured_lineup_header', BOOTSHAUS_LINEUP_VALIDATION_CONTEXT)
    .accepted;
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
    const validation = validateOfficialLineupAct(
      act.rawText,
      act.blockType,
      BOOTSHAUS_LINEUP_VALIDATION_CONTEXT,
    );
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
    evidenceRole: inferLineupEvidenceRole(act.displayName, index),
    evidenceOrigin: 'official_text',
  }));

  return { lineupCandidates, rejectedCandidates };
}

function splitParenthesisAwareCommas(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of line) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    }

    if (char === ',' && depth === 0) {
      const trimmed = normalizeLineupName(current);
      if (trimmed) {
        parts.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trimmed = normalizeLineupName(current);
  if (trimmed) {
    parts.push(trimmed);
  }

  return parts;
}

export function blocksToParsedActs(
  blocks: LineupEvidenceBlock[],
): ParsedLineupAct[] {
  const acts: ParsedLineupAct[] = [];

  blocks.forEach((block, blockIndex) => {
    block.rawLines.forEach((line, lineIndex) => {
      const segments =
        block.blockType === 'structured_lineup_header' && line.includes(',')
          ? splitParenthesisAwareCommas(line)
          : [line];

      for (const [segmentIndex, segment] of segments.entries()) {
        acts.push({
          displayName: stripTimetableTimePrefix(segment),
          rawText: segment,
          evidenceRole: 'artist',
          blockType: block.blockType,
          blockIndex,
          lineIndex: lineIndex + segmentIndex * 0.01,
          confidence: block.confidence,
        });
      }
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
    const explicitActs = parseExplicitLineupSentences(paragraphs);
    if (explicitActs.length > 0) {
      return mergeOfficialLineupEvidence(explicitActs);
    }

    const residualActs: ParsedLineupAct[] = [];
    for (const [lineIndex, line] of paragraphs.entries()) {
      const validation = validateOfficialLineupAct(
        line,
        'floor_billing',
        BOOTSHAUS_LINEUP_VALIDATION_CONTEXT,
      );
      if (!validation.accepted) {
        continue;
      }
      residualActs.push({
        displayName: stripVenueSuffix(stripTimetableTimePrefix(line)),
        rawText: line,
        evidenceRole: 'artist',
        blockType: 'floor_billing',
        blockIndex: 0,
        lineIndex,
        confidence: 'high',
      });
    }

    if (residualActs.length > 0) {
      return mergeOfficialLineupEvidence(residualActs);
    }

    return { lineupCandidates: [], rejectedCandidates: [] };
  }

  return mergeOfficialLineupEvidence(blocksToParsedActs(split.lineupBlocks));
}
