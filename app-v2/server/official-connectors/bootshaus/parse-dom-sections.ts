import type * as cheerio from 'cheerio';

import type { LineupEvidenceBlock, ParsedLineupAct } from './parse-lineup';
import { blocksToParsedActs } from './parse-lineup';

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractLinesFromContainerHtml(html: string): string[] {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  return withBreaks
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);
}

export function extractArtistsContainerBlock($: cheerio.CheerioAPI): LineupEvidenceBlock | null {
  const container = $('.artists-container').first();
  if (!container.length || container.hasClass('element-hidden')) {
    return null;
  }

  const rawLines = extractLinesFromContainerHtml(container.html() ?? '').filter(
    (line) => line.toLowerCase() !== 'artists',
  );

  if (rawLines.length === 0) {
    return null;
  }

  return {
    blockType: 'artists_section',
    headerText: 'Artists',
    rawLines,
    confidence: 'high',
  };
}

export function extractLineupContainerBlock($: cheerio.CheerioAPI): LineupEvidenceBlock | null {
  const container = $('.lineup-container').first();
  if (!container.length || container.hasClass('element-hidden')) {
    return null;
  }

  const rawLines = extractLinesFromContainerHtml(container.html() ?? '').filter(
    (line) => !/^(line\s*-?\s*up|lineup)$/i.test(line),
  );

  if (rawLines.length === 0) {
    return null;
  }

  return {
    blockType: 'structured_lineup_header',
    headerText: 'Line-Up',
    rawLines,
    confidence: 'high',
  };
}

export function extractTimetableBlock($: cheerio.CheerioAPI): LineupEvidenceBlock | null {
  const container = $('.timetable-container').first();
  if (!container.length || container.hasClass('element-hidden')) {
    return null;
  }

  const rawLines = extractLinesFromContainerHtml(container.html() ?? '').filter(
    (line) => !/^timetable$/i.test(line),
  );

  if (rawLines.length === 0) {
    return null;
  }

  return {
    blockType: 'timetable',
    headerText: 'Timetable',
    rawLines,
    confidence: 'medium',
  };
}

export function domBlocksToParsedActs(blocks: LineupEvidenceBlock[]): ParsedLineupAct[] {
  return blocksToParsedActs(blocks);
}
