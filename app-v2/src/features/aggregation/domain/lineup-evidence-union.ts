/**
 * Phase 4.6.4 — Multi-source lineup union with provenance retention.
 */

import { normalizeMatchText } from '@/features/import/matching/matching-utils';

export type LineupEvidenceSource =
  | 'canonical'
  | 'structured_import'
  | 'description'
  | 'flyer'
  | 'title';

export interface LineupEvidenceEntry {
  displayName: string;
  normalizedName: string;
  source: LineupEvidenceSource;
  confidence: number;
  sortOrder: number;
  headliner?: boolean;
  isB2b?: boolean;
  isF2f?: boolean;
}

const SOURCE_PRIORITY: Record<LineupEvidenceSource, number> = {
  canonical: 100,
  structured_import: 90,
  description: 70,
  flyer: 50,
  title: 30,
};

export function unionLineupEvidence(
  batches: Array<{ source: LineupEvidenceSource; entries: LineupEvidenceEntry[] }>,
): LineupEvidenceEntry[] {
  const byKey = new Map<string, LineupEvidenceEntry>();

  for (const batch of batches) {
    for (const entry of batch.entries) {
      const key = entry.normalizedName || normalizeMatchText(entry.displayName);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...entry, normalizedName: key });
        continue;
      }
      const existingPriority = SOURCE_PRIORITY[existing.source];
      const incomingPriority = SOURCE_PRIORITY[batch.source];
      if (incomingPriority > existingPriority) {
        byKey.set(key, {
          ...entry,
          normalizedName: key,
          sortOrder: Math.min(existing.sortOrder, entry.sortOrder),
        });
      } else if (incomingPriority === existingPriority) {
        byKey.set(key, {
          ...existing,
          confidence: Math.max(existing.confidence, entry.confidence),
          sortOrder: Math.min(existing.sortOrder, entry.sortOrder),
        });
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function detectLineupConflicts(
  batches: Array<{ source: LineupEvidenceSource; entries: LineupEvidenceEntry[] }>,
): Array<{ normalizedName: string; sources: LineupEvidenceSource[] }> {
  const sourceByName = new Map<string, Set<LineupEvidenceSource>>();

  for (const batch of batches) {
    for (const entry of batch.entries) {
      const key = entry.normalizedName || normalizeMatchText(entry.displayName);
      const set = sourceByName.get(key) ?? new Set<LineupEvidenceSource>();
      set.add(batch.source);
      sourceByName.set(key, set);
    }
  }

  return [...sourceByName.entries()]
    .filter(([, sources]) => sources.size > 1)
    .map(([normalizedName, sources]) => ({ normalizedName, sources: [...sources] }));
}
