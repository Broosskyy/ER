import { describe, expect, it } from 'vitest';

import {
  buildExpectedInsertFingerprint,
  captureProvenanceFieldRollbackPlans,
  mapDbProvenanceRow,
  provenanceRowFingerprint,
  resolveProvenanceRollbackActions,
  type ProvenanceRollbackRowSnapshot,
} from '@/features/import/domain/provenance-rollback-snapshot';

const EVENT_ID = 'evt-1785339382025-cazpz3d';
const ATTEMPT = {
  selectionReason: 'bootshaus_golden_ticketio_seven_apply',
  freshnessAt: '2026-08-12T18:37:21.812Z',
  selectedSourceId: 'source-bootshaus-ticket-io',
};

const existingPriceTextRow: ProvenanceRollbackRowSnapshot = {
  id: `provenance-${EVENT_ID}-priceText`,
  canonicalEventId: EVENT_ID,
  fieldPath: 'priceText',
  selectedValue: 'Tickets ab 23,90 Euro',
  selectedSourceId: ATTEMPT.selectedSourceId,
  selectedAt: '2026-08-02T21:25:03.477+00:00',
  selectionReason: 'import_publish',
  alternatives: [],
  manuallyOverridden: false,
  updatedAt: '2026-08-02T21:25:03.477+00:00',
  freshnessAt: '2026-08-02T21:25:03.477+00:00',
};

const insertedTicketPhasesValue = [
  {
    id: 'phase-list-admission-io/ta3dbrv7/',
    name: 'List admission',
    sortOrder: 900,
    kind: 'other',
    priceAmount: 25.9,
    priceCurrency: 'EUR',
    priceLabel: 'ab 25,90 €',
    soldOut: false,
    isFree: false,
    purchaseUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
  },
];

const insertedTicketPhasesRow: ProvenanceRollbackRowSnapshot = {
  id: `provenance-${EVENT_ID}-ticketPhases`,
  canonicalEventId: EVENT_ID,
  fieldPath: 'ticketPhases',
  selectedValue: insertedTicketPhasesValue,
  selectedSourceId: ATTEMPT.selectedSourceId,
  selectedAt: ATTEMPT.freshnessAt,
  selectionReason: ATTEMPT.selectionReason,
  alternatives: [],
  manuallyOverridden: false,
  updatedAt: ATTEMPT.freshnessAt,
  freshnessAt: ATTEMPT.freshnessAt,
};

describe('provenance rollback snapshot', () => {
  it('restores an existing row from the exact before snapshot', () => {
    const plans = captureProvenanceFieldRollbackPlans({
      eventId: EVENT_ID,
      fieldPaths: ['priceText'],
      beforeRows: [existingPriceTextRow],
      attempt: ATTEMPT,
      plannedInsertValues: {},
    });
    const appliedRow: ProvenanceRollbackRowSnapshot = {
      ...existingPriceTextRow,
      selectedValue: 'ab 25,90 €',
      selectionReason: ATTEMPT.selectionReason,
      freshnessAt: ATTEMPT.freshnessAt,
    };
    const result = resolveProvenanceRollbackActions({
      plans,
      currentRows: [appliedRow],
    });
    expect(result.restoreCount).toBe(1);
    expect(result.resolutions[0]?.action).toBe('restore_exact_snapshot');
    expect(result.resolutions[0]?.restoreSnapshot).toEqual(existingPriceTextRow);
  });

  it('marks absent before rows for delete_exact_insert when the insert fingerprint matches', () => {
    const plans = captureProvenanceFieldRollbackPlans({
      eventId: EVENT_ID,
      fieldPaths: ['ticketPhases'],
      beforeRows: [],
      attempt: ATTEMPT,
      plannedInsertValues: {
        ticketPhases: insertedTicketPhasesValue,
      },
    });
    const result = resolveProvenanceRollbackActions({
      plans,
      currentRows: [insertedTicketPhasesRow],
    });
    expect(result.deleteCount).toBe(1);
    expect(result.resolutions[0]?.action).toBe('delete_exact_insert');
    expect(result.resolutions[0]?.provenanceId).toBe(insertedTicketPhasesRow.id);
  });

  it('never deletes a foreign provenance row', () => {
    const foreignRow: ProvenanceRollbackRowSnapshot = {
      ...insertedTicketPhasesRow,
      id: 'provenance-foreign',
      selectionReason: 'import_publish',
      freshnessAt: '2026-08-02T21:25:03.477+00:00',
    };
    const plans = captureProvenanceFieldRollbackPlans({
      eventId: EVENT_ID,
      fieldPaths: ['ticketPhases'],
      beforeRows: [],
      attempt: ATTEMPT,
      plannedInsertValues: {
        ticketPhases: insertedTicketPhasesValue,
      },
    });
    const result = resolveProvenanceRollbackActions({
      plans,
      currentRows: [foreignRow],
    });
    expect(result.deleteCount).toBe(0);
    expect(result.abortCount).toBe(1);
    expect(result.resolutions[0]?.action).toBe('abort_due_to_drift');
  });

  it('aborts when an absent-before insert row was materially changed', () => {
    const driftedRow: ProvenanceRollbackRowSnapshot = {
      ...insertedTicketPhasesRow,
      selectedValue: [
        {
          ...insertedTicketPhasesValue[0]!,
          priceAmount: 19.9,
        },
      ],
    };
    const plans = captureProvenanceFieldRollbackPlans({
      eventId: EVENT_ID,
      fieldPaths: ['ticketPhases'],
      beforeRows: [],
      attempt: ATTEMPT,
      plannedInsertValues: {
        ticketPhases: insertedTicketPhasesValue,
      },
    });
    const result = resolveProvenanceRollbackActions({
      plans,
      currentRows: [driftedRow],
    });
    expect(result.abortCount).toBe(1);
    expect(result.resolutions[0]?.action).toBe('abort_due_to_drift');
  });

  it('aborts when an existing field is missing its before snapshot', () => {
    const plans = captureProvenanceFieldRollbackPlans({
      eventId: EVENT_ID,
      fieldPaths: ['priceText'],
      beforeRows: [],
      attempt: ATTEMPT,
      plannedInsertValues: {},
    });
    const brokenPlan = [{ ...plans[0]!, beforeState: 'existing' as const, beforeSnapshot: undefined }];
    const result = resolveProvenanceRollbackActions({
      plans: brokenPlan,
      currentRows: [existingPriceTextRow],
    });
    expect(result.abortCount).toBe(1);
    expect(result.resolutions[0]?.driftReason).toBe('missing_before_snapshot');
  });

  it('counts restore, delete, and abort actions completely', () => {
    const plans = captureProvenanceFieldRollbackPlans({
      eventId: EVENT_ID,
      fieldPaths: ['priceText', 'ticketPhases', 'ticketStatus'],
      beforeRows: [existingPriceTextRow],
      attempt: ATTEMPT,
      plannedInsertValues: {
        ticketPhases: insertedTicketPhasesValue,
        ticketStatus: 'on_sale',
      },
    });
    const result = resolveProvenanceRollbackActions({
      plans,
      currentRows: [
        {
          ...existingPriceTextRow,
          selectedValue: 'ab 25,90 €',
          selectionReason: ATTEMPT.selectionReason,
          freshnessAt: ATTEMPT.freshnessAt,
        },
        insertedTicketPhasesRow,
        {
          id: `provenance-${EVENT_ID}-ticketStatus`,
          canonicalEventId: EVENT_ID,
          fieldPath: 'ticketStatus',
          selectedValue: 'sold_out',
          selectedSourceId: ATTEMPT.selectedSourceId,
          selectedAt: ATTEMPT.freshnessAt,
          selectionReason: ATTEMPT.selectionReason,
          alternatives: [],
          manuallyOverridden: false,
          updatedAt: ATTEMPT.freshnessAt,
          freshnessAt: ATTEMPT.freshnessAt,
        },
      ],
    });
    expect(result.restoreCount + result.deleteCount + result.abortCount).toBe(3);
    expect(result.restoreCount).toBe(1);
    expect(result.deleteCount).toBe(1);
    expect(result.abortCount).toBe(1);
  });

  it('matches insert fingerprints when JSONB reorders ticket phase keys', () => {
    const reorderedValue = [
      {
        kind: 'other',
        id: 'phase-list-admission-io/ta3dbrv7/',
        isFree: false,
        name: 'List admission',
        soldOut: false,
        sortOrder: 900,
        priceLabel: 'ab 25,90 €',
        priceAmount: 25.9,
        purchaseUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        priceCurrency: 'EUR',
      },
    ];
    const expected = buildExpectedInsertFingerprint({
      eventId: EVENT_ID,
      fieldPath: 'ticketPhases',
      selectedValue: insertedTicketPhasesValue,
      attempt: ATTEMPT,
    });
    const liveRow: ProvenanceRollbackRowSnapshot = {
      ...insertedTicketPhasesRow,
      selectedValue: reorderedValue,
    };
    expect(provenanceRowFingerprint(liveRow)).toBe(expected);
  });
});
