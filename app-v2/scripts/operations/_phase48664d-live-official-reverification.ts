/**
 * Phase 4.8.6.6.4d — Evidence-based provenance reverification (read-only).
 *
 * ER_OPS_ENV_FILE=... npx tsx scripts/operations/_phase48664d-live-official-reverification.ts
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { createSourceConnectorFetchProvider } from '@/features/aggregation/connectors/create-source-connector-fetch-provider';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';
import { AggregationPipeline } from '@/features/aggregation/pipeline/aggregation-pipeline';
import {
  adminEventToIdentitySnapshot,
  canonicalImportEventToEvidenceBundle,
} from '@/features/import/generic-truth-pipeline';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import {
  assertRepairKindAllowed,
  buildStableProvenancePlanManifestHash,
} from '@/features/import/services/provenance-repair-manifest';
import {
  assessOfficialField,
  assessTicketFreshnessField,
  buildFreshnessOnlyAfterSnapshot,
  buildLiveReverificationAfterSnapshot,
  buildProvenancePlanEntry,
  CANARY_TICKET_EVIDENCE_VERIFIED_AT,
  OFFICIAL_BOOTSHAUS_SOURCE_ID,
  OFFICIAL_REVERIFICATION_FIELD_PATHS,
  snapshotFromDbRow,
  TICKET_IO_SOURCE_ID,
} from '@/features/import/services/provenance-reverification-plan';
import { adminSourceRepository } from '@/data/repositories/registry';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

const PHASE = '4.8.6.6.4d';
const CANARY_EVENT_ID = 'evt-1785339418526-dn9f7g0';
const CANARY_TITLE = 'Bootshaus on a Ship Vol. IV';
const OFFICIAL_URL = 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iv';
const TICKET_IO_EXTERNAL_ID = 'https://bootshaus-club.ticket.io/4zjKRnsa/';
const TICKET_IO_URL = 'https://bootshaus-club.ticket.io/4zjKRnsa/';
const CANARY_APPLY_AT = '2026-08-09T19:22:13.576Z';
const REJECTED_MANIFEST_HASH = '474bc892d1c5ad85ad58d50aa38861ce02012e5a86731b67014f7c4e7f62957e';

const CANARY_UPSERTED_FIELD_PATHS = [
  'title',
  'description',
  'startDate',
  'venueName',
  'venueCity',
  'venueAddress',
  'cityName',
  'countryCode',
  'organizerName',
  'ticketUrl',
  'priceText',
  'ticketStatus',
  'websiteUrl',
  'ageRestriction',
] as const;

type ProvenanceDbRow = Record<string, unknown>;

function writeJson(filename: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, filename), JSON.stringify(data, null, 2));
}

function timestampsMatch(left: string | null | undefined, right: string): boolean {
  if (!left) return false;
  const normalizedLeft = left.replace('+00:00', 'Z');
  const normalizedRight = right.replace('+00:00', 'Z');
  return normalizedLeft.startsWith(normalizedRight.slice(0, 19));
}

async function fetchOfficialLiveCandidate(): Promise<{
  candidate: import('@/features/aggregation/domain/canonical-import-event').CanonicalImportEvent;
  bundle: ReturnType<typeof canonicalImportEventToEvidenceBundle>;
  identityGate: ReturnType<typeof evaluateEventEvidenceIdentityGate>;
  fetchObservedAt: string;
}> {
  const officialSource = await adminSourceRepository.getById(OFFICIAL_BOOTSHAUS_SOURCE_ID);
  if (!officialSource) throw new Error('official source missing');

  const pipeline = new AggregationPipeline({
    fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
    logService: new AggregationLogService(),
  });
  const importSource = mapSourceRecordToImportSource(officialSource);
  const pipelineResult = await pipeline.run(
    officialSource,
    importSource,
    'manual',
    'phase48664d-official-evidence-readonly',
  );
  const envelope =
    pipelineResult.records.find((entry) => entry.externalId === OFFICIAL_URL)
    ?? pipelineResult.records.find(
      (entry) =>
        entry.canonicalEvent?.eventUrl === OFFICIAL_URL
        || entry.canonicalEvent?.originalLink === OFFICIAL_URL,
    );
  if (!envelope?.canonicalEvent) {
    throw new Error('official_envelope_missing');
  }

  const fetchObservedAt = new Date().toISOString();
  const candidate = {
    ...envelope.canonicalEvent,
    sourceMetadata: {
      ...(envelope.canonicalEvent.sourceMetadata ?? {}),
      pageTitle:
        (envelope.canonicalEvent.sourceMetadata as Record<string, unknown> | undefined)?.pageTitle
        ?? envelope.canonicalEvent.title,
      eventDate:
        (envelope.canonicalEvent.sourceMetadata as Record<string, unknown> | undefined)?.eventDate
        ?? envelope.canonicalEvent.startDate,
      venueName:
        (envelope.canonicalEvent.sourceMetadata as Record<string, unknown> | undefined)?.venueName
        ?? envelope.canonicalEvent.venueName,
      verifiedAt: fetchObservedAt,
      observedAt: fetchObservedAt,
      sourceUrl: OFFICIAL_URL,
    },
  };
  const bundle = canonicalImportEventToEvidenceBundle(candidate, {
    sourceRole: 'official_website_source',
    sourceUrl: OFFICIAL_URL,
  });

  const { data: eventRow } = await opsClient()
    .from('events')
    .select('*')
    .eq('id', CANARY_EVENT_ID)
    .single();
  const eventAdmin = mapEventRowToAdminRecord(eventRow as EventRow);
  const identityGate = evaluateEventEvidenceIdentityGate({
    event: adminEventToIdentitySnapshot(eventAdmin),
    evidence: {
      pageTitle: bundle.identity.pageTitle,
      listRowTitle: bundle.identity.listRowTitle,
      eventDate: bundle.identity.eventDate,
      venueName: bundle.identity.venueName,
    },
    officialEventUrl: OFFICIAL_URL,
    verifiedAt: bundle.verifiedAt,
  });

  return { candidate, bundle, identityGate, fetchObservedAt };
}

async function fetchTicketIoLiveEvidence(): Promise<{
  candidate: import('@/features/aggregation/domain/canonical-import-event').CanonicalImportEvent;
  bundle: ReturnType<typeof canonicalImportEventToEvidenceBundle>;
}> {
  const ticketSource = await adminSourceRepository.getById(TICKET_IO_SOURCE_ID);
  if (!ticketSource) throw new Error('ticket io source missing');

  const pipeline = new AggregationPipeline({
    fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
    logService: new AggregationLogService(),
  });
  const importSource = mapSourceRecordToImportSource(ticketSource);
  const pipelineResult = await pipeline.run(
    ticketSource,
    importSource,
    'manual',
    'phase48664d-ticket-evidence-readonly',
  );
  const envelope = pipelineResult.records.find((entry) => entry.externalId === TICKET_IO_EXTERNAL_ID);
  if (!envelope?.canonicalEvent) {
    throw new Error('ticket_io_envelope_missing');
  }
  const candidate = envelope.canonicalEvent;
  const bundle = canonicalImportEventToEvidenceBundle(candidate, {
    sourceRole: 'ticket_platform',
    sourceUrl: TICKET_IO_URL,
  });
  return { candidate, bundle };
}

async function main(): Promise<void> {
  const client = opsClient();

  const { data: provenanceData, error: provenanceError } = await client
    .from('event_field_provenance')
    .select('*')
    .eq('canonical_event_id', CANARY_EVENT_ID)
    .order('field_path');
  if (provenanceError) throw new Error(provenanceError.message);

  const allRows = (provenanceData ?? []) as ProvenanceDbRow[];
  const canaryRows = allRows.filter((row) =>
    CANARY_UPSERTED_FIELD_PATHS.includes(String(row.field_path) as typeof CANARY_UPSERTED_FIELD_PATHS[number]),
  );
  const nonCanaryRows = allRows.filter(
    (row) =>
      !CANARY_UPSERTED_FIELD_PATHS.includes(
        String(row.field_path) as typeof CANARY_UPSERTED_FIELD_PATHS[number],
      ),
  );

  const { data: eventRow, error: eventError } = await client
    .from('events')
    .select('*')
    .eq('id', CANARY_EVENT_ID)
    .single();
  if (eventError) throw new Error(eventError.message);
  const eventAdmin = mapEventRowToAdminRecord(eventRow as EventRow);

  const manualLocks = allRows
    .filter((row) => row.manually_overridden === true || row.selected_source_id === 'manual_override')
    .map((row) => String(row.field_path));

  const officialLive = await fetchOfficialLiveCandidate();
  const ticketLive = await fetchTicketIoLiveEvidence();

  const liveOfficialEvidence = {
    phase: PHASE,
    productionMutationsInThisRun: 0,
    canonicalEventId: CANARY_EVENT_ID,
    officialUrl: OFFICIAL_URL,
    ticketIoUrl: TICKET_IO_URL,
    fetchObservedAt: officialLive.fetchObservedAt,
    identityGate: {
      verdict: officialLive.identityGate.verdict,
      reason: officialLive.identityGate.reason,
      titleScore: officialLive.identityGate.titleScore,
      dateAgrees: officialLive.identityGate.dateAgrees,
      venueAgrees: officialLive.identityGate.venueAgrees,
    },
    bundle: {
      sourceId: officialLive.bundle.sourceId,
      sourceRole: officialLive.bundle.sourceRole,
      verifiedAt: officialLive.bundle.verifiedAt,
      sourceNativeEvidence: officialLive.bundle.sourceNativeEvidence,
      identity: officialLive.bundle.identity,
      content: officialLive.bundle.content,
    },
    candidate: {
      title: officialLive.candidate.title,
      description: officialLive.candidate.description,
      startDate: officialLive.candidate.startDate,
      venueName: officialLive.candidate.venueName,
      venueAddress: officialLive.candidate.venueAddress,
      cityName: officialLive.candidate.cityName,
      countryCode: officialLive.candidate.countryCode,
      organizerName: officialLive.candidate.organizerName,
      eventUrl: officialLive.candidate.eventUrl,
      sourceMetadata: officialLive.candidate.sourceMetadata,
    },
    ticketEvidence: {
      verifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
      liveTicketUrl: ticketLive.candidate.ticketUrl,
      livePriceText: ticketLive.candidate.priceText ?? ticketLive.bundle.tickets?.priceText,
      liveAvailability: ticketLive.bundle.tickets?.availability,
    },
    fieldAssessments: OFFICIAL_REVERIFICATION_FIELD_PATHS.map((fieldPath) => {
      const assessment = assessOfficialField(fieldPath, {
        candidate: officialLive.candidate,
        bundle: officialLive.bundle,
        event: eventAdmin,
        identityVerdict: officialLive.identityGate.verdict,
        officialUrl: OFFICIAL_URL,
        manualLocked: manualLocks.includes(fieldPath),
      });
      return assessment;
    }),
  };

  const groupA: ReturnType<typeof buildProvenancePlanEntry>[] = [];
  const groupB: ReturnType<typeof buildProvenancePlanEntry>[] = [];
  const groupC: ReturnType<typeof buildProvenancePlanEntry>[] = [];

  for (const fieldPath of ['priceText', 'ticketStatus', 'ticketUrl'] as const) {
    const row = canaryRows.find((entry) => String(entry.field_path) === fieldPath);
    if (!row) continue;
    const current = snapshotFromDbRow(row);
    const ticketAssessment = assessTicketFreshnessField(fieldPath, {
      event: eventAdmin,
      ticketEvidenceUrl: TICKET_IO_URL,
      ticketEvidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
      liveTicketUrl: ticketLive.candidate.ticketUrl,
      livePriceText: ticketLive.candidate.priceText ?? ticketLive.bundle.tickets?.priceText,
      liveTicketStatus: fieldPath === 'ticketStatus' ? eventAdmin.ticketStatus : undefined,
    });

    if (ticketAssessment.repairKind === 'review_only') {
      groupC.push(
        buildProvenancePlanEntry({
          group: 'C',
          fieldPath,
          canonicalEventId: CANARY_EVENT_ID,
          current,
          after: current,
          repairKind: 'review_only',
          evidenceUrl: TICKET_IO_URL,
          evidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
          repairReason: ticketAssessment.reviewReasons.join(';') || 'ticket_evidence_not_confirmed',
        }),
      );
      continue;
    }

    assertRepairKindAllowed('freshness_only_known_evidence', {
      hasKnownEvidenceVerifiedAt: true,
    });
    const after = buildFreshnessOnlyAfterSnapshot(current, CANARY_TICKET_EVIDENCE_VERIFIED_AT);
    groupA.push(
      buildProvenancePlanEntry({
        group: 'A',
        fieldPath,
        canonicalEventId: CANARY_EVENT_ID,
        current,
        after,
        repairKind: 'freshness_only_known_evidence',
        evidenceUrl: TICKET_IO_URL,
        evidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
        repairReason: 'ticket_evidence_freshness_correction',
      }),
    );
  }

  for (const fieldPath of OFFICIAL_REVERIFICATION_FIELD_PATHS) {
    const row = canaryRows.find((entry) => String(entry.field_path) === fieldPath);
    if (!row) continue;
    const current = snapshotFromDbRow(row);
    const assessment = assessOfficialField(fieldPath, {
      candidate: officialLive.candidate,
      bundle: officialLive.bundle,
      event: eventAdmin,
      identityVerdict: officialLive.identityGate.verdict,
      officialUrl: OFFICIAL_URL,
      manualLocked: manualLocks.includes(fieldPath),
    });

    if (assessment.repairKind !== 'live_source_reverification') {
      groupC.push(
        buildProvenancePlanEntry({
          group: 'C',
          fieldPath,
          canonicalEventId: CANARY_EVENT_ID,
          current,
          after: current,
          repairKind: 'review_only',
          evidenceUrl: OFFICIAL_URL,
          evidenceVerifiedAt: officialLive.bundle.verifiedAt,
          repairReason: assessment.reviewReasons.join(';') || 'official_reverification_not_confirmed',
        }),
      );
      continue;
    }

    assertRepairKindAllowed('live_source_reverification', {
      liveReverificationConfirmed: true,
    });
    const after = buildLiveReverificationAfterSnapshot({
      current,
      officialSourceId: OFFICIAL_BOOTSHAUS_SOURCE_ID,
      confirmedEventValue: assessment.eventValue,
      evidenceVerifiedAt: officialLive.bundle.verifiedAt,
      evidenceUrl: OFFICIAL_URL,
      officialTier: 'official_website',
    });
    groupB.push(
      buildProvenancePlanEntry({
        group: 'B',
        fieldPath,
        canonicalEventId: CANARY_EVENT_ID,
        current,
        after,
        repairKind: 'live_source_reverification',
        evidenceUrl: OFFICIAL_URL,
        evidenceVerifiedAt: officialLive.bundle.verifiedAt,
        repairReason: 'live_official_native_evidence_matches_event',
      }),
    );
  }

  const manifestHash = buildStableProvenancePlanManifestHash({
    phase: PHASE,
    canonicalEventId: CANARY_EVENT_ID,
    ticketEvidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
    entries: [...groupA, ...groupB, ...groupC],
  });

  const nonCanaryDocumentation = nonCanaryRows.map((row) => {
    const selectedAt = String(row.selected_at ?? '');
    const updatedAt = String(row.updated_at ?? '');
    const canaryTimestampMatch =
      timestampsMatch(selectedAt, CANARY_APPLY_AT) && timestampsMatch(updatedAt, CANARY_APPLY_AT);
    return {
      field_path: row.field_path,
      primaryKey: row.id,
      selected_at: selectedAt,
      updated_at: updatedAt,
      selected_source_id: row.selected_source_id,
      canaryApplyTimestampMatch: canaryTimestampMatch,
      likelyCanaryContamination: canaryTimestampMatch,
      likelyEarlierRun:
        !canaryTimestampMatch && selectedAt.length > 0 && !timestampsMatch(selectedAt, CANARY_APPLY_AT),
      mergeRisk:
        canaryTimestampMatch
          ? 'medium — apply-time provenance timestamps without canary field-path scope'
          : 'low unless selected source conflicts with live imports',
      includedInApplyPlan: false,
      reason: 'outside fourteen canary-upserted publish-tracked fields',
    };
  });

  const safePlan = {
    phase: PHASE,
    productionMutationsInThisRun: 0,
    readOnly: true,
    rolloutActivated: false,
    rejectedManifestHash: REJECTED_MANIFEST_HASH,
    rejectionReason: '474bc892 plan used approximated before snapshots; not authorized',
    canonicalEventId: CANARY_EVENT_ID,
    title: CANARY_TITLE,
    ticketEvidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
    manifestHash,
    groupA,
    groupB,
    groupC,
    summary: {
      groupA: groupA.length,
      groupB: groupB.length,
      groupC: groupC.length,
    },
  };

  const rollback = {
    phase: PHASE,
    productionMutationsInThisRun: 0,
    manifestHash,
    rollbackEntries: [...groupA, ...groupB].map((entry) => ({
      fieldPath: entry.fieldPath,
      provenanceId: entry.provenanceId,
      group: entry.group,
      repairKind: entry.repairKind,
      restoreSnapshot: entry.rollbackSnapshot,
      rowFingerprint: entry.rowFingerprint,
    })),
  };

  const reviewOnly = {
    phase: PHASE,
    productionMutationsInThisRun: 0,
    reviewOnlyEntries: groupC,
    nonCanaryProvenance: nonCanaryDocumentation,
  };

  const readiness = {
    phase: PHASE,
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
    rejectedManifestHash: REJECTED_MANIFEST_HASH,
    manifestHash,
    groupAApplyReady: groupA.length > 0,
    groupBApplyReadyCount: groupB.length,
    reviewOnlyCount: groupC.length,
    provenanceRepairApplyReady: groupA.length + groupB.length > 0,
    blockers: groupC.length > 0 ? [`${groupC.length} fields remain review_only`] : [],
    tests: {
      reverificationPlan: 'provenance-reverification-plan.test.ts',
      repairManifest: 'provenance-repair-manifest.test.ts',
    },
    nextStep: 'Apply 48664d manifest after explicit production authorization',
  };

  writeJson('_phase48664d_live_official_evidence.json', liveOfficialEvidence);
  writeJson('_phase48664d_safe_provenance_plan.json', safePlan);
  writeJson('_phase48664d_safe_provenance_rollback.json', rollback);
  writeJson('_phase48664d_review_only.json', reviewOnly);
  writeJson('_phase48664d_readiness.json', readiness);

  console.log(
    JSON.stringify(
      {
        phase: PHASE,
        manifestHash,
        rejected: REJECTED_MANIFEST_HASH,
        groupA: groupA.length,
        groupB: groupB.length,
        groupC: groupC.length,
        identityVerdict: officialLive.identityGate.verdict,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
