import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface AcquisitionCheckpoint {
  runId: string;
  updatedAt: string;
  completedDetailSlugs: string[];
  completedLocationSlugs: string[];
  completedCitySlugs: string[];
}

export function loadAcquisitionCheckpoint(checkpointPath: string): AcquisitionCheckpoint | undefined {
  if (!existsSync(checkpointPath)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(checkpointPath, 'utf8')) as AcquisitionCheckpoint;
  } catch {
    return undefined;
  }
}

export function saveAcquisitionCheckpoint(checkpointPath: string, checkpoint: AcquisitionCheckpoint): void {
  mkdirSync(dirname(checkpointPath), { recursive: true });
  writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
}
