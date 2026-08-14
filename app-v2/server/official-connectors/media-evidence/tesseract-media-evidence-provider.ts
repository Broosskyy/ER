import { createWorker, PSM, type Block, type Page, type Worker } from 'tesseract.js';

import { parseMediaLayoutFromOcr } from './parse-media-layout';
import { prepareImageForOcr } from './prepare-image-for-ocr';
import {
  readCachedMediaEvidence,
  writeCachedMediaEvidence,
} from './media-evidence-cache';
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
const EXTRACTION_MODEL = 'tesseract.js:eng+deu:psm-auto:layout-v3';

let sharedWorkerPromise: Promise<Worker> | undefined;

async function getSharedWorker(): Promise<Worker> {
  if (!sharedWorkerPromise) {
    sharedWorkerPromise = (async () => {
      const worker = await createWorker('eng+deu', 1, {
        logger: () => undefined,
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

export class TesseractMediaEvidenceProvider implements MediaEvidenceProvider {
  readonly providerId = PROVIDER_ID;

  async extractFromImage(input: MediaEvidenceExtractInput): Promise<EventMediaEvidence> {
    const cached = readCachedMediaEvidence(input.imageFingerprint);
    if (cached && cached.extractionModel === EXTRACTION_MODEL) {
      return cached;
    }

    if (cached?.ocrLines?.length) {
      const parsed = parseMediaLayoutFromOcr(cached.ocrLines, cached.ocrBlocks);
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

    const worker = await getSharedWorker();
    const prepared = prepareImageForOcr(input.imageBytes, input.mimeType);
    const { data } = await worker.recognize(
      prepared.bytes,
      {},
      {
        text: true,
        blocks: true,
      },
    );

    let ocrLines = mapLinesFromPage(data);
    let ocrBlocks = mapBlocksFromPage(data);
    const rawText = data.text?.trim() || undefined;

    if (ocrLines.length === 0 && rawText) {
      ocrLines = fallbackLinesFromRawText(rawText);
      ocrBlocks = [
        {
          text: rawText,
          confidence: 72,
          bbox: { x0: 0, y0: 0, x1: 400, y1: ocrLines.length * 24 },
          lines: ocrLines,
        },
      ];
    }
    const parsed = parseMediaLayoutFromOcr(ocrLines, ocrBlocks);

    const evidence: EventMediaEvidence = {
      sourceImageUrl: input.sourceImageUrl,
      imageFingerprint: input.imageFingerprint,
      sourceObservedAt: input.sourceObservedAt,
      extractedAt: new Date().toISOString(),
      extractionProvider: this.providerId,
      extractionModel: EXTRACTION_MODEL,
      rawText,
      ocrBlocks,
      ocrLines,
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
