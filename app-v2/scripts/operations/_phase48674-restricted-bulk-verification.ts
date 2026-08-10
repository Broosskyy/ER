/**
 * Phase 4.8.6.7.4 — Restricted bulk candidate verification (read-only).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OPS_DIR = dirname(fileURLToPath(import.meta.url));

if (!existsSync(join(OPS_DIR, '../../.env'))) {
  const fallbacks = ['C:/ER/app-v2/.env', join(OPS_DIR, '../../../../ER/app-v2/.env')];
  for (const fallbackEnv of fallbacks) {
    if (existsSync(fallbackEnv)) {
      process.env.ER_OPS_ENV_FILE = fallbackEnv;
      break;
    }
  }
}

import './load-ops-env';

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

import {
  scoreForensicCandidate,
  auditAllReadyPartialCandidates,
  buildRestrictedBulkManifest,
  isInvalidPriorManifestHash,
  selectRestrictedBulkCandidates,
} from '@/features/import/bulk-canonical-rebuild/restricted-bulk-forensic';
import { buildPhaseCLiveReferenceMatrix } from '@/features/import/bulk-canonical-rebuild/phase-c-reference-matrix';
import { liveRevalidateRestrictedCandidates } from '@/features/import/bulk-canonical-rebuild/restricted-bulk-revalidation';
import { runFixtureRebuildAcceptance } from '@/features/import/bulk-canonical-rebuild/fixture-rebuild-runner';
import type { BulkRebuildEventRow } from '@/features/import/bulk-canonical-rebuild/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function loadPhaseCRows(): BulkRebuildEventRow[] {
  const path = join(OUT, '_phase4867_bulk_rebuild_events.json');
  return JSON.parse(readFileSync(path, 'utf8')) as BulkRebuildEventRow[];
}

function loadDetailFetchMetrics(): Record<string, unknown> | undefined {
  try {
    const path = join(OUT, '_phase48673_live_fetch_metrics.json');
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function countByEligibility(
  audits: ReturnType<typeof auditAllReadyPartialCandidates>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const audit of audits) {
    counts[audit.finalEligibility] = (counts[audit.finalEligibility] ?? 0) + 1;
  }
  return counts;
}

function artifactFingerprintDrift(
  audit: ReturnType<typeof auditAllReadyPartialCandidates>[number],
  row: BulkRebuildEventRow | undefined,
): boolean {
  if (!row?.existing) return false;
  const live = {
    title: row.existing.title,
    startDate: row.existing.startDate,
    endDate: row.existing.endDate,
    venueName: row.existing.venueName,
    organizerName: row.existing.organizerName,
    websiteUrl: row.existing.websiteUrl,
    ticketUrl: row.existing.ticketUrl,
    priceText: row.existing.priceText,
    ticketStatus: row.existing.ticketStatus,
    genreLabels: row.existing.genreLabels,
    descriptionLength: row.existing.description?.length ?? 0,
  };
  return JSON.stringify(audit.currentEventFingerprint) !== JSON.stringify(live);
}

async function main(): Promise<void> {
  const rows = loadPhaseCRows();
  const detailFetchMetrics = loadDetailFetchMetrics();

  const referenceMatrix = buildPhaseCLiveReferenceMatrix(rows, detailFetchMetrics);
  writeJson('_phase48674_live_reference_matrix.json', referenceMatrix);

  const forensicAudits = auditAllReadyPartialCandidates(rows);
  const eligibilityCounts = countByEligibility(forensicAudits);
  writeJson('_phase48674_candidate_forensic_audit.json', {
    phase: '4.8.6.7.4',
    candidateCount: forensicAudits.length,
    eligibilityCounts,
    entries: forensicAudits,
  });

  const preselected = selectRestrictedBulkCandidates(forensicAudits, rows, 10, 5);

  const revalidation = await liveRevalidateRestrictedCandidates(preselected, rows);

  const survivors = preselected.filter(
    (audit) => !revalidation.removed.some((r) => r.eventId === audit.eventId),
  );

  let finalSelected = survivors;
  if (survivors.length < preselected.length) {
    const removedIds = new Set(revalidation.removed.map((r) => r.eventId));
    const backups = forensicAudits
      .filter((a) => a.finalEligibility === 'safe_field_patch' && !removedIds.has(a.eventId))
      .filter((a) => !preselected.some((p) => p.eventId === a.eventId))
      .map((a) => {
        const row = rows.find((r) => r.eventIdBefore === a.eventId);
        return {
          audit: a,
          score: row ? scoreForensicCandidate(a, row) : -1,
        };
      })
      .filter((b) => b.score >= 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.audit.eventId.localeCompare(right.audit.eventId);
      });

    for (const backup of backups) {
      if (finalSelected.length >= 10) break;
      const backupReval = await liveRevalidateRestrictedCandidates([backup.audit], rows);
      if (backupReval.removed.length === 0) {
        finalSelected = [...finalSelected, backup.audit];
      }
    }
  }

  const driftRemoved: Array<{ eventId: string; reason: string }> = [];
  for (const audit of finalSelected) {
    const row = rows.find((r) => r.eventIdBefore === audit.eventId);
    if (artifactFingerprintDrift(audit, row)) {
      driftRemoved.push({ eventId: audit.eventId, reason: 'artifact_fingerprint_drift' });
    }
  }
  finalSelected = finalSelected.filter((a) => !driftRemoved.some((d) => d.eventId === a.eventId));

  const manifest = buildRestrictedBulkManifest(finalSelected, rows);
  writeJson('_phase48674_restricted_bulk_plan.json', manifest);

  const fixtureAcceptance = runFixtureRebuildAcceptance().acceptance;
  const mutationCount = finalSelected.reduce((sum, audit) => sum + audit.proposedFields.length, 0);

  writeJson('_phase48674_restricted_bulk_preview.json', {
    phase: '4.8.6.7.4',
    invalidPriorManifestHashRejected: isInvalidPriorManifestHash(
      '978aed3839e10116d7b2cab20564c2e6c9ec045869cd73401780820bd175dad5',
    ),
    manifestHash: manifest.manifestHash,
    selectedCount: finalSelected.length,
    selectedEventIds: finalSelected.map((a) => a.eventId),
    removedFromPreselection: [...revalidation.removed, ...driftRemoved],
    liveRevalidation: revalidation.results,
    eligibilityCounts,
    plannedFieldMutations: mutationCount,
    fixtureAcceptance: {
      passed: fixtureAcceptance.passed,
      passCount: fixtureAcceptance.results.filter((r) => r.passed).length,
      total: fixtureAcceptance.results.length,
    },
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
  });

  writeJson('_phase48674_restricted_bulk_rollback.json', {
    phase: '4.8.6.7.4',
    entries: finalSelected.map((audit) => {
      const row = rows.find((r) => r.eventIdBefore === audit.eventId);
      return {
        eventId: audit.eventId,
        eventFields: audit.currentEventFingerprint,
        ticketPhases: row?.existing?.ticketPhases ?? null,
        fieldGroupPatch: row
          ? Object.fromEntries(
              audit.proposedFields.map((field) => [field, row.changeSet[field]]),
            )
          : {},
      };
    }),
  });

  writeJson('_phase48674_restricted_bulk_readiness.json', {
    phase: '4.8.6.7.4',
    readyForRestrictedApply: finalSelected.length > 0,
    selectedCount: finalSelected.length,
    manifestHash: manifest.manifestHash,
    invalidPriorHashes: ['978aed3839e10116d7b2cab20564c2e6c9ec045869cd73401780820bd175dad5'],
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
    nextStep:
      finalSelected.length > 0
        ? 'controlled_restricted_bulk_apply'
        : 'no_safe_candidates_remain',
  });

  console.log(
    JSON.stringify({
      eligibilityCounts,
      preselected: preselected.length,
      finalSelected: finalSelected.length,
      manifestHash: manifest.manifestHash,
      fixturePass: fixtureAcceptance.results.filter((r) => r.passed).length,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
