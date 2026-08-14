import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildBootshausImageHostAllowlist,
  createEmptyMediaPassCounters,
  enrichOfficialEvidenceWithMedia,
  terminateSharedTesseractWorker,
} from '../media-evidence';
import { parseBootshausDetailPage } from './parse-detail';
import { buildConsumerPreview } from '../preview';
import {
  createEmptyConnectorCounters,
  type OfficialEventConsumerPreview,
  type OfficialEventEvidence,
} from '../types';

const M5_CACHE_DIR = '.tmp/m3-bootshaus-cache/details';

export interface BuildBootshausMediaEvidenceBatch {
  evidences: OfficialEventEvidence[];
  previews: OfficialEventConsumerPreview[];
  mediaCounters: ReturnType<typeof createEmptyMediaPassCounters>;
  connectorCounters: ReturnType<typeof createEmptyConnectorCounters>;
}

export async function buildBootshausOfficialEvidenceWithMedia(
  entries: Array<{
    sourceEventKey: string;
    officialUrl: string;
    fetchedAt: string;
    officialImageUrl?: string;
  }>,
): Promise<BuildBootshausMediaEvidenceBatch> {
  const connectorCounters = createEmptyConnectorCounters();
  const mediaCounters = createEmptyMediaPassCounters();
  const allowedHosts = buildBootshausImageHostAllowlist(
    entries.map((entry) => entry.officialImageUrl).filter((url): url is string => Boolean(url)),
  );

  const evidences: OfficialEventEvidence[] = [];
  const previews: OfficialEventConsumerPreview[] = [];

  for (const entry of entries) {
    const html = readFileSync(join(M5_CACHE_DIR, `${entry.sourceEventKey}.html`), 'utf8');
    const textEvidence = parseBootshausDetailPage(
      html,
      entry.officialUrl,
      entry.fetchedAt,
      connectorCounters,
    );
    const enriched = await enrichOfficialEvidenceWithMedia(textEvidence, {
      counters: connectorCounters,
      mediaCounters,
      allowedImageHosts: allowedHosts,
      sourceObservedAt: entry.fetchedAt,
    });
    evidences.push(enriched);
    previews.push(buildConsumerPreview(enriched, connectorCounters));
  }

  await terminateSharedTesseractWorker();
  return { evidences, previews, mediaCounters, connectorCounters };
}

export function loadBootshausPreviewEntries(): Array<{
  sourceEventKey: string;
  officialUrl: string;
  fetchedAt: string;
  officialImageUrl?: string;
}> {
  const payload = JSON.parse(readFileSync('.tmp/m3-bootshaus-official-preview.json', 'utf8')) as {
    previews: Array<{
      sourceEventKey: string;
      officialUrl: string;
      fetchedAt: string;
      officialImageUrl?: string;
    }>;
  };
  return payload.previews;
}

export function assertBootshausCacheComplete(): void {
  const htmlFiles = readdirSync(M5_CACHE_DIR).filter((name) => name.endsWith('.html'));
  if (htmlFiles.length !== 30) {
    throw new Error(`M5_2_CACHE_INCOMPLETE: expected 30 detail html files, found ${htmlFiles.length}`);
  }
}
