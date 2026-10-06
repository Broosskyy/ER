import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EventMediaEvidence } from './types';

export const M5_2_MEDIA_CACHE_DIR = '.tmp/m5-2-media-cache';
const IMAGE_DIR = join(M5_2_MEDIA_CACHE_DIR, 'images');
const EVIDENCE_DIR = join(M5_2_MEDIA_CACHE_DIR, 'evidence');

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

export function ensureMediaCacheDirs(): void {
  mkdirSync(IMAGE_DIR, { recursive: true });
  mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export function readCachedMediaEvidence(fingerprint: string): EventMediaEvidence | undefined {
  const path = join(EVIDENCE_DIR, `${fingerprint}.json`);
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as EventMediaEvidence;
}

export function writeCachedMediaEvidence(evidence: EventMediaEvidence): void {
  ensureMediaCacheDirs();
  writeFileSync(
    join(EVIDENCE_DIR, `${evidence.imageFingerprint}.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}

export function readCachedImageBytes(
  fingerprint: string,
  mimeType: string,
): Buffer | undefined {
  const path = join(IMAGE_DIR, `${fingerprint}.${extensionForMime(mimeType)}`);
  if (!existsSync(path)) {
    return undefined;
  }
  return readFileSync(path);
}

export function writeCachedImageBytes(
  fingerprint: string,
  mimeType: string,
  bytes: Buffer,
): void {
  ensureMediaCacheDirs();
  writeFileSync(join(IMAGE_DIR, `${fingerprint}.${extensionForMime(mimeType)}`), bytes);
}

export function findCachedMediaEvidenceByImageUrl(imageUrl: string): EventMediaEvidence | undefined {
  if (!existsSync(EVIDENCE_DIR)) {
    return undefined;
  }

  for (const fileName of readdirSync(EVIDENCE_DIR)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const evidence = JSON.parse(readFileSync(join(EVIDENCE_DIR, fileName), 'utf8')) as EventMediaEvidence;
    if (evidence.sourceImageUrl === imageUrl) {
      return evidence;
    }
  }

  return undefined;
}
