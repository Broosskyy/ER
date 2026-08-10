import type { BulkRebuildEventRow } from './types';

export function buildCutoverPlan(rows: BulkRebuildEventRow[]): Record<string, unknown> {
  const safeCandidates = rows.filter(
    (row) =>
      row.disposition === 'ready_unchanged' ||
      row.disposition === 'ready_update' ||
      row.disposition === 'ready_new' ||
      row.disposition === 'ready_partial',
  );
  const reviewBlocked = rows.filter(
    (row) =>
      row.disposition.startsWith('review_') ||
      row.disposition === 'blocked_contamination' ||
      row.disposition === 'archive_duplicate',
  );

  return {
    phase: '4.8.6.7',
    applyOrder: [
      'verify_live_fingerprints',
      'capture_before_snapshots',
      'update_preserve_existing_ids',
      'create_new_safe_events',
      'write_source_references',
      'write_provenance_for_applied_fields_only',
      'replace_lineup_atomically',
      'preserve_user_relationships',
      'archive_duplicates_superseded_status',
      'consumer_readback_verification',
      'per_event_rollback_on_failure',
    ],
    safeCandidateCount: safeCandidates.length,
    blockedCount: reviewBlocked.length,
    steps: safeCandidates.map((row) => ({
      eventIdBefore: row.eventIdBefore,
      disposition: row.disposition,
      idPreservation: row.idPreservation,
      changeFields: Object.keys(row.changeSet),
      userRelationshipPreserve: [
        'saved_events',
        'favorites',
        'organizer_links',
        'venue_links',
        'source_references',
        'provenance',
        'lineup_entries',
        'deep_links',
        'analytics_references',
        'admin_review_references',
      ],
      duplicateHandling: row.disposition === 'archive_duplicate' ? 'superseded_not_delete' : 'none',
    })),
    blocked: reviewBlocked.map((row) => ({
      eventIdBefore: row.eventIdBefore,
      disposition: row.disposition,
      reviewReasons: row.reviewReasons,
    })),
    productionMutationsRequired: false,
    note: 'Preview only — do not apply without explicit cutover approval.',
  };
}

export function buildRollbackPlan(rows: BulkRebuildEventRow[]): Record<string, unknown> {
  return {
    phase: '4.8.6.7',
    strategy: 'per_event_snapshot_restore',
    eventsWithSnapshots: rows
      .filter((row) => row.existing)
      .map((row) => ({
        eventId: row.eventIdBefore,
        fingerprintFields: Object.keys(row.changeSet),
        beforeSnapshot: {
          title: row.existing?.title,
          startDate: row.existing?.startDate,
          endDate: row.existing?.endDate,
          venueName: row.existing?.venueName,
          ticketUrl: row.existing?.ticketUrl,
          priceText: row.existing?.priceText,
          ticketStatus: row.existing?.ticketStatus,
          description: row.existing?.description?.slice(0, 200),
        },
      })),
    rollbackTriggers: [
      'consumer_readback_mismatch',
      'identity_collision_after_apply',
      'user_relationship_break',
      'manual_lock_violation',
    ],
    noPhysicalDeletes: true,
  };
}
