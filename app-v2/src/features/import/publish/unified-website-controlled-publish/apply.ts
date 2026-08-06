import { createHash } from 'node:crypto';

import type { AdminEventRecord } from '@/data/types/records';
import type { BillingRelation, CanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';

import {
  PHASE486_FORBIDDEN_PUBLISH_FIELDS,
} from './config';
import type { PublishFieldProposal } from './downgrade-prevention';
import { publishFieldToEventColumn } from './downgrade-prevention';

export type PublishMutation = {
  eventId: string;
  field: PublishFieldProposal['field'];
  eventColumn?: string;
  previousValue: unknown;
  newValue: unknown;
  evidenceUrl: string;
  writeReason: string;
};

export function buildForbiddenFingerprint(
  event: AdminEventRecord,
  extras?: { lineup?: unknown; origins?: unknown },
) {
  const fingerprint: Record<string, unknown> = {};
  for (const field of PHASE486_FORBIDDEN_PUBLISH_FIELDS) {
    const key = field as keyof AdminEventRecord;
    fingerprint[field] = event[key] ?? null;
  }
  fingerprint.sourceId = event.sourceId ?? null;
  fingerprint.ownership = event.createdBy ?? null;
  fingerprint.lineup = extras?.lineup ?? null;
  fingerprint.origins = extras?.origins ?? null;
  return fingerprint;
}

export function hashFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

export function buildEventPublishBackup(
  event: AdminEventRecord,
  provenance: Record<string, unknown>,
  lineup?: unknown,
) {
  const projection = projectCanonicalEventFields({
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
  return {
    eventId: event.id,
    title: event.title,
    description: event.description ?? '',
    image_url: event.imageUrl ?? '',
    ticket_url: event.ticketUrl ?? '',
    website_url: event.websiteUrl ?? '',
    genre_labels: event.genreLabels ?? [],
    venue_name: event.venueName ?? '',
    price_text: event.priceText ?? '',
    source_id: event.sourceId ?? '',
    provenance,
    lineup,
    updated_at: event.updatedAt,
    apiProjection: projection,
    galleryImageUrls: buildConsumerGalleryImageUrls({
      flyerUrl: event.flyerUrl,
      imageUrl: event.imageUrl,
    }),
  };
}

export function planPublishMutations(proposals: PublishFieldProposal[]): {
  mutations: PublishMutation[];
  skipped: PublishFieldProposal[];
  rejected: PublishFieldProposal[];
} {
  const mutations: PublishMutation[] = [];
  const skipped: PublishFieldProposal[] = [];
  const rejected: PublishFieldProposal[] = [];

  for (const proposal of proposals) {
    if (proposal.decision === 'approved_write') {
      if (proposal.field === 'lineup') {
        mutations.push({
          eventId: proposal.eventId,
          field: 'lineup',
          previousValue: proposal.currentValue,
          newValue: proposal.proposedValue,
          evidenceUrl: proposal.evidenceUrl,
          writeReason: proposal.writeReason,
        });
        continue;
      }
      if (proposal.field === 'lineupState' || proposal.field === 'gallery') {
        skipped.push(proposal);
        continue;
      }
      mutations.push({
        eventId: proposal.eventId,
        field: proposal.field,
        eventColumn: publishFieldToEventColumn(proposal.field),
        previousValue: proposal.currentValue,
        newValue: proposal.proposedValue,
        evidenceUrl: proposal.evidenceUrl,
        writeReason: proposal.writeReason,
      });
      continue;
    }
    if (
      proposal.decision === 'skipped_unchanged' ||
      proposal.decision === 'skipped_formatting_only'
    ) {
      skipped.push(proposal);
    } else {
      rejected.push(proposal);
    }
  }

  return { mutations, skipped, rejected };
}

export function mapLineupEvidenceToCanonical(entries: LineupEvidenceEntry[]): CanonicalLineupEntry[] {
  return entries.map((entry) => {
    let billingRelation: BillingRelation = 'SOLO';
    if (entry.isB2b) billingRelation = 'B2B';
    else if (entry.isF2f) billingRelation = 'F2F';
    else if (entry.isLiveSet) billingRelation = 'LIVE';
    else if (entry.billingRelation === 'HEADLINER') {
      billingRelation = 'SOLO';
    } else if (entry.billingRelation === 'SPECIAL_GUEST') {
      billingRelation = 'SPECIAL_GUEST';
    }
    return {
      order: entry.sortOrder,
      artists: [entry.displayName],
      billingRelation,
      stage: entry.stage ?? entry.floor,
      confidence: entry.confidence,
      provenance: {
        source: 'structured',
        extractedAt: new Date().toISOString(),
      },
    };
  });
}

export function verifyEventIdentity(event: AdminEventRecord, eventId: string): {
  ok: boolean;
  reason?: string;
} {
  if (event.id !== eventId) {
    return { ok: false, reason: 'Event ID mismatch' };
  }
  return { ok: true };
}

export type ConsumerVerificationChecks = Record<string, boolean>;

export function verifyR3habConsumerAcceptance(projection: ReturnType<typeof projectCanonicalEventFields>): ConsumerVerificationChecks {
  const desc = projection.sanitizedDescription ?? '';
  return {
    septemberContent: desc.includes('September 4th'),
    noAugust7: !desc.includes('August 7th'),
    noFooterBoilerplate: !desc.includes('Mobile App') && !desc.includes('Merchandise'),
    noBitly: !String(projection.ticketUrl ?? '').includes('bit.ly'),
    ticketIoCta: String(projection.ticketUrl ?? '').includes('bootshaus-club.ticket.io/C7JPnatZ'),
    lineupCount: (projection.knownArtistNames ?? []).length >= 5,
    noPriceFabrication: !projection.displayPriceText?.includes('website'),
  };
}

export function verifySommerfestConsumerAcceptance(
  event: AdminEventRecord,
  projection: ReturnType<typeof projectCanonicalEventFields>,
): ConsumerVerificationChecks {
  return {
    descriptionStable: Boolean(projection.sanitizedDescription?.includes('Lineup TBA')),
    venueEssigfabrik: (event.venueName ?? '').toLowerCase().includes('essigfabrik'),
    noBootshausVenueOverwrite: !(event.venueName ?? '').toLowerCase().includes('bootshaus'),
    ticketIoCta: String(projection.ticketUrl ?? '').includes('bootshaus-club.ticket.io/vB0cAmWg'),
    priceUntouched: Boolean(event.priceText?.includes('11,90') || projection.displayPriceText?.includes('11,90')),
    noFakeTbaArtist: !(projection.knownArtistNames ?? []).includes('TBA'),
  };
}
