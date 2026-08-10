import { runAcceptanceAudit } from './acceptance-runner';
import {
  BULK_REBUILD_ACCEPTANCE_FIXTURES,
  type BulkAcceptanceFixtureKey,
} from './acceptance-fixtures';
import {
  buildAllFixtureContributions,
  buildFixtureContributions,
  buildFixtureExistingRecord,
} from './acceptance-fixture-catalog';
import { auditConsumerQuality } from './consumer-quality-audit';
import {
  assessPublishCore,
  buildChangeSet,
  classifyDisposition,
  detectContamination,
  resolveIdPreservation,
} from './disposition';
import {
  blockedContributionKeysFromTriage,
  contentBlockedContributionKeysFromTriage,
  triageClusterCollisions,
} from './collision-triage';
import {
  buildConsumerProjection,
  rebuiltToAdminShape,
} from './evidence-field-extractor';
import { assembleRebuiltCanonicalEvent } from './rebuild-assembler';
import type { BulkRebuildEventRow } from './types';

function buildFixtureRow(
  key: BulkAcceptanceFixtureKey,
  contributions: ReturnType<typeof buildFixtureContributions>,
): BulkRebuildEventRow {
  const fixture = BULK_REBUILD_ACCEPTANCE_FIXTURES.find((entry) => entry.key === key);
  const eventId = fixture?.eventId ?? `fixture-${key}`;
  const existing = buildFixtureExistingRecord(eventId);

  const triage = triageClusterCollisions(contributions, existing);
  const ticketBlockedKeys = blockedContributionKeysFromTriage(triage);
  const contentBlockedKeys = contentBlockedContributionKeysFromTriage(triage);
  const hasCollision = triage.clusterCollision;
  const hasCollisionReport = hasCollision || triage.isolatedContributionKeys.length > 0;
  const hasContamination = detectContamination(contributions);

  const rebuilt = assembleRebuiltCanonicalEvent({
    contributions,
    collisionContributionKeys: ticketBlockedKeys,
    contentBlockedContributionKeys: contentBlockedKeys,
    eventId,
  });

  const publishCore = assessPublishCore(rebuilt, contributions);
  rebuilt.publishCoreSecure = publishCore.secure;
  rebuilt.missingOptionalFields = publishCore.missingOptional;
  rebuilt.fieldGroupReadiness = publishCore.fieldGroupReadiness;

  const identityVerdicts = contributions.map((c) => c.identityVerdict);
  const changeSet = buildChangeSet(existing, rebuilt);
  const disposition = classifyDisposition({
    existing,
    rebuilt,
    changeSet,
    hasCollision,
    hasContamination,
    publishCore,
    identityVerdicts,
    manualLocks: [],
    hasContributions: contributions.length > 0,
  });

  const idPreservation = resolveIdPreservation({
    existing,
    hasCollision,
    identityVerdicts,
    publishCoreSecure: publishCore.secure,
  });

  const rebuiltAdmin = rebuiltToAdminShape(rebuilt, {
    id: eventId,
    status: existing?.status,
  });
  const consumerAfter = buildConsumerProjection(rebuiltAdmin, rebuilt.lineupArtistNames ?? []);
  const consumerQuality = auditConsumerQuality(rebuiltAdmin, rebuilt.lineupArtistNames ?? []);

  return {
    eventIdBefore: eventId,
    rowOrigin: 'identity_cluster',
    clusterId: `fixture:${key}`,
    disposition,
    idPreservation,
    existing,
    rebuilt,
    sourceContributions: contributions,
    changeSet,
    consumerAfter,
    consumerQuality,
    collision: hasCollisionReport
      ? {
          triage: triage.triageByContribution,
          isolatedContributionKeys: triage.isolatedContributionKeys,
          reasons: triage.reasons,
          clusterCollision: triage.clusterCollision,
        }
      : undefined,
    manualLocks: [],
    reviewReasons: hasCollision ? ['collision_review_required'] : [],
  };
}

export function runFixtureRebuildAcceptance(): {
  rows: BulkRebuildEventRow[];
  acceptance: ReturnType<typeof runAcceptanceAudit>;
} {
  const rows: BulkRebuildEventRow[] = BULK_REBUILD_ACCEPTANCE_FIXTURES.map((fixture) =>
    buildFixtureRow(fixture.key, buildFixtureContributions(fixture.key)),
  );

  const collisionRows = rows.filter(
    (row) => row.disposition === 'review_collision' || Boolean(row.collision),
  );
  const acceptance = runAcceptanceAudit(rows, collisionRows);

  return { rows, acceptance };
}

export function runAllFixtureContributionsRebuild(): BulkRebuildEventRow[] {
  const allContributions = buildAllFixtureContributions();
  return BULK_REBUILD_ACCEPTANCE_FIXTURES.map((fixture) => {
    const contributions = allContributions.filter((c) => c.mappedEventId === fixture.eventId);
    return buildFixtureRow(fixture.key, contributions);
  });
}
