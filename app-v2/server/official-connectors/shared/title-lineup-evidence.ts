import type { OfficialLineupCandidate, RejectedOfficialCandidate } from '../types';
import {
  canonicalActKey,
  normalizeLineupName,
  validateOfficialLineupAct,
  type LineupValidationContext,
} from './lineup-normalization';
import { isContextNoiseTerm } from './media-evidence-context';

export interface TitleLineupEvidenceInput {
  eventTitle: string;
  organizerLabel?: string;
  validationContext?: LineupValidationContext;
}

export interface TitleLineupEvidenceResult {
  candidates: OfficialLineupCandidate[];
  rejectedCandidates: RejectedOfficialCandidate[];
  showTitleFragmentKeys: Set<string>;
}

const SHOW_TITLE_DESCRIPTOR_PATTERN =
  /\b(?:festival|halloween|nye|weekender|sessions?|rave|paint|splash|night|tour|edition|showcase|closing|sommerfest|madness|changes|everything|live|world)\b/i;
const PRESENTER_SPLIT_PATTERN = /\s+pres\.?\s+|\s+presents\s+/i;
const LIVE_AT_PATTERN = /\s+live\s+at\s+/i;
const WITH_PATTERN = /\s+with\s+/i;

function cleanTitleText(title: string): string {
  return normalizeLineupName(title.replace(/[!?]+$/g, '').trim());
}

function isOrganizerOrVenueSegment(
  segment: string,
  organizerLabel: string | undefined,
  validationContext?: LineupValidationContext,
): boolean {
  const normalized = canonicalActKey(segment);
  if (!normalized) {
    return true;
  }

  const mediaContext = validationContext?.mediaContext;
  if (mediaContext && isContextNoiseTerm(segment, mediaContext)) {
    return true;
  }

  if (organizerLabel) {
    const organizerKey = canonicalActKey(organizerLabel);
    if (organizerKey && (normalized === organizerKey || normalized.includes(organizerKey))) {
      return true;
    }
  }

  if (mediaContext) {
    const subsegments = segment.split(/\s*(?:&|\+|,)\s*/).map((part) => normalizeLineupName(part));
    if (
      subsegments.length > 1 &&
      subsegments.every((part) => part && isContextNoiseTerm(part, mediaContext))
    ) {
      return true;
    }
  }

  return false;
}

function looksLikeShowTitle(segment: string): boolean {
  const normalized = normalizeLineupName(segment);
  if (!normalized) {
    return true;
  }

  if (SHOW_TITLE_DESCRIPTOR_PATTERN.test(normalized)) {
    return true;
  }

  const words = normalized
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, '').toLowerCase())
    .filter((word) => word.length > 2);

  if (words.length >= 2 && words.every((word) => SHOW_TITLE_DESCRIPTOR_PATTERN.test(word))) {
    return true;
  }

  return false;
}

function collectShowFragmentKeys(segment: string): string[] {
  return segment
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, '').toLowerCase())
    .filter((word) => word.length > 2);
}

function acceptTitleArtist(
  displayName: string,
  rawText: string,
  validationContext?: LineupValidationContext,
): { accepted: boolean; reason?: string } {
  const validation = validateOfficialLineupAct(displayName, 'official_title', validationContext);
  if (!validation.accepted) {
    return validation;
  }
  if (looksLikeShowTitle(displayName)) {
    return { accepted: false, reason: 'show_title_not_artist' };
  }
  return { accepted: true };
}

function pushCandidate(
  candidates: OfficialLineupCandidate[],
  seen: Set<string>,
  rejected: RejectedOfficialCandidate[],
  displayName: string,
  rawText: string,
  validationContext?: LineupValidationContext,
): void {
  const validation = acceptTitleArtist(displayName, rawText, validationContext);
  if (!validation.accepted) {
    rejected.push({ rawText, reason: validation.reason ?? 'title_artist_rejected' });
    return;
  }

  const key = canonicalActKey(displayName);
  if (seen.has(key)) {
    rejected.push({ rawText, reason: 'duplicate_lineup_entry' });
    return;
  }

  seen.add(key);
  candidates.push({
    displayName,
    rawText,
    billingOrder: candidates.length,
    evidenceRole: 'headliner',
    evidenceOrigin: 'official_title',
  });
}

function extractArtistFromPresenterRight(
  rightSegment: string,
  validationContext?: LineupValidationContext,
): string | undefined {
  let core = cleanTitleText(rightSegment);
  core = core.replace(/\s*-\s*LIVE\s*-?\s*/gi, ' ').trim();
  core = core.replace(/\s+@\s+.+$/i, '').trim();

  if (!core || looksLikeShowTitle(core)) {
    return undefined;
  }

  const validation = acceptTitleArtist(core, core, validationContext);
  return validation.accepted ? core : undefined;
}

function extractFromPresenterPattern(
  title: string,
  organizerLabel: string | undefined,
  validationContext: LineupValidationContext | undefined,
  candidates: OfficialLineupCandidate[],
  seen: Set<string>,
  rejected: RejectedOfficialCandidate[],
  showTitleFragmentKeys: Set<string>,
): void {
  const match = title.match(/^(.+?)\s+pres\.?\s+(.+)$/i) ?? title.match(/^(.+?)\s+presents\s+(.+)$/i);
  if (!match) {
    return;
  }

  const left = cleanTitleText(match[1]!);
  const right = cleanTitleText(match[2]!);
  for (const fragment of collectShowFragmentKeys(right)) {
    showTitleFragmentKeys.add(fragment);
  }

  if (isOrganizerOrVenueSegment(left, organizerLabel, validationContext)) {
    const artist = extractArtistFromPresenterRight(right, validationContext);
    if (artist) {
      pushCandidate(candidates, seen, rejected, artist, `${left} pres. ${artist}`, validationContext);
    }
    return;
  }

  pushCandidate(candidates, seen, rejected, left, left, validationContext);
}

function extractFromLiveAtPattern(
  title: string,
  validationContext: LineupValidationContext | undefined,
  candidates: OfficialLineupCandidate[],
  seen: Set<string>,
  rejected: RejectedOfficialCandidate[],
): void {
  const parts = title.split(LIVE_AT_PATTERN);
  if (parts.length !== 2) {
    return;
  }

  const left = cleanTitleText(parts[0]!);
  const right = cleanTitleText(parts[1]!);
  if (!left || isOrganizerOrVenueSegment(left, undefined, validationContext)) {
    return;
  }

  const mediaContext = validationContext?.mediaContext;
  if (mediaContext && isContextNoiseTerm(right, mediaContext)) {
    pushCandidate(candidates, seen, rejected, left, title, validationContext);
  }
}

function extractFromAtVenuePattern(
  title: string,
  validationContext: LineupValidationContext | undefined,
  candidates: OfficialLineupCandidate[],
  seen: Set<string>,
  rejected: RejectedOfficialCandidate[],
): void {
  const match = title.match(/^(.+?)\s+@\s+(.+)$/i);
  if (!match) {
    return;
  }

  const left = cleanTitleText(match[1]!);
  const right = cleanTitleText(match[2]!);
  const mediaContext = validationContext?.mediaContext;
  if (!left || !mediaContext || !isContextNoiseTerm(right, mediaContext)) {
    return;
  }

  const withoutShowSuffix = left.replace(/\s*-\s*LIVE\s*-?\s*$/i, '').trim();
  if (!withoutShowSuffix || looksLikeShowTitle(withoutShowSuffix)) {
    return;
  }

  pushCandidate(candidates, seen, rejected, withoutShowSuffix, title, validationContext);
}

function extractFromWithPattern(
  title: string,
  validationContext: LineupValidationContext | undefined,
  candidates: OfficialLineupCandidate[],
  seen: Set<string>,
  rejected: RejectedOfficialCandidate[],
): void {
  const parts = title.split(WITH_PATTERN);
  if (parts.length !== 2) {
    return;
  }

  const right = cleanTitleText(parts[1]!);
  if (!right || looksLikeShowTitle(right)) {
    return;
  }

  pushCandidate(candidates, seen, rejected, right, title, validationContext);
}

export function extractVerifiedTitleLineupCandidates(
  input: TitleLineupEvidenceInput,
): TitleLineupEvidenceResult {
  const candidates: OfficialLineupCandidate[] = [];
  const rejectedCandidates: RejectedOfficialCandidate[] = [];
  const showTitleFragmentKeys = new Set<string>();
  const seen = new Set<string>();
  const title = cleanTitleText(input.eventTitle);

  if (!title) {
    return { candidates, rejectedCandidates, showTitleFragmentKeys };
  }

  extractFromPresenterPattern(
    title,
    input.organizerLabel,
    input.validationContext,
    candidates,
    seen,
    rejectedCandidates,
    showTitleFragmentKeys,
  );
  extractFromLiveAtPattern(title, input.validationContext, candidates, seen, rejectedCandidates);
  extractFromAtVenuePattern(title, input.validationContext, candidates, seen, rejectedCandidates);
  extractFromWithPattern(title, input.validationContext, candidates, seen, rejectedCandidates);

  return {
    candidates: candidates.map((candidate, index) => ({
      ...candidate,
      billingOrder: index,
    })),
    rejectedCandidates,
    showTitleFragmentKeys,
  };
}

export function mergeTitleLineupCandidates(
  lineupCandidates: OfficialLineupCandidate[],
  titleCandidates: OfficialLineupCandidate[],
): OfficialLineupCandidate[] {
  const merged = [...lineupCandidates];
  const seen = new Set(merged.map((act) => canonicalActKey(act.displayName)));

  for (const titleAct of titleCandidates) {
    const key = canonicalActKey(titleAct.displayName);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({
      ...titleAct,
      billingOrder: merged.length,
    });
  }

  return merged;
}
