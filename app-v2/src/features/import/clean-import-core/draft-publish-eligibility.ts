import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import {
  analyzeEventTitleCore,
  compareEventTitleCores,
} from '@/features/import/matching/event-title-core';
import type { KnownEventForDuplicateCheck } from '@/features/import/matching/match-result';
import {
  normalizeMatchText,
  parseEventCalendarDay,
  sameCalendarDay,
} from '@/features/import/matching/matching-utils';
import { evaluateEventOwnershipMatch } from '@/features/import/matching/event-ownership-decision';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import { venueCompatible } from '@/features/import/ticket-platform-identity/identity-match';

import { normalizePublicUrl } from './cross-source-event-resolver';
import { isEventIdentityUrl } from './duplicate-url-reconciliation';
import type { CanonicalEvent } from './event-evidence';
import type { GenreContractResult } from './genre-contract';
import {
  IdentityResolver,
  hasStablePublicIdentity,
  type CleanIdentityVerdict,
} from './identity-resolver';
import type { ImportDraft, ReviewTrack } from './import-draft';
import type { PersistedDraftDecision } from './import-draft-record-mapper';

export type SuggestedReviewTrack =
  | 'auto_ready'
  | 'quick_review'
  | 'conflict_review'
  | 'quarantine';

export type PublishOutcome =
  | 'safe_new_event'
  | 'safe_existing_update'
  | 'safe_no_change'
  | 'manual_conflict'
  | 'not_publishable';

export type GenreDisposition =
  | 'confirmed'
  | 'publishable_patch'
  | 'suggested_only'
  | 'missing';

export interface PublishedEventSnapshot {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  venueName?: string;
  venueCity?: string;
  websiteUrl?: string;
  ticketUrl?: string;
  description?: string;
  imageUrl?: string;
  genreLabels?: string[];
  priceText?: string;
  ticketStatus?: string;
  ageRestriction?: string;
  venueEnvironment?: string;
  organizerName?: string;
  lineup?: string[];
}

export interface DraftPublishBatchContext {
  concreteUrlOwners: Map<string, string>;
  manualLocksByEventId: Map<string, Set<string>>;
}

export interface DraftFieldPreviewEntry {
  field: string;
  currentValue?: unknown;
  proposedValue?: unknown;
  action: 'insert' | 'update' | 'preserve' | 'blocked_manual_lock';
  sourceRole?: 'official' | 'ticket' | 'mixed';
}

export interface DraftConsumerPreviewResult {
  cardRenderable: boolean;
  detailRenderable: boolean;
  title: string;
  dateLabel: string;
  venueLabel: string;
  genreChips: string[];
  lineup: string[];
  ticketPrice?: string;
  ticketStatus?: string;
  ctaUrl?: string;
  ctaRole: 'ticket' | 'official' | 'none';
  issues: string[];
}

export interface DraftEligibilityAssessment {
  draftId: string;
  persistenceRecordId?: string;
  storedReviewTrack: ReviewTrack;
  storedReviewDecision: PersistedDraftDecision;
  suggestedReviewTrack: SuggestedReviewTrack;
  automaticPublishEligible: boolean;
  eligibilityReasons: string[];
  blockingReasons: string[];
  enrichmentGaps: string[];
  identityVerdict: CleanIdentityVerdict | 'identity_conflict' | 'missing_core';
  genreDisposition: GenreDisposition;
  publishOutcome: PublishOutcome;
  matchedEventIds: string[];
  publishEligible: boolean;
  fieldPreview: DraftFieldPreviewEntry[];
  consumerPreview: DraftConsumerPreviewResult;
}

export interface DraftPublishPreviewSummary {
  loadedDrafts: number;
  storedReviewTracks: Record<ReviewTrack, number>;
  storedDecisions: Record<PersistedDraftDecision, number>;
  suggestedReviewTracks: Record<SuggestedReviewTrack, number>;
  publishOutcomes: Record<PublishOutcome, number>;
  automaticPublishEligible: number;
  enrichmentGapCounts: Record<string, number>;
  genreDispositionCounts: Record<GenreDisposition, number>;
  approvedDraftPreview?: DraftEligibilityAssessment;
  consumerPreviewFailures: number;
  databaseWriteOperations: 0;
  eventWriteRequests: 0;
  draftWriteRequests: 0;
  productionMutationsInThisRun: 0;
  rolloutActivated: false;
}

export interface DraftPublishPreviewReport {
  assessments: DraftEligibilityAssessment[];
  summary: DraftPublishPreviewSummary;
  adminSummary: {
    automaticallyPublishable: number;
    safeNewEvents: number;
    safeUpdates: number;
    safeNoChange: number;
    enrichmentOnlyGaps: number;
    realConflicts: number;
    quarantine: number;
  };
}

const ADD_ON_PRICE =
  /\b(?:parking|locker|shuttle|camping|deposit|pfand|upgrade|add[- ]?on)\b/i;

function dedupe(values: string[]): string[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}

function localCalendarDay(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = parseEventCalendarDay(value);
  if (!parsed) return value.trim().slice(0, 10);
  return [
    String(parsed.year).padStart(4, '0'),
    String(parsed.month).padStart(2, '0'),
    String(parsed.day).padStart(2, '0'),
  ].join('-');
}

export function collectDraftConcreteUrls(draft: ImportDraft): string[] {
  const event = draft.proposedCanonicalEvent;
  return dedupe(
    [event?.websiteUrl, event?.ticketUrl, ...draft.sources.map((source) => source.sourceUrl)]
      .filter((value): value is string => Boolean(value && isEventIdentityUrl(value)))
      .map(normalizePublicUrl)
      .filter((value): value is string => Boolean(value)),
  );
}

function hasWrongUrlRoles(event: CanonicalEvent | undefined): string[] {
  if (!event) return [];
  const issues: string[] = [];
  if (event.websiteUrl) {
    const classification = classifyTicketDestination(event.websiteUrl).destinationClass;
    if (
      ['ticket_platform_event', 'ticket_platform_listing', 'embedded_checkout_evidence'].includes(
        classification,
      )
    ) {
      issues.push('website_url_is_ticket_url');
    }
  }
  if (
    event.ticketUrl &&
    classifyTicketDestination(event.ticketUrl).destinationClass === 'official_event_page'
  ) {
    issues.push('ticket_url_is_official_url');
  }
  if (event.admissionPrice?.text && ADD_ON_PRICE.test(event.admissionPrice.text)) {
    issues.push('add_on_used_as_admission_price');
  }
  return issues;
}

export function collectEnrichmentGaps(draft: ImportDraft): string[] {
  const event = draft.proposedCanonicalEvent;
  const gaps: string[] = [];
  if (!draft.genres.normalizedLabels.length) gaps.push('genres_missing');
  if (!event?.lineup?.length && event?.lineupState !== 'tba') gaps.push('lineup_missing');
  if (!event?.description?.trim()) gaps.push('description_missing');
  if (!draft.imageUrl) gaps.push('image_missing');
  if (!event?.endDate?.trim()) gaps.push('end_time_missing');
  if (!event?.minimumAge?.trim()) gaps.push('minimum_age_missing');
  const hasOfficial = draft.sources.some((source) => source.sourceFamily === 'official_website');
  if (hasOfficial && !event?.ticketUrl && !event?.admissionPrice) {
    gaps.push('ticket_data_missing');
  }
  const uncertainGenres = draft.genres.items.filter(
    (item) => item.uncertain || item.confidence === 'low',
  );
  if (uncertainGenres.length) gaps.push('genres_uncertain');
  return gaps;
}

function resolveGenreDisposition(genres: GenreContractResult): GenreDisposition {
  if (genres.items.some((item) => item.confirmed)) return 'confirmed';
  const publishable = genres.items.filter(
    (item) => !item.uncertain && ['high', 'medium'].includes(item.confidence),
  );
  if (publishable.length) return 'publishable_patch';
  if (genres.chipSuggestions.length || genres.uncertainLabels.length) return 'suggested_only';
  return 'missing';
}

function needsGenreQuickReview(draft: ImportDraft): boolean {
  const publishable = draft.genres.items.filter(
    (item) => !item.confirmed && !item.uncertain && ['high', 'medium'].includes(item.confidence),
  );
  const distinct = new Set(publishable.map((item) => normalizeMatchText(item.normalizedLabel)));
  return distinct.size > 1;
}

function identityVerdictForDraft(draft: ImportDraft): CleanIdentityVerdict | 'identity_conflict' | 'missing_core' {
  if (draft.audit.duplicateUrlReconciliation?.mode === 'identity_conflict') {
    return 'identity_conflict';
  }
  if (!draft.evidence.length) return 'missing_core';
  return new IdentityResolver().resolve(draft.evidence).verdict;
}

function hasNormalizedTitleCore(event: CanonicalEvent | undefined): boolean {
  if (!event?.title?.trim()) return false;
  return analyzeEventTitleCore(event.title, {
    venueName: event.venueName ?? event.locationText,
  }).coreTokens.length > 0;
}

function hasExplicitVenue(event: CanonicalEvent | undefined): boolean {
  return Boolean(event?.venueName?.trim() || event?.locationText?.trim());
}

export function collectCoreBlockingReasons(
  draft: ImportDraft,
  batch: DraftPublishBatchContext,
): string[] {
  const event = draft.proposedCanonicalEvent;
  const reasons: string[] = [];
  const duplicateAudit = draft.audit.duplicateUrlReconciliation;

  if (duplicateAudit?.mode === 'identity_conflict') {
    reasons.push(...duplicateAudit.conflictReasons);
    return dedupe(reasons);
  }

  if (!hasNormalizedTitleCore(event)) reasons.push('title_core_missing');
  if (!event?.startDate?.trim() || !localCalendarDay(event.startDate)) {
    reasons.push('start_date_invalid');
  }
  if (!hasExplicitVenue(event)) reasons.push('venue_missing');
  if (!draft.verifiedAt?.trim()) reasons.push('verified_at_missing');
  if (!draft.evidence.length) reasons.push('evidence_missing');
  if (!draft.evidence.some((entry) => hasStablePublicIdentity(entry))) {
    reasons.push('stable_public_identity_missing');
  }
  if (!collectDraftConcreteUrls(draft).length) reasons.push('concrete_event_url_missing');
  reasons.push(...hasWrongUrlRoles(event));

  const hasCollision = draft.duplicates.some(
    (entry) => entry.reason !== 'community_correction_target',
  );
  if (hasCollision) reasons.push('possible_duplicate');
  if (
    draft.reviewReasons.some((reason) =>
      /mismatch|collision|critical|ticket_relationship/i.test(reason),
    )
  ) {
    reasons.push('critical_review_reason');
  }

  for (const url of collectDraftConcreteUrls(draft)) {
    const owner = batch.concreteUrlOwners.get(url);
    if (owner && owner !== draft.id) reasons.push(`duplicate_concrete_event_url:${url}`);
  }

  return dedupe(reasons);
}

export function decideSuggestedReviewTrack(input: {
  draft: ImportDraft;
  blockingReasons: string[];
  enrichmentGaps: string[];
}): SuggestedReviewTrack {
  const { draft, blockingReasons } = input;
  if (
    draft.reviewTrack === 'conflict_review' ||
    draft.audit.duplicateUrlReconciliation?.mode === 'identity_conflict' ||
    blockingReasons.some((reason) =>
      /conflict|duplicate|mismatch|collision|critical|identity_conflict|wrong_url|add_on/i.test(
        reason,
      ),
    )
  ) {
    return 'conflict_review';
  }

  const coreBlockers = blockingReasons.filter(
    (reason) =>
      !reason.startsWith('duplicate_concrete_event_url:') ||
      blockingReasons.includes('possible_duplicate'),
  );
  if (
    coreBlockers.length > 0 ||
    !draft.proposedCanonicalEvent ||
    !draft.evidence.length
  ) {
    return 'quarantine';
  }

  if (needsGenreQuickReview(draft)) return 'quick_review';
  return 'auto_ready';
}

function draftToKnownCandidate(draft: ImportDraft): NormalizedEventCandidate {
  const event = draft.proposedCanonicalEvent!;
  return {
    externalId: draft.sourceExternalId ?? draft.id,
    rawSourceType: 'unknown',
    title: event.title ?? '',
    startDate: event.startDate ?? '',
    venueName: event.venueName ?? event.locationText,
    eventUrl: event.websiteUrl,
    ticketUrl: event.ticketUrl,
    artistNames: event.lineup?.map((entry) => entry.displayName),
  };
}

function snapshotToKnownEvent(event: PublishedEventSnapshot): KnownEventForDuplicateCheck {
  return {
    id: event.id,
    title: event.title,
    startDate: event.startDate,
    venueName: event.venueName ?? event.venueCity,
    cityName: event.venueCity,
    eventUrl: event.websiteUrl,
    ticketUrl: event.ticketUrl,
  };
}

export function findStableExistingMatches(
  draft: ImportDraft,
  publishedEvents: PublishedEventSnapshot[],
): string[] {
  const event = draft.proposedCanonicalEvent;
  if (!event?.startDate) return [];
  const candidate = draftToKnownCandidate(draft);
  const day = localCalendarDay(event.startDate);
  const titleCore = analyzeEventTitleCore(event.title ?? '', {
    venueName: event.venueName ?? event.locationText,
  });
  const urls = new Set(collectDraftConcreteUrls(draft));

  const matches = publishedEvents.filter((published) => {
    if (!sameCalendarDay(candidate.startDate, published.startDate)) return false;
    const publishedCore = analyzeEventTitleCore(published.title, {
      venueName: published.venueName ?? published.venueCity,
    });
    if (!compareEventTitleCores(titleCore, publishedCore).coresAgree) return false;
    if (
      candidate.venueName &&
      published.venueName &&
      !venueCompatible(candidate.venueName, published.venueName)
    ) {
      return false;
    }
    const publishedUrls = dedupe(
      [published.websiteUrl, published.ticketUrl]
        .filter((value): value is string => Boolean(value && isEventIdentityUrl(value)))
        .map(normalizePublicUrl)
        .filter((value): value is string => Boolean(value)),
    );
    const sharedUrl = publishedUrls.some((url) => urls.has(url));
    const ownership = evaluateEventOwnershipMatch({
      candidate,
      event: snapshotToKnownEvent(published),
    });
    return sharedUrl || ownership.accepted;
  });

  return matches.map((entry) => entry.id);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  if (typeof left === 'string' && typeof right === 'string') {
    if (left.includes('T') || right.includes('T')) {
      const leftInstant = Date.parse(left);
      const rightInstant = Date.parse(right);
      if (Number.isFinite(leftInstant) && Number.isFinite(rightInstant)) {
        return leftInstant === rightInstant;
      }
    }
    return left.trim() === right.trim();
  }
  return String(left ?? '').trim() === String(right ?? '').trim();
}

function currentValueForField(
  existing: PublishedEventSnapshot,
  field: string,
): unknown {
  if (field === 'genres') return existing.genreLabels;
  return existing[field as keyof PublishedEventSnapshot];
}

function genrePublishValues(draft: ImportDraft): string[] {
  const confirmed = draft.genres.items
    .filter((item) => item.confirmed)
    .map((item) => item.normalizedLabel);
  if (confirmed.length) return dedupe(confirmed);
  return draft.genres.items
    .filter((item) => !item.uncertain && ['high', 'medium'].includes(item.confidence))
    .map((item) => item.normalizedLabel)
    .filter((value, index, all) => all.indexOf(value) === index);
}

export function buildFieldPublishPreview(
  draft: ImportDraft,
  existing?: PublishedEventSnapshot,
  manualLocks: Set<string> = new Set(),
): DraftFieldPreviewEntry[] {
  const event = draft.proposedCanonicalEvent;
  if (!event) return [];
  const officialSource = draft.sources.some((source) => source.sourceFamily === 'official_website');
  const ticketSource = draft.sources.some((source) => source.sourceFamily !== 'official_website');
  const role: DraftFieldPreviewEntry['sourceRole'] =
    officialSource && ticketSource ? 'mixed' : officialSource ? 'official' : 'ticket';

  const proposed: Array<[string, unknown]> = [
    ['title', event.title],
    ['startDate', event.startDate],
    ['endDate', event.endDate],
    ['venueName', event.venueName ?? event.locationText],
    ['venueCity', event.locationText],
    ['websiteUrl', event.websiteUrl],
    ['ticketUrl', event.ticketUrl],
    ['priceText', event.admissionPrice?.text ?? (event.admissionPrice ? `${event.admissionPrice.amount} ${event.admissionPrice.currency}` : undefined)],
    ['ticketStatus', event.ticketStatus],
    ['ticketPhases', event.ticketPhases],
    ['description', event.description],
    ['imageUrl', draft.imageUrl],
    ['genres', genrePublishValues(draft)],
    ['lineup', event.lineup?.map((entry) => entry.displayName)],
    ['minimumAge', event.minimumAge],
    ['venueEnvironment', event.venueEnvironment],
  ];

  return proposed.flatMap(([field, proposedValue]): DraftFieldPreviewEntry[] => {
    if (proposedValue === undefined || proposedValue === null || proposedValue === '') {
      return [];
    }
    if (manualLocks.has(field)) {
      return [
        {
          field,
          currentValue: existing ? existing[field as keyof PublishedEventSnapshot] : undefined,
          proposedValue,
          action: 'blocked_manual_lock',
          sourceRole: role,
        },
      ];
    }
    const currentValue = existing ? currentValueForField(existing, field) : undefined;
    if (existing && valuesEqual(currentValue, proposedValue)) {
      return [{ field, currentValue, proposedValue, action: 'preserve', sourceRole: role }];
    }
    return [
      {
        field,
        currentValue,
        proposedValue,
        action: existing ? 'update' : 'insert',
        sourceRole: role,
      },
    ];
  });
}

export function buildConsumerPreview(
  draft: ImportDraft,
  fieldPreview: DraftFieldPreviewEntry[],
): DraftConsumerPreviewResult {
  const event = draft.proposedCanonicalEvent;
  const title = event?.title?.trim() || '';
  const venueLabel = event?.venueName?.trim() || event?.locationText?.trim() || '';
  const day = localCalendarDay(event?.startDate) ?? '';
  const dateLabel = day
    ? new Date(`${day}T22:00:00`).toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';
  const genreChips = draft.genres.chipSuggestions.length
    ? draft.genres.chipSuggestions
    : draft.genres.normalizedLabels;
  const lineup =
    event?.lineup?.map((entry) => entry.displayName).filter(Boolean) ??
    (event?.lineupState === 'tba' ? ['TBA'] : []);
  const priceEntry = fieldPreview.find((entry) => entry.field === 'priceText');
  const ticketPrice =
    typeof priceEntry?.proposedValue === 'string' ? priceEntry.proposedValue : undefined;
  const ticketStatus = event?.ticketStatus;
  const ctaUrl = event?.ticketUrl ?? event?.websiteUrl;
  const ctaRole: DraftConsumerPreviewResult['ctaRole'] = event?.ticketUrl
    ? 'ticket'
    : event?.websiteUrl
      ? 'official'
      : 'none';
  const issues: string[] = [];
  if (!title) issues.push('missing_title');
  if (!day) issues.push('missing_date');
  if (!venueLabel) issues.push('missing_venue');
  if (dateLabel && /^\d{4}-\d{2}-\d{2}/.test(dateLabel)) issues.push('raw_iso_date_visible');
  if (event?.websiteUrl && event.ticketUrl && event.websiteUrl === event.ticketUrl) {
    issues.push('duplicate_cta_urls');
  }
  if (
    fieldPreview.some(
      (entry) => entry.field === 'websiteUrl' && entry.action !== 'preserve' && entry.proposedValue,
    ) &&
    event?.ticketUrl &&
    classifyTicketDestination(String(event.websiteUrl)).destinationClass !== 'official_event_page'
  ) {
    issues.push('website_url_role_invalid');
  }

  return {
    cardRenderable: Boolean(title && day && venueLabel),
    detailRenderable: Boolean(title && day && venueLabel),
    title,
    dateLabel,
    venueLabel,
    genreChips,
    lineup,
    ticketPrice,
    ticketStatus,
    ctaUrl,
    ctaRole,
    issues,
  };
}

export function assessDraftPublishEligibility(input: {
  draft: ImportDraft;
  storedReviewDecision?: PersistedDraftDecision;
  publishedEvents: PublishedEventSnapshot[];
  batch: DraftPublishBatchContext;
}): DraftEligibilityAssessment {
  const { draft, publishedEvents, batch } = input;
  const blockingReasons = collectCoreBlockingReasons(draft, batch);
  const enrichmentGaps = collectEnrichmentGaps(draft);
  const suggestedReviewTrack = decideSuggestedReviewTrack({
    draft,
    blockingReasons,
    enrichmentGaps,
  });
  const identityVerdict = identityVerdictForDraft(draft);
  const genreDisposition = resolveGenreDisposition(draft.genres);
  const eligibilityReasons: string[] = [];
  if (suggestedReviewTrack === 'auto_ready') eligibilityReasons.push('core_complete');
  if (enrichmentGaps.length) eligibilityReasons.push('optional_enrichment_gaps_present');
  if (genreDisposition === 'publishable_patch') eligibilityReasons.push('genre_patch_available');

  const matchedEventIds =
    suggestedReviewTrack === 'auto_ready' || suggestedReviewTrack === 'quick_review'
      ? findStableExistingMatches(draft, publishedEvents)
      : [];

  let publishOutcome: PublishOutcome = 'not_publishable';
  if (suggestedReviewTrack === 'auto_ready') {
    if (matchedEventIds.length > 1) publishOutcome = 'manual_conflict';
    else if (matchedEventIds.length === 1) {
      const preview = buildFieldPublishPreview(
        draft,
        publishedEvents.find((event) => event.id === matchedEventIds[0]),
        batch.manualLocksByEventId.get(matchedEventIds[0]!),
      );
      const hasUpdates = preview.some((entry) => entry.action === 'update' || entry.action === 'insert');
      publishOutcome = hasUpdates ? 'safe_existing_update' : 'safe_no_change';
    } else {
      publishOutcome = 'safe_new_event';
    }
  }

  const manualLocks =
    matchedEventIds.length === 1
      ? batch.manualLocksByEventId.get(matchedEventIds[0]!) ?? new Set()
      : new Set<string>();
  const lockViolations = buildFieldPublishPreview(
    draft,
    matchedEventIds.length === 1
      ? publishedEvents.find((event) => event.id === matchedEventIds[0])
      : undefined,
    manualLocks,
  ).filter((entry) => entry.action === 'blocked_manual_lock');
  if (lockViolations.length) blockingReasons.push('manual_lock_violation');

  const automaticPublishEligible =
    suggestedReviewTrack === 'auto_ready' &&
    blockingReasons.length === 0 &&
    publishOutcome !== 'not_publishable' &&
    publishOutcome !== 'manual_conflict';

  if (lockViolations.length) {
    publishOutcome = 'not_publishable';
  }

  const fieldPreview = buildFieldPublishPreview(
    draft,
    matchedEventIds.length === 1
      ? publishedEvents.find((event) => event.id === matchedEventIds[0])
      : undefined,
    manualLocks,
  );
  const consumerPreview = buildConsumerPreview(draft, fieldPreview);

  return {
    draftId: draft.id,
    persistenceRecordId: draft.persistenceRecordId,
    storedReviewTrack: draft.reviewTrack,
    storedReviewDecision: input.storedReviewDecision ?? 'pending',
    suggestedReviewTrack,
    automaticPublishEligible,
    eligibilityReasons: dedupe(eligibilityReasons),
    blockingReasons: dedupe(blockingReasons),
    enrichmentGaps,
    identityVerdict,
    genreDisposition,
    publishOutcome,
    matchedEventIds,
    publishEligible: automaticPublishEligible,
    fieldPreview,
    consumerPreview,
  };
}

export function buildDraftPublishPreviewReport(input: {
  drafts: ImportDraft[];
  reviewDecisions: Map<string, PersistedDraftDecision>;
  publishedEvents: PublishedEventSnapshot[];
  manualLocksByEventId?: Map<string, Set<string>>;
}): DraftPublishPreviewReport {
  const concreteUrlOwners = new Map<string, string>();
  for (const draft of input.drafts) {
    for (const url of collectDraftConcreteUrls(draft)) {
      if (!concreteUrlOwners.has(url)) concreteUrlOwners.set(url, draft.id);
    }
  }
  const batch: DraftPublishBatchContext = {
    concreteUrlOwners,
    manualLocksByEventId: input.manualLocksByEventId ?? new Map(),
  };

  const assessments = input.drafts.map((draft) =>
    assessDraftPublishEligibility({
      draft,
      storedReviewDecision: input.reviewDecisions.get(draft.id) ?? 'pending',
      publishedEvents: input.publishedEvents,
      batch,
    }),
  );

  const summary: DraftPublishPreviewSummary = {
    loadedDrafts: assessments.length,
    storedReviewTracks: {
      auto_ready: assessments.filter((entry) => entry.storedReviewTrack === 'auto_ready').length,
      quick_review: assessments.filter((entry) => entry.storedReviewTrack === 'quick_review').length,
      conflict_review: assessments.filter((entry) => entry.storedReviewTrack === 'conflict_review')
        .length,
    },
    storedDecisions: {
      pending: assessments.filter((entry) => entry.storedReviewDecision === 'pending').length,
      approved: assessments.filter((entry) => entry.storedReviewDecision === 'approved').length,
      rejected: assessments.filter((entry) => entry.storedReviewDecision === 'rejected').length,
      deferred: assessments.filter((entry) => entry.storedReviewDecision === 'deferred').length,
    },
    suggestedReviewTracks: {
      auto_ready: assessments.filter((entry) => entry.suggestedReviewTrack === 'auto_ready').length,
      quick_review: assessments.filter((entry) => entry.suggestedReviewTrack === 'quick_review')
        .length,
      conflict_review: assessments.filter(
        (entry) => entry.suggestedReviewTrack === 'conflict_review',
      ).length,
      quarantine: assessments.filter((entry) => entry.suggestedReviewTrack === 'quarantine').length,
    },
    publishOutcomes: {
      safe_new_event: assessments.filter((entry) => entry.publishOutcome === 'safe_new_event')
        .length,
      safe_existing_update: assessments.filter(
        (entry) => entry.publishOutcome === 'safe_existing_update',
      ).length,
      safe_no_change: assessments.filter((entry) => entry.publishOutcome === 'safe_no_change')
        .length,
      manual_conflict: assessments.filter((entry) => entry.publishOutcome === 'manual_conflict')
        .length,
      not_publishable: assessments.filter((entry) => entry.publishOutcome === 'not_publishable')
        .length,
    },
    automaticPublishEligible: assessments.filter((entry) => entry.automaticPublishEligible).length,
    enrichmentGapCounts: {},
    genreDispositionCounts: {
      confirmed: assessments.filter((entry) => entry.genreDisposition === 'confirmed').length,
      publishable_patch: assessments.filter((entry) => entry.genreDisposition === 'publishable_patch')
        .length,
      suggested_only: assessments.filter((entry) => entry.genreDisposition === 'suggested_only')
        .length,
      missing: assessments.filter((entry) => entry.genreDisposition === 'missing').length,
    },
    approvedDraftPreview: assessments.find((entry) => entry.storedReviewDecision === 'approved'),
    consumerPreviewFailures: assessments.filter(
      (entry) =>
        (entry.publishOutcome === 'safe_new_event' ||
          entry.publishOutcome === 'safe_existing_update') &&
        (!entry.consumerPreview.cardRenderable || entry.consumerPreview.issues.length > 0),
    ).length,
    databaseWriteOperations: 0,
    eventWriteRequests: 0,
    draftWriteRequests: 0,
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
  };

  for (const assessment of assessments) {
    for (const gap of assessment.enrichmentGaps) {
      summary.enrichmentGapCounts[gap] = (summary.enrichmentGapCounts[gap] ?? 0) + 1;
    }
  }

  return {
    assessments,
    summary,
    adminSummary: {
      automaticallyPublishable: summary.automaticPublishEligible,
      safeNewEvents: summary.publishOutcomes.safe_new_event,
      safeUpdates: summary.publishOutcomes.safe_existing_update,
      safeNoChange: summary.publishOutcomes.safe_no_change,
      enrichmentOnlyGaps: assessments.filter(
        (entry) => entry.enrichmentGaps.length > 0 && entry.automaticPublishEligible,
      ).length,
      realConflicts:
        summary.suggestedReviewTracks.conflict_review + summary.publishOutcomes.manual_conflict,
      quarantine: summary.suggestedReviewTracks.quarantine,
    },
  };
}
