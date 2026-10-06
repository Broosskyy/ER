import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { parseLinkedQueryRows } from '../../../ingestion/sync/linked-db';
import { loadStagingEventSnapshots, type StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import { isLineupPlaceholderLine, normalizeLineupName } from '../../shared/lineup-normalization';
import {
  detectStructuredDescriptionLeakage,
  separateStructuredEventContent,
  type StructuredContentSeparationResult,
} from '../../shared/structured-content-separation';

export interface StructuredContentInventoryEntry {
  eventId: string;
  title: string;
  beforeDescription: string | null;
  afterDescription?: string;
  currentLineup: string[];
  recommendedLineup: string[];
  currentGenres: string[];
  leakage: ReturnType<typeof detectStructuredDescriptionLeakage>;
  separation: StructuredContentSeparationResult;
  recoverable: boolean;
  confidence: 'high' | 'review';
  provenance: StructuredContentSeparationResult['provenance'];
}

export interface StructuredContentRepairPlanEntry {
  eventId: string;
  title: string;
  beforeDescription: string | null;
  afterDescription: string | null;
  detectedFragments: StructuredContentSeparationResult['fragments'];
  extractedLineup: string[];
  extractedGenres: string[];
  currentLineup: string[];
  mergedLineup: string[];
  confidence: 'high' | 'review';
  provenance: StructuredContentSeparationResult['provenance'];
  noDataLoss: boolean;
}

export interface StructuredContentInventoryMetrics {
  eligibleEvents: number;
  eventsWithDescription: number;
  cleanEditorialDescriptions: number;
  mixedDescriptions: number;
  lineupLeakageCount: number;
  genreLeakageCount: number;
  ticketLeakageCount: number;
  scheduleLeakageCount: number;
  legalBoilerplateCount: number;
  placeholderLeakageCount: number;
  recoverableDescriptionIssues: number;
}

function loadSourceDescriptions(runQuery: LinkedQueryExecutor, eventId: string): string[] {
  const rows = parseLinkedQueryRows<{ raw_payload: Record<string, unknown> | null }>(
    runQuery(`SELECT raw_payload FROM public.event_sources WHERE event_id = '${eventId}'::uuid`),
  );
  const descriptions: string[] = [];
  for (const row of rows) {
    const payload = row.raw_payload ?? {};
    for (const key of ['descriptionRaw', 'descriptionClean', 'description']) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        descriptions.push(value.trim());
      }
    }
  }
  return descriptions;
}

function mergeLineup(current: string[], extracted: string[]): string[] {
  const merged = [...current.map((name) => normalizeLineupName(name)).filter(Boolean)];
  for (const candidate of extracted.map((name) => normalizeLineupName(name)).filter(Boolean)) {
    if (!isLineupPlaceholderLine(candidate) && !merged.some((entry) => entry.toLowerCase() === candidate.toLowerCase())) {
      merged.push(candidate);
    }
  }
  return merged;
}

function chooseSeparation(
  event: StagingEventSnapshot,
  sourceDescriptions: string[],
): StructuredContentSeparationResult {
  const candidates = [event.description, ...sourceDescriptions].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  let best = separateStructuredEventContent(candidates[0]);
  for (const candidate of candidates.slice(1)) {
    const next = separateStructuredEventContent(candidate);
    const bestScore = best.lineupCandidates.length + (best.descriptionResidual?.length ?? 0);
    const nextScore = next.lineupCandidates.length + (next.descriptionResidual?.length ?? 0);
    if (nextScore > bestScore) {
      best = next;
    }
  }
  return best;
}

export function auditStructuredContentInventory(
  runQuery: LinkedQueryExecutor,
): StructuredContentInventoryEntry[] {
  const events = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  return events.map((event) => {
    const sourceDescriptions = loadSourceDescriptions(runQuery, event.eventId);
    const separation = chooseSeparation(event, sourceDescriptions);
    const leakage = detectStructuredDescriptionLeakage(event.description ?? undefined);
    const recommendedLineup = mergeLineup(event.lineup, separation.lineupCandidates);
    const afterDescription = separation.descriptionResidual ?? undefined;
    const descriptionWillChange = (event.description?.trim() ?? '') !== (afterDescription?.trim() ?? '');
    const lineupWillGrow =
      recommendedLineup.length > event.lineup.filter((name) => !isLineupPlaceholderLine(name)).length;
    const recoverable = leakage.recoverable && (descriptionWillChange || lineupWillGrow);
    const lineupComplete =
      separation.lineupCandidates.length === 0 ||
      separation.lineupCandidates.every((artist) =>
        recommendedLineup.some((existing) => existing.toLowerCase() === artist.toLowerCase()),
      );
    const confidence: 'high' | 'review' =
      leakage.legalBoilerplate && !afterDescription?.trim()
        ? 'high'
        : separation.lineupCandidates.length > 0
          ? lineupComplete
            ? 'high'
            : 'review'
          : descriptionWillChange
            ? 'high'
            : 'review';

    return {
      eventId: event.eventId,
      title: event.title,
      beforeDescription: event.description,
      afterDescription,
      currentLineup: event.lineup,
      recommendedLineup,
      currentGenres: event.genres,
      leakage,
      separation,
      recoverable,
      confidence,
      provenance: separation.provenance,
    };
  });
}

export function summarizeStructuredContentInventory(
  entries: StructuredContentInventoryEntry[],
): StructuredContentInventoryMetrics {
  return {
    eligibleEvents: entries.length,
    eventsWithDescription: entries.filter((entry) => Boolean(entry.beforeDescription?.trim())).length,
    cleanEditorialDescriptions: entries.filter(
      (entry) => entry.beforeDescription?.trim() && !entry.leakage.recoverable,
    ).length,
    mixedDescriptions: entries.filter((entry) => entry.separation.classification === 'MIXED').length,
    lineupLeakageCount: entries.filter((entry) => entry.leakage.lineupLeakage).length,
    genreLeakageCount: entries.filter((entry) => entry.leakage.genreLeakage).length,
    ticketLeakageCount: entries.filter((entry) => entry.leakage.ticketLeakage).length,
    scheduleLeakageCount: entries.filter((entry) => entry.leakage.scheduleLeakage).length,
    legalBoilerplateCount: entries.filter((entry) => entry.leakage.legalBoilerplate).length,
    placeholderLeakageCount: entries.filter((entry) => entry.leakage.placeholderLeakage).length,
    recoverableDescriptionIssues: entries.filter((entry) => entry.recoverable).length,
  };
}

export function buildStructuredContentRepairPlan(
  entries: StructuredContentInventoryEntry[],
): StructuredContentRepairPlanEntry[] {
  return entries
    .filter((entry) => entry.recoverable && entry.confidence === 'high')
    .map((entry) => {
      const mergedLineup = entry.recommendedLineup;
      const lineupComplete =
        entry.separation.lineupCandidates.length === 0 ||
        entry.separation.lineupCandidates.every((artist) =>
          mergedLineup.some((existing) => existing.toLowerCase() === artist.toLowerCase()),
        );
      const afterDescription = entry.afterDescription?.trim() ? entry.afterDescription.trim() : null;
      const noDataLoss =
        lineupComplete &&
        entry.separation.lineupCandidates.every(
          (artist) => mergedLineup.some((existing) => existing.toLowerCase() === artist.toLowerCase()),
        );

      return {
        eventId: entry.eventId,
        title: entry.title,
        beforeDescription: entry.beforeDescription,
        afterDescription,
        detectedFragments: entry.separation.fragments,
        extractedLineup: entry.separation.lineupCandidates,
        extractedGenres: entry.separation.genreCandidates,
        currentLineup: entry.currentLineup,
        mergedLineup,
        confidence: entry.confidence,
        provenance: entry.provenance,
        noDataLoss,
      };
    })
    .filter((entry) => entry.noDataLoss);
}

export function applyStructuredContentRepairPlan(
  runQuery: LinkedQueryExecutor,
  plan: StructuredContentRepairPlanEntry[],
): { descriptionWrites: number; lineupWrites: number } {
  let descriptionWrites = 0;
  let lineupWrites = 0;

  for (const entry of plan) {
    const descriptionSql =
      entry.afterDescription === null
        ? 'NULL'
        : `'${entry.afterDescription.replace(/'/g, "''")}'`;
    runQuery(
      `UPDATE public.events SET description = ${descriptionSql}, updated_at = now() WHERE id = '${entry.eventId}'::uuid;`,
    );
    descriptionWrites += 1;

    const needsLineupWrite =
      entry.mergedLineup.length > 0 &&
      JSON.stringify(entry.mergedLineup) !== JSON.stringify(entry.currentLineup);
    if (needsLineupWrite) {
      runQuery(`DELETE FROM public.event_lineup WHERE event_id = '${entry.eventId}'::uuid;`);
      for (const [index, billingName] of entry.mergedLineup.entries()) {
        runQuery(
          `INSERT INTO public.event_lineup (event_id, billing_name, billing_role, sort_order)
           VALUES ('${entry.eventId}'::uuid, '${billingName.replace(/'/g, "''")}', ${index === 0 ? "'headliner'" : "'artist'"}, ${index});`,
        );
      }
      lineupWrites += 1;
    }
  }

  return { descriptionWrites, lineupWrites };
}
