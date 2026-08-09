import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import type { ImportRecord } from '@/features/import/models/types';
import {
  RESTRICTED_CANARY_SOURCE_ID,
  selectDeterministicCanaryEventIds,
} from '@/features/import/generic-truth-pipeline';
import { EventOriginService } from '@/features/events/services/event-origin-service';
import {
  computeChangedPublishTrackedFields,
  EventFieldProvenanceWriter,
} from '@/features/import/services/event-field-provenance-writer';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
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
    description: 'Stable description unchanged by canary.',
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

function canaryCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
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
    eventUrl: OFFICIAL_WEBSITE,
    sourceMetadata: {
      verifiedAt: EVIDENCE_VERIFIED_AT,
      observedAt: EVIDENCE_VERIFIED_AT,
      pageTitle: 'Bootshaus on a Ship Vol. IV',
      listRowTitle: 'Bootshaus on a Ship Vol. IV',
      eventDate: '2026-09-13T14:00:00+02:00',
      venueName: 'KD Anleger Nr. 2',
      priceText: 'ab 32,00 €',
      publicTicketPageUrl: TICKET_URL,
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
    ...overrides,
  };
}

function createRecord(candidate: CanonicalImportEvent): ImportRecord {
  return {
    id: 'import-scope-1',
    importJobId: 'job-scope-1',
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
  return { publishService, multiSource, savedEvents };
}

describe('ImportEventPublishService provenance scope', () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = snapshotEnv();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(APPLY_AUDIT_AT));
    activateControlledCanaryEnv();
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.useRealTimers();
  });

  it('writes provenance only for applied ticket patch fields', async () => {
    const existing = baseExistingEvent();
    const { publishService, multiSource } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(canaryCandidate());

    expect(selectDeterministicCanaryEventIds(RESTRICTED_CANARY_SOURCE_ID, [CANARY_EVENT_ID])).toContain(
      CANARY_EVENT_ID,
    );

    await publishService.publishRecord(record, source, [record]);

    const provenanceRows = await multiSource.fieldProvenance.findByCanonicalEventId(CANARY_EVENT_ID);
    const fieldPaths = provenanceRows.map((row) => row.fieldPath).sort();
    expect(fieldPaths).toEqual(['priceText', 'ticketStatus']);
    expect(computeChangedPublishTrackedFields(existing, {
      ...existing,
      priceText: 'ab 32,00 €',
      ticketStatus: 'on_sale',
      ticketPhases: record.normalizedPayload?.ticketPhases,
    } as AdminEventRecord)).toEqual(['priceText', 'ticketStatus']);
  });

  it('does not upsert provenance for unchanged tracked fields', async () => {
    const existing = baseExistingEvent();
    const { publishService, multiSource } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const candidate = canaryCandidate({
      priceText: existing.priceText,
      sourceMetadata: {
        verifiedAt: EVIDENCE_VERIFIED_AT,
        availability: 'instock',
        priceText: existing.priceText,
      },
    });
    const record = createRecord(candidate);

    await publishService.publishRecord(record, source, [record]);

    const provenanceRows = await multiSource.fieldProvenance.findByCanonicalEventId(CANARY_EVENT_ID);
    expect(provenanceRows).toHaveLength(0);
  });

  it('blocks websiteUrl event patch and provenance for ticket source', async () => {
    const existing = baseExistingEvent();
    const { publishService, multiSource, savedEvents } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const candidate = canaryCandidate({
      eventUrl: 'https://evil.example.test/overwrite',
      sourceMetadata: {
        ...canaryCandidate().sourceMetadata,
        publicTicketPageUrl: TICKET_URL,
      },
    });
    const record = createRecord(candidate);

    await publishService.publishRecord(record, source, [record]);

    expect(savedEvents.at(-1)?.websiteUrl).toBe(OFFICIAL_WEBSITE);
    const websiteProvenance = await multiSource.fieldProvenance.findByFieldPath(
      CANARY_EVENT_ID,
      'websiteUrl',
    );
    expect(websiteProvenance).toBeNull();
  });

  it('does not write description or venue provenance under tickets,cta_checkout only', async () => {
    const existing = baseExistingEvent();
    const { publishService, multiSource } = createPublishHarness(existing);
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(
      canaryCandidate({
        description: 'Would-be new description from ticket source',
      }),
    );

    await publishService.publishRecord(record, source, [record]);

    const provenanceRows = await multiSource.fieldProvenance.findByCanonicalEventId(CANARY_EVENT_ID);
    const fieldPaths = provenanceRows.map((row) => row.fieldPath);
    expect(fieldPaths).not.toContain('description');
    expect(fieldPaths).not.toContain('venueName');
    expect(fieldPaths).not.toContain('genres');
    expect(fieldPaths).not.toContain('title');
  });

  it('skips event and provenance writes when manual lock is present', async () => {
    const existing = baseExistingEvent();
    const { publishService, multiSource, savedEvents } = createPublishHarness(existing);
    await multiSource.fieldProvenance.upsertFieldSelection({
      id: `provenance-${CANARY_EVENT_ID}-priceText`,
      canonicalEventId: CANARY_EVENT_ID,
      fieldPath: 'priceText',
      value: existing.priceText,
      selectedSourceId: 'manual_override',
      selectionReason: 'manual_override',
      alternatives: [],
      lastChangedAt: APPLY_AUDIT_AT,
    });
    const source = createBootshausTicketIoProductionSourceRecord();
    const record = createRecord(canaryCandidate({
      sourceMetadata: {
        verifiedAt: EVIDENCE_VERIFIED_AT,
        observedAt: EVIDENCE_VERIFIED_AT,
        availability: 'instock',
        priceText: 'ab 32,00 €',
        publicTicketPageUrl: TICKET_URL,
      },
    }));

    await publishService.publishRecord(record, source, [record]);

    expect(savedEvents.at(-1)?.ticketPhases ?? null).toBeNull();
    const priceText = await multiSource.fieldProvenance.findByFieldPath(CANARY_EVENT_ID, 'priceText');
    expect(priceText?.selectedSourceId).toBe('manual_override');
  });

  it('does not write provenance when event save fails', async () => {
    const existing = baseExistingEvent();
    const multiSource = new InMemoryMultiSourceRepositories();
    const adminEventRepository = {
      async getById(id: string) {
        return id === existing.id ? existing : null;
      },
      async save() {
        throw new Error('simulated_partial_write_failure');
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
    const record = createRecord(canaryCandidate());

    await expect(publishService.publishRecord(record, source, [record])).rejects.toThrow(
      'simulated_partial_write_failure',
    );
    expect(await multiSource.fieldProvenance.findByCanonicalEventId(CANARY_EVENT_ID)).toHaveLength(0);
  });

  it('restores rollback snapshots for touched provenance rows', async () => {
    const existing = baseExistingEvent();
    const multiSource = new InMemoryMultiSourceRepositories();
    const writer = new EventFieldProvenanceWriter(multiSource.fieldProvenance);
    const beforePrice = {
      id: `provenance-${CANARY_EVENT_ID}-priceText`,
      canonicalEventId: CANARY_EVENT_ID,
      fieldPath: 'priceText',
      value: existing.priceText,
      selectedSourceId: 'source-bootshaus-ticket-io',
      selectionReason: 'import_publish',
      alternatives: [
        {
          sourceId: 'source-bootshaus-koeln',
          value: existing.priceText,
          freshnessAt: '2026-08-02T21:20:06.937Z',
        },
      ],
      lastChangedAt: '2026-08-02T21:24:48.048+00:00',
      freshnessAt: '2026-08-02T21:24:48.048+00:00',
    };
    await multiSource.fieldProvenance.upsertFieldSelection(beforePrice);

    await writer.writeFromPublish(CANARY_EVENT_ID, createBootshausTicketIoProductionSourceRecord(), {
      ...existing,
      priceText: 'ab 32,00 €',
      ticketStatus: 'on_sale',
    }, {
      publishedAt: APPLY_AUDIT_AT,
      evidenceVerifiedAt: EVIDENCE_VERIFIED_AT,
      appliedFieldPaths: ['priceText', 'ticketStatus'],
    });

    const contaminated = await multiSource.fieldProvenance.findByFieldPath(CANARY_EVENT_ID, 'priceText');
    expect(contaminated?.freshnessAt).toBe(EVIDENCE_VERIFIED_AT);

    await multiSource.fieldProvenance.upsertFieldSelection({
      ...beforePrice,
      value: beforePrice.value,
      selectedSourceId: beforePrice.selectedSourceId,
      alternatives: beforePrice.alternatives,
      lastChangedAt: beforePrice.lastChangedAt,
      freshnessAt: beforePrice.freshnessAt,
    });

    const restored = await multiSource.fieldProvenance.findByFieldPath(CANARY_EVENT_ID, 'priceText');
    expect(restored?.selectedSourceId).toBe('source-bootshaus-ticket-io');
    expect(restored?.value).toBe(existing.priceText);
    expect(restored?.freshnessAt).toBe('2026-08-02T21:24:48.048+00:00');
    expect(restored?.alternatives).toEqual(beforePrice.alternatives);
  });
});
