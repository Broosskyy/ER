import { createWorker, PSM, type Block, type Page, type Worker } from 'tesseract.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { MediaEvidenceContext } from '../shared/media-evidence-context';
import {
  corroborateMediaLineupFromOcr,
  normalizeMediaOcrLines,
} from './corroborate-media-lineup-from-ocr';
import { parseMediaLayoutFromOcr } from './parse-media-layout';
import { prepareImageForOcr } from './prepare-image-for-ocr';
import {
  readCachedMediaEvidence,
  writeCachedMediaEvidence,
} from './media-evidence-cache';
import { buildOcrRegionPasses, mergeMediaOcrLines } from './ocr-region-passes';
import type {
  EventMediaEvidence,
  MediaBoundingBox,
  MediaEvidenceExtractInput,
  MediaEvidenceProvider,
  MediaOcrBlock,
  MediaOcrLine,
  MediaOcrWord,
} from './types';

const PROVIDER_ID = 'tesseract-local';
const EXTRACTION_MODEL = 'tesseract.js:eng+deu:psm-multi-region:layout-v5';
export const TESSERACT_RUNTIME_CACHE_DIR =
  process.env.TESSERACT_CACHE_DIR ?? join(tmpdir(), 'eternal-rave-tesseract');

let sharedWorkerPromise: Promise<Worker> | undefined;

async function getSharedWorker(): Promise<Worker> {
  if (!sharedWorkerPromise) {
    sharedWorkerPromise = (async () => {
      const worker = await createWorker('eng+deu', 1, {
        logger: () => undefined,
        cachePath: TESSERACT_RUNTIME_CACHE_DIR,
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
      });
      return worker;
    })();
  }
  return sharedWorkerPromise;
}

function toBBox(box: { x0: number; y0: number; x1: number; y1: number }): MediaBoundingBox {
  return {
    x0: box.x0,
    y0: box.y0,
    x1: box.x1,
    y1: box.y1,
  };
}

function mapWords(
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>,
): MediaOcrWord[] {
  return words
    .map((word) => ({
      text: word.text.trim(),
      confidence: word.confidence,
      bbox: toBBox(word.bbox),
    }))
    .filter((word) => word.text.length > 0);
}

function mapLinesFromPage(page: Page): MediaOcrLine[] {
  const lines: MediaOcrLine[] = [];
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const text = line.text.replace(/\s+/g, ' ').trim();
        if (!text) {
          continue;
        }
        lines.push({
          text,
          confidence: line.confidence,
          bbox: toBBox(line.bbox),
          words: mapWords(line.words ?? []),
        });
      }
    }
  }
  return lines;
}

function fallbackLinesFromRawText(rawText: string): MediaOcrLine[] {
  return rawText
    .split('\n')
    .map((line, index) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((text, index) => ({
      text,
      confidence: 72,
      bbox: { x0: 0, y0: index * 24, x1: 400, y1: (index + 1) * 24 },
      words: text.split(/\s+/).map((word, wordIndex) => ({
        text: word,
        confidence: 72,
        bbox: {
          x0: wordIndex * 40,
          y0: index * 24,
          x1: (wordIndex + 1) * 40,
          y1: (index + 1) * 24,
        },
      })),
    }));
}

function mapBlocksFromPage(page: Page): MediaOcrBlock[] {
  return (page.blocks ?? []).map((block: Block) => ({
    text: block.text.replace(/\s+/g, ' ').trim(),
    confidence: block.confidence,
    bbox: toBBox(block.bbox),
    lines: (block.paragraphs ?? []).flatMap((paragraph) =>
      (paragraph.lines ?? []).map((line) => ({
        text: line.text.replace(/\s+/g, ' ').trim(),
        confidence: line.confidence,
        bbox: toBBox(line.bbox),
        words: mapWords(line.words ?? []),
      })),
    ),
  }));
}

async function recognizeImagePasses(
  worker: Worker,
  preparedBytes: Buffer,
  width: number,
  height: number,
): Promise<{ ocrLines: MediaOcrLine[]; ocrBlocks: MediaOcrBlock[]; rawText?: string }> {
  const passes = buildOcrRegionPasses(width, height);
  const lineBatches: MediaOcrLine[] = [];
  const blockBatches: MediaOcrBlock[] = [];
  const rawTextParts: string[] = [];

  for (const pass of passes) {
    await worker.setParameters({ tessedit_pageseg_mode: pass.psm });
    const { data } = await worker.recognize(
      preparedBytes,
      {
        rectangle: {
          left: pass.left,
          top: pass.top,
          width: pass.width,
          height: pass.height,
        },
      },
      {
        text: true,
        blocks: true,
      },
    );

    lineBatches.push(...mapLinesFromPage(data));
    blockBatches.push(...mapBlocksFromPage(data));
    if (data.text?.trim()) {
      rawTextParts.push(data.text.trim());
    }
  }

  let ocrLines = mergeMediaOcrLines(lineBatches);
  const rawText = rawTextParts.join('\n').trim() || undefined;

  if (ocrLines.length === 0 && rawText) {
    ocrLines = fallbackLinesFromRawText(rawText);
  }

  ocrLines = normalizeMediaOcrLines(ocrLines);

  return {
    ocrLines,
    ocrBlocks: blockBatches,
    rawText,
  };
}

function parseMediaEvidenceFromOcr(
  ocrLines: MediaOcrLine[],
  ocrBlocks: MediaOcrBlock[],
  input: MediaEvidenceExtractInput,
  rawText?: string,
): Pick<
  EventMediaEvidence,
  | 'lineupCandidates'
  | 'genreCandidates'
  | 'rejectedCandidates'
  | 'mediaClassification'
  | 'confidence'
> {
  const parsed = parseMediaLayoutFromOcr(ocrLines, ocrBlocks, input.mediaContext);
  if (!input.corroborationLineup?.length) {
    return parsed;
  }

  return corroborateMediaLineupFromOcr(parsed, ocrLines, input.corroborationLineup, {
    mediaContext: input.mediaContext,
    rawText,
  });
}

export function reparseCachedMediaEvidence(
  cached: EventMediaEvidence,
  mediaContext?: MediaEvidenceContext,
  corroborationLineup?: string[],
): EventMediaEvidence {
  const parsed = parseMediaEvidenceFromOcr(cached.ocrLines, cached.ocrBlocks, {
    sourceImageUrl: cached.sourceImageUrl,
    imageFingerprint: cached.imageFingerprint,
    imageBytes: Buffer.from(''),
    mimeType: 'image/png',
    sourceObservedAt: cached.sourceObservedAt,
    mediaContext,
    corroborationLineup,
  }, cached.rawText);
  const evidence: EventMediaEvidence = {
    ...cached,
    extractedAt: new Date().toISOString(),
    extractionModel: EXTRACTION_MODEL,
    lineupCandidates: parsed.lineupCandidates,
    genreCandidates: parsed.genreCandidates,
    rejectedCandidates: parsed.rejectedCandidates,
    mediaClassification: parsed.mediaClassification,
    confidence: parsed.confidence,
  };
  writeCachedMediaEvidence(evidence);
  return evidence;
}

export class TesseractMediaEvidenceProvider implements MediaEvidenceProvider {
  readonly providerId = PROVIDER_ID;

  async extractFromImage(input: MediaEvidenceExtractInput): Promise<EventMediaEvidence> {
    const cached = readCachedMediaEvidence(input.imageFingerprint);
    if (cached && cached.extractionModel === EXTRACTION_MODEL) {
      if (input.corroborationLineup?.length) {
        return reparseCachedMediaEvidence(
          cached,
          input.mediaContext,
          input.corroborationLineup,
        );
      }
      return cached;
    }

    if (cached?.ocrLines?.length) {
      return reparseCachedMediaEvidence(
        cached,
        input.mediaContext,
        input.corroborationLineup,
      );
    }

    const worker = await getSharedWorker();
    const prepared = prepareImageForOcr(input.imageBytes, input.mimeType);
    const width = prepared.width ?? 1200;
    const height = prepared.height ?? 800;
    const recognized = await recognizeImagePasses(worker, prepared.bytes, width, height);

    const parsed = parseMediaEvidenceFromOcr(
      recognized.ocrLines,
      recognized.ocrBlocks,
      input,
      recognized.rawText,
    );

    const evidence: EventMediaEvidence = {
      sourceImageUrl: input.sourceImageUrl,
      imageFingerprint: input.imageFingerprint,
      sourceObservedAt: input.sourceObservedAt,
      extractedAt: new Date().toISOString(),
      extractionProvider: this.providerId,
      extractionModel: EXTRACTION_MODEL,
      rawText: recognized.rawText,
      ocrBlocks: recognized.ocrBlocks,
      ocrLines: recognized.ocrLines,
      lineupCandidates: parsed.lineupCandidates,
      genreCandidates: parsed.genreCandidates,
      rejectedCandidates: parsed.rejectedCandidates,
      mediaClassification: parsed.mediaClassification,
      confidence: parsed.confidence,
    };

    writeCachedMediaEvidence(evidence);
    return evidence;
  }
}

export async function terminateSharedTesseractWorker(): Promise<void> {
  if (sharedWorkerPromise) {
    const worker = await sharedWorkerPromise;
    await worker.terminate();
    sharedWorkerPromise = undefined;
  }
}
