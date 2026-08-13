import { extractDescriptionBoundariesFromHtml } from '@/features/import/unified-website/description-boundaries';
import {
  extractEventDescription,
  extractLineupFromDescriptionHtml,
} from '@/features/import/unified-website/description-extraction';
import { normalizeCanonicalGenreLabels } from '@/features/events/formatting/canonical-genre-normalizer';
import { isLineupChromeDescription } from '@/features/import/domain/golden-content-quality-gate';

export interface OfficialDetailTextEvidence {
  description?: string;
  lineupContentBlocks: string[];
  genreLabels: string[];
  descriptionSource: string;
}

function extractExplicitGenreLabelsFromBlocks(blocks: string[]): string[] {
  const labels: string[] = [];
  for (const block of blocks) {
    const match = block.match(/^genres?\s*:?\s*(.+)$/i);
    if (!match?.[1]) {
      continue;
    }
    for (const part of match[1].split(/[,/|]/)) {
      const label = part.trim();
      if (label.length > 1) {
        labels.push(label);
      }
    }
  }
  return normalizeCanonicalGenreLabels(labels);
}

export function buildLineupContentBlocksFromOfficialText(input: {
  description?: string;
  detailHtml?: string;
}): string[] {
  if (input.detailHtml?.includes('<')) {
    const boundaries = extractDescriptionBoundariesFromHtml(input.detailHtml);
    if (boundaries.contentBlocks.length > 0) {
      return boundaries.contentBlocks;
    }
  }

  const description = input.description?.trim();
  if (!description || isLineupChromeDescription(description)) {
    return [];
  }

  const paragraphBlocks = description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (paragraphBlocks.length > 1) {
    return paragraphBlocks;
  }

  return [description];
}

export function extractOfficialDetailTextEvidence(html: string): OfficialDetailTextEvidence {
  const descriptionResult = extractEventDescription(html);
  const lineupContentBlocks = buildLineupContentBlocksFromOfficialText({
    description: descriptionResult.description,
    detailHtml: html,
  });
  const lineup = extractLineupFromDescriptionHtml(html);
  const genreLabels = extractExplicitGenreLabelsFromBlocks(lineupContentBlocks);

  return {
    description: descriptionResult.description,
    lineupContentBlocks:
      lineupContentBlocks.length > 0
        ? lineupContentBlocks
        : lineup.entries.map((entry) => entry.displayName),
    genreLabels,
    descriptionSource: descriptionResult.source,
  };
}
