import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import type { ImportRecord } from '@/features/import/models/types';
import {
  RESTRICTED_CANARY_SOURCE_ID,
  buildRowFingerprint,
  buildStableCanaryManifestHash,
  selectDeterministicCanaryEventIds,
} from '@/features/import/generic-truth-pipeline';
import { resolveServerGenericTruthRollout } from '@/features/import/generic-truth-pipeline/server-rollout-config';
import { EventFieldProvenanceWriter, countPublishTrackedFieldsWithValues } from '@/features/import/services/event-field-provenance-writer';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { EventOriginService } from '@/features/events/services/event-origin-service';
import { createBootshausTicketIoProductionSourceRecord } from '@/features/sources/production/ticket-io-source.core';

const CANARY_EVENT_ID = 'evt-1785339418526-dn9f7g0';
const OFFICIAL_WEBSITE = 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iv';
const TICKET_URL = 'https://bootshaus-club.ticket.io/4zjKRnsa/';
const EVIDENCE_VERIFIED_AT = '2026-08-09T19:21:16.347Z';
const APPLY_AUDIT_AT = '2026-08-09T19:22:13.576Z';

const GENERIC_TRUTH_ENV_KEYS = [
  'GENERIC_TRUTH_PIPELINE_ENABLED',
  'GENERIC_TRUTH_PIPELINE_MODE',
  'GENERIC_TRUTH_AUTO_PUBLISH_ENABLED',
  'GENERIC_TRUTH_PIPELINE_SOURCE_IDS',
  'GENERIC_TRUTH_PIPELINE_CANARY_PERCENT',
  'GENERIC_TRUTH_PIPELINE_MAX_EVENTS',
  'GENERIC_TRUTH_PIPELINE_FIELD_GROUPS',
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(GENERIC_TRUTH_ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of GENERIC_TRUTH_ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function activateControlledCanaryEnv(): void {
  process.env.GENERIC_TRUTH_PIPELINE_ENABLED = 'true';
  process.env.GENERIC_TRUTH_PIPELINE_MODE = 'controlled';
  process.env.GENERIC_TRUTH_AUTO_PUBLISH_ENABLED = 'true';
  process.env.GENERIC_TRUTH_PIPELINE_SOURCE_IDS = RESTRICTED_CANARY_SOURCE_ID;
  process.env.GENERIC_TRUTH_PIPELINE_CANARY_PERCENT = '10';
  process.env.GENERIC_TRUTH_PIPELINE_MAX_EVENTS = '3';
  process.env.GENERIC_TRUTH_PIPELINE_FIELD_GROUPS = 'tickets,cta_checkout';
}

function baseExistingEvent(): AdminEventRecord {
  return {
    id: CANARY_EVENT_ID,
    title: 'Bootshaus on a Ship Vol. IV',
    description:
      'Bootshaus returns to the water.On September 13th, Bootshaus on a Ship Vol. IV sets sail on the KD Boot for another open-air daytime session.',
    startDate: '2026-09-13T12:00:00+00:00',
    venueName: 'KD Anleger Nr. 2',
    venueCity: 'Köln',
    venueAddress: 'KD Anleger Nr. 2',
    venueCountryCode: 'DE',
    organizerName: 'Bootshaus',
    ageRestriction: 'ab 18 Jahren',
    priceText: 'Tickets ab 32,00 Euro',
    ticketStatus: 'external_link',
    ticketUrl: TICKET_URL,
    websiteUrl: OFFICIAL_WEBSITE,
    status: 'published',
    sourceId: 'source-bootshaus-koeln',
    createdAt: '2026-07-30T13:22:52.585+00:00',
    updatedAt: '2026-08-02T21:24:48.048+00:00',
  };
}

function canaryCandidate(): CanonicalImportEvent {
  return {
    externalId: TICKET_URL,
    sourceId: RESTRICTED_CANARY_SOURCE_ID,
    sourceName: 'Bootshaus Ticket.io',
    title: 'Bootshaus on a Ship Vol. IV',
    startDate: '2026-09-13T12:00:00+00:00',
    venueName: 'KD Anleger Nr. 2',
    cityName: 'Köln',
    ticketUrl: TICKET_URL,
    priceText: 'ab 32,00 €',
    sourceMetadata: {
      verifiedAt: EVIDENCE_VERIFIED_AT,
      observedAt: EVIDENCE_VERIFIED_AT,
      pageTitle: 'Bootshaus on a Ship Vol. IV',
      listRowTitle: 'Bootshaus on a Ship Vol. IV',
      eventDate: '2026-09-13T14:00:00+02:00',
      venueName: 'KD Anleger Nr. 2',
      priceText: 'ab 32,00 €',
      publicTicketPageUrl: TICKET_URL,
      listCardEvidence: {
        verifiedAt: EVIDENCE_VERIFIED_AT,
        observedAt: EVIDENCE_VERIFIED_AT,
        listRowTitle: 'Bootshaus on a Ship Vol. IV',
        publicTicketPageUrl: TICKET_URL,
      },
      ticketOffers: [
        {
          name: 'List admission',
          priceAmount: 32,
          purchaseUrl: TICKET_URL,
          priceCurrency: 'EUR',
        },
      ],
      availability: 'instock',
    },
    rawSourceType: 'json_ld',
  };
}

function minimalCanaryCandidate(): CanonicalImportEvent {
  const candidate = canaryCandidate();
  const metadata = { ...(candidate.sourceMetadata as Record<string, unknown>) };
  delete metadata.ticketOffers;
  return {
    ...candidate,
    sourceMetadata: metadata,
  };
}

function createRecord(candidate: CanonicalImportEvent): ImportRecord {
  return {
    id: 'import-canary-1',
    importJobId: 'job-canary-1',
    sourceId: RESTRICTED_CANARY_SOURCE_ID,
    sourceName: 'Bootshaus Ticket.io',
    externalId: candidate.externalId,
    status: 'approved',
    duplicateEventId: CANARY_EVENT_ID,
    resultingEventId: CANARY_EVENT_ID,
    normalizedPayload: candidate,
    createdAt: APPLY_AUDIT_AT,
    updatedAt: APPLY_AUDIT_AT,
    retrievedAt: APPLY_AUDIT_AT,
  };
}

function createPublishHarness(existingEvent: AdminEventRecord) {
  const multiSource = new InMemoryMultiSourceRepositories();
  const savedEvents: AdminEventRecord[] = [];
  const adminEventRepository = {
    async getById(id: string) {
      return id === existingEvent.id ? existingEvent : null;
    },
    async save(event: AdminEventRecord) {
      savedEvents.push({ ...event });
      return event;
    },
    async list() {
      return { items: [existingEvent], total: 1, page: 1, pageSize: 10 };
    },
    async delete() {},
  };
  const recordRepository = {
    async update(record: ImportRecord) {
      return record;
    },
  };
  const fieldProvenanceWriter = new EventFieldProvenanceWriter(multiSource.fieldProvenance);
  const eventOriginService = new EventOriginService(multiSource.sourceReferences);
  const publishService = new ImportEventPublishService(
    recordRepository as never,
    adminEventRepository as never,
    multiSource.sourceReferences,
    undefined,
    fieldProvenanceWriter,
    undefined,
    undefined,
    eventOriginService,
  );
  return { publishService, multiSource, savedEvents, adminEventRepository };
}

describe('ImportEventPublishService generic truth controlled apply', () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = snapshotEnv();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(APPLY_AUDIT_AT));
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.useRealTimers();
  });

  it('does not apply generic truth patch when rollout flags are off', async () => {
    delete process.env.GENERIC_TRUTH_PIPELINE_ENABLED;
    const existing = baseExistingEvent();
    const { publishService, savedEvents } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(minimalCanaryCandidate());

    await publishService.publishRecord(record, source, [record]);

    expect(savedEvents.at(-1)?.ticketPhases ?? null).toBeNull();
  });

  it('does not apply generic truth patch in shadow mode', async () => {
    process.env.GENERIC_TRUTH_PIPELINE_ENABLED = 'true';
    process.env.GENERIC_TRUTH_PIPELINE_MODE = 'shadow';
    process.env.GENERIC_TRUTH_AUTO_PUBLISH_ENABLED = 'true';
    process.env.GENERIC_TRUTH_PIPELINE_SOURCE_IDS = RESTRICTED_CANARY_SOURCE_ID;
    const existing = baseExistingEvent();
    const { publishService, savedEvents } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(minimalCanaryCandidate());

    await publishService.publishRecord(record, source, [record]);

    expect(savedEvents.at(-1)?.ticketPhases ?? null).toBeNull();
    expect(resolveServerGenericTruthRollout().writesSuppressed).toBe(true);
  });

  it('does not apply generic truth patch for controlled rollout when event is outside canary', async () => {
    activateControlledCanaryEnv();
    const outsideEventId = 'evt-outside-canary-cohort-999';
    const existing = { ...baseExistingEvent(), id: outsideEventId };
    const { publishService, savedEvents } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = {
      ...createRecord(minimalCanaryCandidate()),
      duplicateEventId: outsideEventId,
      resultingEventId: outsideEventId,
    };

    const selected = selectDeterministicCanaryEventIds(RESTRICTED_CANARY_SOURCE_ID, [outsideEventId]);
    expect(selected).not.toContain(outsideEventId);

    await publishService.publishRecord(record, source, [record]);

    expect(savedEvents.at(-1)?.ticketPhases ?? null).toBeNull();
  });

  it('applies only allowed ticket field groups for controlled eligible canary', async () => {
    activateControlledCanaryEnv();
    const existing = baseExistingEvent();
    const { publishService, savedEvents } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(canaryCandidate());

    const selected = selectDeterministicCanaryEventIds(RESTRICTED_CANARY_SOURCE_ID, [CANARY_EVENT_ID]);
    expect(selected).toContain(CANARY_EVENT_ID);

    await publishService.publishRecord(record, source, [record]);

    const saved = savedEvents.at(-1)!;
    expect(saved.priceText).toBe('ab 32,00 €');
    expect(saved.ticketStatus).toBe('on_sale');
    expect(saved.ticketPhases?.length).toBe(1);
    expect(saved.websiteUrl).toBe(OFFICIAL_WEBSITE);
    expect(saved.ticketUrl).toBe(TICKET_URL);
    expect(saved.description).toBe(existing.description);
  });

  it('stores provenance freshness from evidence verifiedAt, not apply audit time', async () => {
    activateControlledCanaryEnv();
    const existing = baseExistingEvent();
    const { publishService, multiSource } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(canaryCandidate());

    await publishService.publishRecord(record, source, [record]);

    const priceText = await multiSource.fieldProvenance.findByFieldPath(CANARY_EVENT_ID, 'priceText');
    expect(priceText?.freshnessAt).toBe(EVIDENCE_VERIFIED_AT);
    expect(priceText?.lastChangedAt).toBe(APPLY_AUDIT_AT);
  });

  it('blocks publish when manual lock is present on tracked field', async () => {
    activateControlledCanaryEnv();
    const existing = baseExistingEvent();
    const { publishService, multiSource, savedEvents } = createPublishHarness(existing);
    await multiSource.fieldProvenance.upsertFieldSelection({
      id: `provenance-${CANARY_EVENT_ID}-priceText`,
      canonicalEventId: CANARY_EVENT_ID,
      fieldPath: 'priceText',
      value: 'Tickets ab 32,00 Euro',
      selectedSourceId: 'manual_override',
      selectionReason: 'manual_override',
      alternatives: [],
      lastChangedAt: APPLY_AUDIT_AT,
    });
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(minimalCanaryCandidate());

    await publishService.publishRecord(record, source, [record]);

    expect(savedEvents.at(-1)?.ticketPhases ?? null).toBeNull();
    const provenance = await multiSource.fieldProvenance.findByFieldPath(CANARY_EVENT_ID, 'priceText');
    expect(provenance?.selectedSourceId).toBe('manual_override');
  });

  it('does not persist event when save fails', async () => {
    activateControlledCanaryEnv();
    const existing = baseExistingEvent();
    const multiSource = new InMemoryMultiSourceRepositories();
    let saveCalls = 0;
    const adminEventRepository = {
      async getById(id: string) {
        return id === existing.id ? existing : null;
      },
      async save(event: AdminEventRecord) {
        saveCalls += 1;
        if (saveCalls === 1) {
          throw new Error('simulated_write_failure');
        }
        return event;
      },
      async list() {
        return { items: [existing], total: 1, page: 1, pageSize: 10 };
      },
      async delete() {},
    };
    const publishService = new ImportEventPublishService(
      { update: async (record: ImportRecord) => record } as never,
      adminEventRepository as never,
      multiSource.sourceReferences,
      undefined,
      new EventFieldProvenanceWriter(multiSource.fieldProvenance),
      undefined,
      undefined,
      new EventOriginService(multiSource.sourceReferences),
    );
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(minimalCanaryCandidate());

    await expect(publishService.publishRecord(record, source, [record])).rejects.toThrow(
      'simulated_write_failure',
    );
    const provenance = await multiSource.fieldProvenance.findByFieldPath(CANARY_EVENT_ID, 'priceText');
    expect(provenance).toBeNull();
  });

  it('restores generic truth env after controlled activation', async () => {
    activateControlledCanaryEnv();
    expect(resolveServerGenericTruthRollout().enabled).toBe(true);
    restoreEnv(envSnapshot);
    expect(resolveServerGenericTruthRollout().enabled).toBe(false);
  });
});

describe('restricted canary preflight hard stops', () => {
  it('detects manifest hash mismatch', () => {
    const hash = buildStableCanaryManifestHash({
      sourceId: RESTRICTED_CANARY_SOURCE_ID,
      canaryPercent: 10,
      maxEvents: 3,
      allowedFieldGroups: ['tickets', 'cta_checkout'],
      candidates: [
        {
          eventId: CANARY_EVENT_ID,
          beforeFingerprint: 'fp-a',
          expectedPatches: { priceText: 'ab 32,00 €' },
          rollbackPayload: { priceText: 'Tickets ab 32,00 Euro' },
        },
      ],
    });
    expect(hash).not.toBe('163a5b061d2d9ed79ce7812ef176ae76e4bc694d6c9da5bdbe75b0beb07ff35c');
  });

  it('detects row fingerprint mismatch after mutation', () => {
    const before = baseExistingEvent();
    const fingerprintBefore = buildRowFingerprint(before);
    const mutated = { ...before, priceText: 'ab 32,00 €', ticketStatus: 'on_sale' };
    expect(buildRowFingerprint(mutated)).not.toBe(fingerprintBefore);
  });

  it('expects fourteen provenance upserts for canary-shaped published event', () => {
    const afterCanary = {
      ...baseExistingEvent(),
      priceText: 'ab 32,00 €',
      ticketStatus: 'on_sale',
      ticketPhases: [
        {
          id: 'phase-list-admission-io/4zjkrnsa/',
          name: 'List admission',
          sortOrder: 900,
          kind: 'other' as const,
          priceAmount: 32,
          priceCurrency: 'EUR',
          priceLabel: 'ab 32,00 €',
          soldOut: false,
          isFree: false,
          purchaseUrl: TICKET_URL,
        },
      ],
    };
    expect(countPublishTrackedFieldsWithValues(afterCanary)).toBe(14);
  });
});
