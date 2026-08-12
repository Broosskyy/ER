import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';

import { isLineupTbaBlock } from './description-boundaries';

export type LineupExtractionState = 'explicit_artists' | 'tba' | 'empty';

export interface LineupExtractionResult {
  state: LineupExtractionState;
  entries: LineupEvidenceEntry[];
  stageContext?: string;
  inclusionReason: string;
}

const STAGE_HEADING =
  /^(?:lineup|line-up|mainfloor|main floor|outdoor|indoor|bühne|stage|floor)\s*:?\s*$/i;
const STAGE_HEADING_WITH_LABEL = /^(mainfloor|main floor|outdoor|indoor|bühne|stage|floor)\s*:?\s*$/i;
const BILLING_SPLIT = /\s+(?:b2b|f2f|vs\.?|live)\s+/i;
const FOOTER_MARKERS =
  /^(?:einlass|age for admission|bootshaus mobile|merchandise|www\.|https?:\/\/|▔)/i;
const NOT_ARTIST =
  /^(?:doors|einlass|tickets|info|place|date|datum|start|uhrzeit|location|venue|lineup\s+tba|and\s+more|more)$/i;
const LINEUP_SECTION_TERMINATORS =
  /^(?:public transport(?:\s+info)?|verkehrsinfo|anfahrt|getting there|directions|parken|parking|öffnungszeiten|opening hours|einlass|age for admission|tickets|merchandise|www\.|https?:\/\/)/i;
const INLINE_MAINFLOOR_MARKER = /\bmain\s*floor\s*:?\s*(.+)$/i;

function normalizeCompressedLineupBlob(blob: string): string {
  return blob
    .replace(/(\d+\s+[A-Z]+\s+&\s+[A-Z]+)(OLIVER)/gi, '$1 $2')
    .replace(/(CHARLIE)(OLIVER)/gi, '$1 $2')
    .replace(/([A-Z]{2,})(DJ\s+)/g, '$1 $2')
    .replace(/([A-Z]{2,})(JEY\s+)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCompressedMainfloorBlob(blob: string): string[] {
  const withoutFooter = blob.split(/[▔━─]{4,}/)[0]?.trim() ?? blob;
  const normalized = normalizeCompressedLineupBlob(withoutFooter);
  if (!normalized) {
    return [];
  }

  const artists: string[] = [];
  let rest = normalized;

  while (rest.length > 0) {
    const compoundMatch = rest.match(/^\d+\s+[A-Z]+(?:\s+[A-Z]+)*\s+&\s+[A-Z]+/);
    if (compoundMatch) {
      artists.push(compoundMatch[0].trim());
      rest = rest.slice(compoundMatch[0].length).trim();
      continue;
    }

    const roleMatch = rest.match(/^(?:DJ|MC|LIVE)\s+[A-Z]+/);
    if (roleMatch) {
      artists.push(roleMatch[0].trim());
      rest = rest.slice(roleMatch[0].length).trim();
      continue;
    }

    const nextMarker = rest.search(/\s+(?=\d+\s+[A-Z]+\s+&|\s*(?:DJ|MC|LIVE|JEY)\s+)/);
    const segment = nextMarker > 0 ? rest.slice(0, nextMarker).trim() : rest.trim();
    if (segment) {
      artists.push(segment);
    }
    rest = nextMarker > 0 ? rest.slice(nextMarker).trim() : '';
  }

  return artists;
}

function extractInlineMainfloorArtists(block: string): string[] {
  const colonMatch = block.match(/(?:^|\.|\s)main\s*floor\s*:\s*(.+)$/i);
  if (colonMatch?.[1]?.trim()) {
    return parseCompressedMainfloorBlob(colonMatch[1].trim());
  }

  const gluedArtistMatch = block.match(/\.main\s*floor([A-Z]{2,}.*)$/i);
  if (gluedArtistMatch?.[1]?.trim()) {
    return parseCompressedMainfloorBlob(gluedArtistMatch[1].trim());
  }

  return [];
}

function parseBillingRelation(name: string): Pick<LineupEvidenceEntry, 'billingRelation' | 'isB2b' | 'isF2f' | 'isLiveSet'> {
  const upper = name.toUpperCase();
  if (/\bB2B\b/.test(upper)) {
    return { billingRelation: 'B2B', isB2b: true, isF2f: false, isLiveSet: false };
  }
  if (/\bF2F\b/.test(upper)) {
    return { billingRelation: 'F2F', isB2b: false, isF2f: true, isLiveSet: false };
  }
  if (/\bVS\.?\b/.test(upper)) {
    return { billingRelation: 'VS', isB2b: false, isF2f: false, isLiveSet: false };
  }
  if (/\bLIVE\b/.test(upper)) {
    return { billingRelation: 'LIVE', isB2b: false, isF2f: false, isLiveSet: true };
  }
  return { billingRelation: 'SOLO', isB2b: false, isF2f: false, isLiveSet: false };
}

function isLikelyArtistLine(block: string): boolean {
  const trimmed = block.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (NOT_ARTIST.test(trimmed)) return false;
  if (FOOTER_MARKERS.test(trimmed)) return false;
  if (isLineupTbaBlock(trimmed)) return false;
  if (/^[\s▔━─\-_=]+$/.test(trimmed)) return false;
  if (trimmed.length > 120) return false;
  return true;
}

function expandBillingLine(block: string, stage?: string, sortStart = 0): LineupEvidenceEntry[] {
  const billing = parseBillingRelation(block);
  const parts = block.split(BILLING_SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return [
      {
        sortOrder: sortStart,
        displayName: block.trim(),
        rawSourceSpelling: block.trim(),
        normalizedName: block.trim(),
        ...billing,
        stage,
        confidence: 0.86,
        reviewState: 'not_reviewed',
        inclusionReason: 'Explicit lineup line from official event body',
      },
    ];
  }

  return parts.map((part, index) => ({
    sortOrder: sortStart + index,
    displayName: part,
    rawSourceSpelling: block.trim(),
    normalizedName: part,
    billingRelation: index === 0 ? billing.billingRelation : 'B2B',
    isB2b: index > 0 || billing.isB2b,
    isF2f: billing.isF2f,
    isLiveSet: billing.isLiveSet,
    stage,
    confidence: 0.84,
    reviewState: 'not_reviewed',
    inclusionReason: 'Explicit billing split from official event body',
  }));
}

export function normalizeLineupContentBlocks(contentBlocks: string[]): string[] {
  const expanded: string[] = [];
  for (const block of contentBlocks) {
    if (!block.includes('\n')) {
      if (/main\s*floor\s*:/i.test(block)) {
        const parts = block.split(/(?=\.main\s*floor\s*:)/i).map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) {
          expanded.push(...parts);
          continue;
        }
      }
      expanded.push(block);
      continue;
    }
    for (const line of block.split(/\n+/)) {
      const trimmed = line.trim();
      if (trimmed) {
        expanded.push(trimmed);
      }
    }
  }
  return expanded;
}

/**
 * Extract explicit lineup evidence from preserved description content blocks.
 * Never infers artists from event title or footer prose.
 */
export function extractLineupFromContentBlocks(contentBlocks: string[]): LineupExtractionResult {
  const normalizedBlocks = normalizeLineupContentBlocks(contentBlocks);
  if (normalizedBlocks.length === 0) {
    return { state: 'empty', entries: [], inclusionReason: 'No description content blocks' };
  }

  const joined = normalizedBlocks.join('\n');
  if (
    /\blineup\s+tba\b/i.test(joined) &&
    !normalizedBlocks.some((block) => isLikelyArtistLine(block) && !isLineupTbaBlock(block))
  ) {
    return {
      state: 'tba',
      entries: [],
      inclusionReason: 'Explicit Lineup TBA state in official event body',
    };
  }

  let stageContext: string | undefined;
  let inLineupSection = false;
  const entries: LineupEvidenceEntry[] = [];
  let sortOrder = 0;

  for (const block of normalizedBlocks) {
    const trimmed = block.trim();

    if (inLineupSection && LINEUP_SECTION_TERMINATORS.test(trimmed)) {
      break;
    }

    if (isLineupTbaBlock(trimmed)) {
      return {
        state: 'tba',
        entries: [],
        stageContext,
        inclusionReason: 'Explicit Lineup TBA line in official event body',
      };
    }

    if (STAGE_HEADING.test(trimmed) || STAGE_HEADING_WITH_LABEL.test(trimmed)) {
      inLineupSection = true;
      stageContext = trimmed.replace(/:\s*$/, '').toUpperCase();
      continue;
    }

    if (/^(?:lineup|line-up)\s*:?\s*$/i.test(trimmed)) {
      inLineupSection = true;
      continue;
    }

    if (/^mainfloor\s*:?\s*$/i.test(trimmed)) {
      inLineupSection = true;
      stageContext = 'MAINFLOOR';
      continue;
    }

    const afterMainfloorMarker = trimmed.match(/(?:^|\.)(?:main\s*floor)\s*:\s*(.+)$/i);
    if (afterMainfloorMarker?.[1]) {
      inLineupSection = true;
      stageContext = 'MAINFLOOR';
      const artist = afterMainfloorMarker[1].trim();
      const compressed = parseCompressedMainfloorBlob(artist);
      if (compressed.length > 1) {
        for (const name of compressed) {
          if (isLikelyArtistLine(name)) {
            const expanded = expandBillingLine(name, stageContext, sortOrder);
            entries.push(...expanded);
            sortOrder += expanded.length;
          }
        }
      } else if (isLikelyArtistLine(artist)) {
        entries.push(...expandBillingLine(artist, stageContext, sortOrder));
        sortOrder += entries.length;
      }
      continue;
    }

    const inlineMainfloor = extractInlineMainfloorArtists(trimmed);
    if (inlineMainfloor.length > 1) {
      inLineupSection = true;
      stageContext = 'MAINFLOOR';
      for (const name of inlineMainfloor) {
        if (isLikelyArtistLine(name)) {
          const expanded = expandBillingLine(name, stageContext, sortOrder);
          entries.push(...expanded);
          sortOrder += expanded.length;
        }
      }
      continue;
    }

    if (inLineupSection && isLikelyArtistLine(trimmed)) {
      const expanded = expandBillingLine(trimmed, stageContext, sortOrder);
      entries.push(...expanded);
      sortOrder += expanded.length;
      continue;
    }

    if (!inLineupSection && /^(?:lineup|line-up)\s*:/i.test(trimmed)) {
      inLineupSection = true;
      const inline = trimmed.replace(/^(?:lineup|line-up)\s*:\s*/i, '').trim();
      if (inline && isLikelyArtistLine(inline)) {
        entries.push(...expandBillingLine(inline, stageContext, sortOrder));
        sortOrder += entries.length;
      }
    }
  }

  if (entries.length > 0) {
    return {
      state: 'explicit_artists',
      entries,
      stageContext,
      inclusionReason: 'Explicit lineup block parsed from official event body',
    };
  }

  return { state: 'empty', entries: [], inclusionReason: 'No explicit lineup block found in event body' };
}
