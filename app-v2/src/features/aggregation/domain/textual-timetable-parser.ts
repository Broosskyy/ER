import { expandLineupLine } from '@/features/aggregation/domain/lineup-billing-parser';
import { decodeHtmlEntities, stripHtml } from '@/features/import/normalization/text-normalizer';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import type { RunningOrderEntry, TimetableSlotEntry } from '@/features/aggregation/domain/event-structured-detail';

const SECTION_HEADERS =
  /(?:timetable|running\s+order|stage\s+schedule|play\s+times?|line[\s-]?up)\s*:?\s*/i;

const STOP_SECTION =
  /(?:\n\s*(?:location|venue|ort|tickets?|einlass|doors|faq|info|sponsor|presented\s+by)\s*:)/i;

const TIME_LINE_PATTERN =
  /^(\d{1,2}[:.]\d{2})\s*[-–]?\s*(\d{1,2}[:.]\d{2})?\s+(.+)$/i;

const STAGE_LINE_PATTERN =
  /^(?:stage|floor|room)\s*(\d+|[A-Z]+)\s*:?\s*(.+)$/i;

function splitLines(block: string): string[] {
  return block
    .split(/\n|<br\s*\/?>/i)
    .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean);
}

function extractSectionBlock(description: string): string | undefined {
  const plain = stripHtml(decodeHtmlEntities(description));
  const headerMatch = plain.match(SECTION_HEADERS);
  if (!headerMatch || headerMatch.index === undefined) {
    return undefined;
  }
  const start = headerMatch.index + headerMatch[0].length;
  const tail = plain.slice(start);
  const stop = tail.search(STOP_SECTION);
  return (stop === -1 ? tail : tail.slice(0, stop)).trim();
}

/** Build running order entries when only artist order / stage grouping is available. */
export function extractRunningOrderFromDescriptionText(
  description: string | undefined,
  source = 'description_text',
): RunningOrderEntry[] | undefined {
  const block = description ? extractSectionBlock(description) : undefined;
  if (!block) {
    return undefined;
  }

  const entries: RunningOrderEntry[] = [];
  let sortOrder = 0;

  for (const line of splitLines(block)) {
    const stageMatch = line.match(STAGE_LINE_PATTERN);
    if (stageMatch) {
      const stage = stageMatch[1];
      const artists = sanitizeLineupArtistNames(
        stageMatch[2]!.split(/[,;|]/).map((part) => part.trim()).filter(Boolean),
      );
      for (const name of artists ?? []) {
        entries.push({
          displayName: name,
          normalizedName: normalizeMatchText(name),
          stageOrFloor: stage,
          sortOrder,
          source,
          confidence: 0.75,
        });
        sortOrder += 1;
      }
      continue;
    }

    const timeMatch = line.match(TIME_LINE_PATTERN);
    const artistText = timeMatch?.[3] ?? line;
    const expanded = expandLineupLine(artistText);
    const names =
      expanded.length > 0
        ? expanded.map((entry) => entry.displayName)
        : sanitizeLineupArtistNames([artistText]) ?? [];
    for (const name of names) {
      entries.push({
        displayName: name,
        normalizedName: normalizeMatchText(name),
        sortOrder,
        role: timeMatch ? 'timed_slot' : 'running_order',
        source,
        confidence: timeMatch ? 0.85 : 0.7,
      });
      sortOrder += 1;
    }
  }

  return entries.length > 0 ? entries : undefined;
}

/** Build timetable slots when times are present; preserves order-only rows without invented times. */
export function extractTimetableFromDescriptionText(
  description: string | undefined,
  source = 'description_text',
): TimetableSlotEntry[] | undefined {
  const block = description ? extractSectionBlock(description) : undefined;
  if (!block) {
    return undefined;
  }

  const slots: TimetableSlotEntry[] = [];

  for (const line of splitLines(block)) {
    const timeMatch = line.match(TIME_LINE_PATTERN);
    if (!timeMatch?.[1] || !timeMatch[3]) {
      continue;
    }
    const expanded = expandLineupLine(timeMatch[3]);
    const names =
      expanded.length > 0
        ? expanded.map((entry) => entry.displayName)
        : sanitizeLineupArtistNames([timeMatch[3]]) ?? [];
    for (const name of names) {
      slots.push({
        displayName: name,
        normalizedName: normalizeMatchText(name),
        startTime: timeMatch[1].replace('.', ':'),
        endTime: timeMatch[2]?.replace('.', ':'),
        source,
        confidence: 0.85,
      });
    }
  }

  return slots.length > 0 ? slots : undefined;
}
