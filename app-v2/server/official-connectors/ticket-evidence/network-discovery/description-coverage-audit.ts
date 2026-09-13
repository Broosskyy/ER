import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { parseLinkedQueryRows } from '../../../ingestion/sync/linked-db';
import { loadStagingEventSnapshots, type StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import {
  descriptionQualityScore,
  extractEditorialDescription,
  isInvalidPrimaryDescription,
  preferDescription,
} from '../../shared/description-quality';
import { separateStructuredEventContent } from '../../shared/structured-content-separation';

export type DescriptionCoverageClassification =
  | 'DESCRIPTION_VERIFIED'
  | 'DESCRIPTION_RECOVERABLE'
  | 'DESCRIPTION_UNRESOLVED_NO_EVIDENCE';

export interface DescriptionCoverageEntry {
  eventId: string;
  title: string;
  currentDescriptionQuality: number;
  invalidPrimaryDescription: boolean;
  availableDescriptionEvidence: string[];
  evidenceStrength: 'strong' | 'weak' | 'none';
  recommendedDescription?: string;
  classification: DescriptionCoverageClassification;
  reason?: string;
}

interface SourcePayloadRow {
  source_url: string;
  raw_payload: Record<string, unknown> | null;
}

function collectDescriptionEvidence(
  event: StagingEventSnapshot,
  sourceRows: SourcePayloadRow[],
): string[] {
  const candidates = new Set<string>();
  if (event.description?.trim()) {
    candidates.add(event.description.trim());
  }
  for (const row of sourceRows) {
    const payload = row.raw_payload ?? {};
    for (const key of ['descriptionClean', 'descriptionRaw', 'description']) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        candidates.add(value.trim());
      }
    }
  }
  return [...candidates];
}

function loadSourcePayloads(
  runQuery: LinkedQueryExecutor,
  eventId: string,
): SourcePayloadRow[] {
  return parseLinkedQueryRows<SourcePayloadRow>(
    runQuery(`SELECT source_url, raw_payload FROM public.event_sources WHERE event_id = '${eventId}'::uuid`),
  );
}

function editorialResidualFromRaw(text?: string): string | undefined {
  if (!text?.trim()) {
    return undefined;
  }
  const separated = separateStructuredEventContent(text);
  const residual = separated.descriptionResidual ?? separated.editorialText;
  if (residual?.trim()) {
    return extractEditorialDescription(residual) ?? residual.trim();
  }
  return undefined;
}

function pickRecommendedDescription(
  current: string | null | undefined,
  evidence: string[],
): { value?: string; strength: 'strong' | 'weak' | 'none' } {
  let best = editorialResidualFromRaw(current);
  let bestScore = descriptionQualityScore(best);
  for (const candidate of evidence) {
    const separated = editorialResidualFromRaw(candidate);
    const preferred = preferDescription(best, separated);
    const score = descriptionQualityScore(preferred.value);
    if (score > bestScore + 0.05) {
      best = preferred.value;
      bestScore = score;
    }
  }
  if (!best || bestScore <= 0) {
    const structuredOnly = evidence
      .map((entry) => separateStructuredEventContent(entry))
      .find((entry) => entry.classification === 'PURE_STRUCTURED');
    if (structuredOnly) {
      return { value: undefined, strength: 'strong' };
    }
    return { strength: 'none' };
  }
  if (bestScore >= 0.35) {
    return { value: best, strength: 'strong' };
  }
  return { value: best, strength: 'weak' };
}

export function auditDescriptionCoverage(runQuery: LinkedQueryExecutor): DescriptionCoverageEntry[] {
  const events = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  return events.map((event) => {
    const sourceRows = loadSourcePayloads(runQuery, event.eventId);
    const evidence = collectDescriptionEvidence(event, sourceRows);
    const currentQuality = descriptionQualityScore(event.description ?? undefined);
    const invalid = isInvalidPrimaryDescription(event.description ?? undefined);
    const recommended = pickRecommendedDescription(event.description, evidence);
    const recommendedQuality = descriptionQualityScore(recommended.value);

    if (!invalid) {
      return {
        eventId: event.eventId,
        title: event.title,
        currentDescriptionQuality: currentQuality,
        invalidPrimaryDescription: false,
        availableDescriptionEvidence: evidence.map((entry) => entry.slice(0, 160)),
        evidenceStrength: recommended.strength,
        recommendedDescription: recommended.value,
        classification: 'DESCRIPTION_VERIFIED',
      };
    }

    const pureStructuredResidual =
      invalid && recommended.strength === 'strong' && !recommended.value?.trim();
    if (
      pureStructuredResidual ||
      (recommended.value && recommendedQuality > currentQuality + 0.1 && recommended.strength !== 'none')
    ) {
      return {
        eventId: event.eventId,
        title: event.title,
        currentDescriptionQuality: currentQuality,
        invalidPrimaryDescription: true,
        availableDescriptionEvidence: evidence.map((entry) => entry.slice(0, 160)),
        evidenceStrength: recommended.strength,
        recommendedDescription: recommended.value,
        classification: 'DESCRIPTION_RECOVERABLE',
        reason: pureStructuredResidual
          ? 'structured_metadata_only_source_description'
          : 'verified_source_or_payload_editorial_evidence',
      };
    }

    return {
      eventId: event.eventId,
      title: event.title,
      currentDescriptionQuality: currentQuality,
      invalidPrimaryDescription: true,
      availableDescriptionEvidence: evidence.map((entry) => entry.slice(0, 160)),
      evidenceStrength: 'none',
      classification: 'DESCRIPTION_UNRESOLVED_NO_EVIDENCE',
      reason: 'no_verified_editorial_description_evidence',
    };
  });
}

export function repairRecoverableDescriptions(
  runQuery: LinkedQueryExecutor,
  entries: DescriptionCoverageEntry[],
): number {
  let repaired = 0;
  for (const entry of entries.filter((item) => item.classification === 'DESCRIPTION_RECOVERABLE')) {
    const descriptionSql =
      entry.recommendedDescription?.trim()
        ? `'${entry.recommendedDescription.replace(/'/g, "''")}'`
        : 'NULL';
    runQuery(
      `UPDATE public.events SET description = ${descriptionSql}, updated_at = now() WHERE id = '${entry.eventId}'::uuid;`,
    );
    repaired += 1;
  }
  return repaired;
}
