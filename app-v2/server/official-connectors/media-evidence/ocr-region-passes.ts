import { PSM } from 'tesseract.js';

import type { MediaBoundingBox, MediaOcrLine, MediaOcrWord } from './types';

export interface OcrRegionPass {
  left: number;
  top: number;
  width: number;
  height: number;
  psm: PSM;
}

export function buildOcrRegionPasses(width: number, height: number): OcrRegionPass[] {
  const passes: OcrRegionPass[] = [
    { left: 0, top: 0, width, height, psm: PSM.AUTO },
    { left: 0, top: 0, width, height, psm: PSM.SPARSE_TEXT },
  ];

  if (width >= height * 1.15) {
    const rightStart = Math.floor(width * 0.45);
    passes.push({
      left: rightStart,
      top: 0,
      width: width - rightStart,
      height,
      psm: PSM.SPARSE_TEXT,
    });
    passes.push({
      left: Math.floor(width * 0.55),
      top: Math.floor(height * 0.12),
      width: width - Math.floor(width * 0.55),
      height: Math.floor(height * 0.84),
      psm: PSM.SPARSE_TEXT,
    });
  }

  return passes;
}

function compactLineKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function mergeMediaOcrLines(
  batches: Array<{
    text: string;
    confidence: number;
    bbox: MediaBoundingBox;
    words: MediaOcrWord[];
  }>,
): MediaOcrLine[] {
  const merged: MediaOcrLine[] = [];

  for (const line of batches) {
    const compact = compactLineKey(line.text);
    if (!compact || compact.length < 2) {
      continue;
    }

    const duplicate = merged.some((existing) => {
      const existingCompact = compactLineKey(existing.text);
      if (!existingCompact) {
        return false;
      }
      if (existingCompact === compact) {
        return true;
      }
      if (compact.length >= 6 && existingCompact.length >= 6) {
        return existingCompact.includes(compact) || compact.includes(existingCompact);
      }
      return false;
    });

    if (!duplicate) {
      merged.push(line);
    }
  }

  return merged;
}
