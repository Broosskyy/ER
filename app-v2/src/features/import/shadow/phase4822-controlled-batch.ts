import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import {
  extractOfficialWebsitePublicTruth,
  normalizeCompareValue,
  valuesSemanticallyEqual,
} from '@/features/import/shadow/official-website-public-truth';
import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';

export const PHASE4822_APPROVED_PREVIEW_PATH = 'docs/real-data/_phase4821_batch_preview.json';

export const SOMMERFEST_EVENT_ID = 'evt-1785339391167-tfaixrr';
export const R3HAB_EVENT_ID = 'evt-1785339421539-k3swcrl';
export const ELEKTROKUECHE_EVENT_ID = 'evt-1785389055557-ux20897';

export const BOOTSHAUS_SOURCE_ID = 'source-bootshaus-koeln';
export const IMPORTER_VERSION = 'phase4814-official-website';
export const CORRECTION_REASON = 'phase4822_approved_official_website_correction';

export const OFFICIAL_EVENT_URLS: Record<string, string> = {
  [SOMMERFEST_EVENT_ID]: 'https://bootshaus.tv/events/bootshaus-sommerfest',
  [R3HAB_EVENT_ID]: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
};

export const CONFUSABLE_SOMMERFEST_IDS = [
  ELEKTROKUECHE_EVENT_ID,
  'evt-1785339394218-cbqw3kx',
] as const;

export type ApprovedBatchProposal = {
  eventId: string;
  eventTitle: string;
  field: 'flyer' | 'description';
  currentProductionValue: string;
  proposedValue: string;
  publicSourceEvidence: string;
  sourceRole: string;
  confidence: number;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type ApprovedBatchPreview = {
  totalProposedChanges: number;
  affectedEvents: number;
  affectedEventIds: string[];
  proposals: ApprovedBatchProposal[];
};

export type PreflightProposalReport = {
  eventId: string;
  eventTitle: string;
  eventDate?: string;
  venue?: string;
  officialPublicEventUrl: string;
  currentPublicEvidence: string;
  evidenceCaptureTimestamp: string;
  currentCanonicalProductionValue: string;
  proposedValue: string;
  currentApiProjectionValue: string;
  expectedConsumerVisibleResult: string;
  confidence: number;
  risk: string;
  field: 'flyer' | 'description';
  identityChecks: {
    exactEventId: boolean;
    officialUrlMatches: boolean;
    notConfusableEvent: boolean;
    evidenceSupportsProposal: boolean;
    productionUnchangedSinceReview: boolean;
  };
  aborted: boolean;
  abortReason?: string;
};

export type RepairMutation = {
  eventId: string;
  field: 'flyer' | 'description';
  canonicalField: 'imageUrl' | 'description';
  previousValue: string;
  newValue: string;
  publicEvidenceUrl: string;
};

export function loadApprovedBatchPreview(rootDir: string): ApprovedBatchPreview {
  const raw = JSON.parse(
    readFileSync(`${rootDir}/${PHASE4822_APPROVED_PREVIEW_PATH}`, 'utf8'),
  ) as ApprovedBatchPreview;
  return raw;
}

export function verifyApprovedCandidateSet(preview: ApprovedBatchPreview): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (preview.totalProposedChanges !== 3) {
    issues.push(`Expected 3 proposals, got ${preview.totalProposedChanges}`);
  }
  if (preview.affectedEvents !== 2) {
    issues.push(`Expected 2 affected events, got ${preview.affectedEvents}`);
  }
  const expectedIds = [SOMMERFEST_EVENT_ID, R3HAB_EVENT_ID].sort();
  const actualIds = [...preview.affectedEventIds].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    issues.push(`Unexpected affected event IDs: ${actualIds.join(', ')}`);
  }
  const fields = preview.proposals.map((p) => `${p.eventId}:${p.field}`).sort();
  const expectedFields = [
    `${R3HAB_EVENT_ID}:flyer`,
    `${SOMMERFEST_EVENT_ID}:description`,
    `${SOMMERFEST_EVENT_ID}:flyer`,
  ].sort();
  if (JSON.stringify(fields) !== JSON.stringify(expectedFields)) {
    issues.push(`Unexpected proposal field set: ${fields.join(', ')}`);
  }
  for (const proposal of preview.proposals) {
    if (![SOMMERFEST_EVENT_ID, R3HAB_EVENT_ID].includes(proposal.eventId)) {
      issues.push(`Unexpected event ID in proposal: ${proposal.eventId}`);
    }
    if (!['flyer', 'description'].includes(proposal.field)) {
      issues.push(`Unexpected field in proposal: ${proposal.field}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export function proposalFieldToCanonical(field: 'flyer' | 'description'): 'imageUrl' | 'description' {
  return field === 'flyer' ? 'imageUrl' : 'description';
}

export function canonicalFieldToEventColumn(field: 'imageUrl' | 'description'): 'image_url' | 'description' {
  return field === 'imageUrl' ? 'image_url' : 'description';
}

export function readCanonicalFieldValue(event: AdminEventRecord, field: 'flyer' | 'description'): string {
  if (field === 'flyer') {
    return event.imageUrl ?? '';
  }
  return event.description ?? '';
}

export function productionValueUnchangedSinceReview(
  current: string,
  snapshot: string,
  field: 'flyer' | 'description',
): boolean {
  if (field === 'flyer') {
    return current.trim() === snapshot.trim();
  }
  const normalizedCurrent = normalizeCompareValue(current);
  const normalizedSnapshot = normalizeCompareValue(snapshot);
  if (normalizedCurrent === normalizedSnapshot) {
    return true;
  }
  return normalizedCurrent.startsWith(normalizedSnapshot.slice(0, 80));
}

export function evidenceSupportsProposal(
  field: 'flyer' | 'description',
  publicTruth: { description?: string; flyer?: string },
  proposedValue: string,
  publicSourceEvidence: string,
): boolean {
  if (field === 'flyer') {
    const liveFlyer = publicTruth.flyer ?? '';
    return (
      liveFlyer.trim() === proposedValue.trim() ||
      valuesSemanticallyEqual(liveFlyer, proposedValue) ||
      publicSourceEvidence.trim() === proposedValue.trim()
    );
  }
  const liveDescription = publicTruth.description ?? '';
  return (
    valuesSemanticallyEqual(liveDescription, proposedValue) ||
    valuesSemanticallyEqual(liveDescription, publicSourceEvidence) ||
    valuesSemanticallyEqual(proposedValue, publicSourceEvidence)
  );
}

export function projectConsumerEvent(event: AdminEventRecord) {
  return projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: [],
    priceText: event.priceText,
    source: event.sourceId ?? '',
    ticketUrl: event.ticketUrl,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    imageUrl: event.imageUrl,
    genres: event.genreLabels,
  });
}

export function buildForbiddenFingerprint(event: AdminEventRecord, extras?: {
  lineup?: unknown;
  artists?: unknown;
  genres?: unknown;
  origins?: unknown;
}) {
  return {
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    venueId: event.venueId ?? '',
    venueName: event.venueName ?? '',
    venueCity: event.venueCity ?? '',
    venueAddress: event.venueAddress ?? '',
    latitude: event.latitude,
    longitude: event.longitude,
    organizerName: event.organizerName ?? '',
    ticketUrl: event.ticketUrl ?? '',
    priceText: event.priceText ?? '',
    ticketStatus: event.ticketStatus ?? '',
    phases: event.ticketPhases ?? null,
    availability: event.ticketStatus ?? null,
    lineup: extras?.lineup ?? null,
    artists: extras?.artists ?? null,
    genres: event.genreLabels ?? extras?.genres ?? null,
    sourceId: event.sourceId ?? '',
    websiteUrl: event.websiteUrl ?? '',
    origins: extras?.origins ?? null,
    ownership: event.createdBy ?? null,
  };
}

export function hashFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

export function buildEventBackup(event: AdminEventRecord, provenance: Record<string, unknown>) {
  const projection = projectConsumerEvent(event);
  return {
    eventId: event.id,
    title: event.title,
    description: event.description ?? '',
    image_url: event.imageUrl ?? '',
    flyer_url: event.flyerUrl ?? '',
    galleryImageUrls: buildConsumerGalleryImageUrls({
      flyerUrl: event.flyerUrl,
      imageUrl: event.imageUrl,
    }),
    descriptionProvenance: provenance.description ?? null,
    imageProvenance: provenance.imageUrl ?? null,
    updated_at: event.updatedAt,
    apiProjection: projection,
  };
}

export function buildPreflightReport(input: {
  proposal: ApprovedBatchProposal;
  event: AdminEventRecord;
  publicTruth: ReturnType<typeof extractOfficialWebsitePublicTruth>;
  officialUrl: string;
  evidenceCapturedAt: string;
  confusableEvents: AdminEventRecord[];
}): PreflightProposalReport {
  const currentCanonical = readCanonicalFieldValue(input.event, input.proposal.field);
  const projection = projectConsumerEvent(input.event);
  const currentApiValue =
    input.proposal.field === 'flyer'
      ? (projection.heroImageUrl ?? '')
      : (projection.sanitizedDescription ?? '');

  const exactEventId = input.event.id === input.proposal.eventId;
  const officialUrlMatches =
    (input.event.websiteUrl ?? '').includes(
      input.officialUrl.replace('https://bootshaus.tv/events/', ''),
    ) || input.event.websiteUrl === input.officialUrl;
  const notConfusableEvent =
    input.proposal.eventId === SOMMERFEST_EVENT_ID
      ? !input.event.title.toLowerCase().includes('elektroküche') &&
        !input.event.title.toLowerCase().includes('affenkäfig') &&
        input.event.title.toLowerCase().includes('bootshaus sommerfest') &&
        !input.confusableEvents.some((e) => e.id === input.event.id)
      : input.event.title.toUpperCase().includes('R3HAB') &&
        input.officialUrl.includes('r3hab-pres-by-bootshaus');

  const productionUnchanged = productionValueUnchangedSinceReview(
    currentCanonical,
    input.proposal.currentProductionValue,
    input.proposal.field,
  );
  const evidenceOk = evidenceSupportsProposal(
    input.proposal.field,
    input.publicTruth,
    input.proposal.proposedValue,
    input.proposal.publicSourceEvidence,
  );

  const currentPublicEvidence =
    input.proposal.field === 'flyer'
      ? (input.publicTruth.flyer ?? '')
      : (input.publicTruth.description ?? '');

  let aborted = false;
  let abortReason: string | undefined;
  if (!exactEventId) {
    aborted = true;
    abortReason = 'Event ID mismatch';
  } else if (!officialUrlMatches) {
    aborted = true;
    abortReason = 'Official public URL does not match canonical event';
  } else if (!notConfusableEvent) {
    aborted = true;
    abortReason = 'Identity check failed — possible confusable event';
  } else if (!productionUnchanged) {
    aborted = true;
    abortReason = 'Production value changed after Phase 4.8.2.1 review';
  } else if (!evidenceOk) {
    aborted = true;
    abortReason = 'Live public evidence no longer supports proposed value';
  }

  if (input.proposal.field === 'flyer' && input.proposal.eventId === R3HAB_EVENT_ID) {
    const flyer = input.publicTruth.flyer ?? '';
    if (flyer.includes('bootshaus-logo') || flyer.includes('/venue/')) {
      aborted = true;
      abortReason = 'R3HAB flyer appears to be a generic venue asset';
    }
  }

  return {
    eventId: input.proposal.eventId,
    eventTitle: input.event.title,
    eventDate: input.event.startDate,
    venue: input.event.venueName,
    officialPublicEventUrl: input.officialUrl,
    currentPublicEvidence: currentPublicEvidence,
    evidenceCaptureTimestamp: input.evidenceCapturedAt,
    currentCanonicalProductionValue: currentCanonical,
    proposedValue: input.proposal.proposedValue,
    currentApiProjectionValue: currentApiValue,
    expectedConsumerVisibleResult: input.proposal.proposedValue,
    confidence: input.proposal.confidence,
    risk: input.proposal.risk,
    field: input.proposal.field,
    identityChecks: {
      exactEventId,
      officialUrlMatches,
      notConfusableEvent,
      evidenceSupportsProposal: evidenceOk,
      productionUnchangedSinceReview: productionUnchanged,
    },
    aborted,
    abortReason,
  };
}

export function planRepairMutations(
  proposals: ApprovedBatchProposal[],
  events: Map<string, AdminEventRecord>,
): { mutations: RepairMutation[]; skipped: RepairMutation[] } {
  const mutations: RepairMutation[] = [];
  const skipped: RepairMutation[] = [];
  for (const proposal of proposals) {
    const event = events.get(proposal.eventId);
    if (!event) {
      throw new Error(`Missing event for repair: ${proposal.eventId}`);
    }
    const current = readCanonicalFieldValue(event, proposal.field);
    const mutation: RepairMutation = {
      eventId: proposal.eventId,
      field: proposal.field,
      canonicalField: proposalFieldToCanonical(proposal.field),
      previousValue: current,
      newValue: proposal.proposedValue,
      publicEvidenceUrl: OFFICIAL_EVENT_URLS[proposal.eventId] ?? '',
    };
    if (valuesSemanticallyEqual(current, proposal.proposedValue)) {
      skipped.push(mutation);
      continue;
    }
    if (!productionValueUnchangedSinceReview(current, proposal.currentProductionValue, proposal.field)) {
      throw new Error(
        `Production value for ${proposal.eventId}/${proposal.field} changed since review`,
      );
    }
    mutations.push(mutation);
  }
  return { mutations, skipped };
}

export async function applyRepairMutations(input: {
  mutations: RepairMutation[];
  events: Map<string, AdminEventRecord>;
  source: SourceRecord;
  provenanceWriter: EventFieldProvenanceWriter;
  updateEvent: (eventId: string, patch: { image_url?: string; description?: string }) => Promise<void>;
  observedAt?: string;
}): Promise<RepairMutation[]> {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const applied: RepairMutation[] = [];
  for (const mutation of input.mutations) {
    const event = input.events.get(mutation.eventId);
    if (!event) {
      throw new Error(`Missing event: ${mutation.eventId}`);
    }
    const patch: { image_url?: string; description?: string } = {};
    if (mutation.canonicalField === 'imageUrl') {
      patch.image_url = mutation.newValue;
    } else {
      patch.description = mutation.newValue;
    }
    await input.updateEvent(mutation.eventId, patch);
    await input.provenanceWriter.writePhase4822ApprovedCorrection({
      canonicalEventId: mutation.eventId,
      fieldPath: mutation.canonicalField,
      value: mutation.newValue,
      source: input.source,
      publicEvidenceUrl: mutation.publicEvidenceUrl,
      capturedEvidenceValue: mutation.newValue,
      previousValue: mutation.previousValue,
      previousSourceId: event.sourceId,
      importerVersion: IMPORTER_VERSION,
      observedAt,
    });
    applied.push(mutation);
  }
  return applied;
}

export function verifyConsumerProjection(event: AdminEventRecord, proposals: ApprovedBatchProposal[]) {
  const projection = projectConsumerEvent(event);
  const gallery = buildConsumerGalleryImageUrls({
    flyerUrl: event.flyerUrl,
    imageUrl: event.imageUrl,
  });
  const eventProposals = proposals.filter((p) => p.eventId === event.id);
  const checks: Record<string, boolean> = {};
  for (const proposal of eventProposals) {
    if (proposal.field === 'description') {
      checks.descriptionMatchesOfficial = valuesSemanticallyEqual(
        projection.sanitizedDescription,
        proposal.proposedValue,
      );
      checks.noUnderlandText = !String(projection.sanitizedDescription ?? '')
        .toUpperCase()
        .includes('UNDERLAND');
    }
    if (proposal.field === 'flyer') {
      checks.flyerMatchesOfficial = projection.heroImageUrl === proposal.proposedValue;
      checks.galleryIncludesFlyer = gallery.includes(proposal.proposedValue);
    }
  }
  return {
    eventId: event.id,
    title: event.title,
    projection,
    galleryImageUrls: gallery,
    checks,
  };
}
