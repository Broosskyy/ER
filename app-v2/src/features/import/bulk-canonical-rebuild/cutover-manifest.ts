import { createHash } from 'node:crypto';

import type { BulkRebuildEventRow } from './types';

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.keys(entry as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (entry as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return entry;
  });
}

function fingerprintEvent(existing: BulkRebuildEventRow['existing']): Record<string, unknown> {
  if (!existing) return {};
  return {
    title: existing.title,
    startDate: existing.startDate,
    endDate: existing.endDate,
    venueName: existing.venueName,
    organizerName: existing.organizerName,
    websiteUrl: existing.websiteUrl,
    ticketUrl: existing.ticketUrl,
    priceText: existing.priceText,
    ticketStatus: existing.ticketStatus,
    genreLabels: existing.genreLabels,
    descriptionLength: existing.description?.length ?? 0,
  };
}

function sourceNativeSummary(row: BulkRebuildEventRow): Record<string, unknown> {
  return {
    contributions: row.sourceContributions.map((c) => ({
      sourceId: c.sourceId,
      externalId: c.externalId,
      role: c.bundle.sourceRole,
      identityVerdict: c.identityVerdict,
      verifiedAt: c.verifiedAt,
      detailFetchStatus: c.detailEvidence?.fetchStatus,
    })),
    evidenceByFieldGroup: row.rebuilt.evidenceByFieldGroup,
  };
}

export function buildBulkCutoverManifest(rows: BulkRebuildEventRow[]): Record<string, unknown> {
  const safeCandidates = rows.filter(
    (row) =>
      row.disposition === 'ready_unchanged' ||
      row.disposition === 'ready_update' ||
      row.disposition === 'ready_new' ||
      row.disposition === 'ready_partial',
  );

  const entries = safeCandidates.map((row) => {
    const allowedFieldGroups = Object.keys(row.changeSet);
    const protectedFields = Object.keys(row.changeSet).filter((field) =>
      row.manualLocks.some((lock) => lock.includes(field)),
    );

    return {
      eventId: row.eventIdBefore,
      clusterId: row.clusterId,
      rowOrigin: row.rowOrigin,
      disposition: row.disposition,
      idPreservation: row.idPreservation,
      beforeFingerprint: fingerprintEvent(row.existing),
      sourceNativeEvidence: sourceNativeSummary(row),
      allowedFieldGroups,
      plannedPatch: row.changeSet,
      protectedFields,
      unchangedFields: Object.keys(fingerprintEvent(row.existing)).filter(
        (key) => !row.changeSet[key],
      ),
      consumerBefore: row.consumerBefore,
      consumerAfter: row.consumerAfter,
      provenancePlan: allowedFieldGroups.map((field) => ({
        field,
        sourceId: row.sourceContributions[0]?.sourceId,
        freshnessAt: row.rebuilt.verifiedAt,
      })),
      rollback: {
        eventFields: fingerprintEvent(row.existing),
        ticketPhases: row.existing?.ticketPhases ?? null,
        lineupArtistNames: row.rebuilt.lineupArtistNames ?? [],
      },
      cleanRebuildAudit: row.cleanRebuildAudit,
    };
  });

  const manifestBody = {
    phase: '4.8.6.7.3',
    candidateCount: entries.length,
    entries,
  };

  const manifestHash = createHash('sha256').update(stableStringify(manifestBody)).digest('hex');

  return {
    ...manifestBody,
    manifestHash,
    productionMutationsRequired: false,
    note: 'Prepared manifest only — not applied.',
  };
}

export function buildBulkCutoverRollback(rows: BulkRebuildEventRow[]): Record<string, unknown> {
  const safeCandidates = rows.filter(
    (row) =>
      row.disposition === 'ready_unchanged' ||
      row.disposition === 'ready_update' ||
      row.disposition === 'ready_new' ||
      row.disposition === 'ready_partial',
  );

  return {
    phase: '4.8.6.7.3',
    strategy: 'per_event_snapshot_restore',
    events: safeCandidates.map((row) => ({
      eventId: row.eventIdBefore,
      clusterId: row.clusterId,
      rollbackPatch: fingerprintEvent(row.existing),
      ticketPhases: row.existing?.ticketPhases ?? null,
      ticketUrl: row.existing?.ticketUrl ?? null,
      priceText: row.existing?.priceText ?? null,
      provenanceRestore: 'selected_source_from_before_snapshot',
      lineupRestore: 'atomic_replace_from_before',
      venueOrganizerRelations: {
        venueName: row.existing?.venueName,
        organizerName: row.existing?.organizerName,
      },
    })),
    noPhysicalDeletes: true,
  };
}
