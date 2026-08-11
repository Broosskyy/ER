import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';

import type { CleanSourceFamily, ConnectorOutput } from './event-evidence';

/**
 * Shared ingress contract for every import channel.
 * Path: ImportSubmission → ConnectorOutput/EventEvidence → Clean Core → ImportDraft → ReviewDecision
 */
export type ImportSubmissionKind =
  | 'automatic_source'
  | 'community_manual'
  | 'organizer_manual'
  | 'admin_url'
  | 'media_upload'
  | 'file_feed'
  | 'partner_api';

/** Channels wired in this phase vs contract-only extensions. */
export const WIRED_IMPORT_SUBMISSION_KINDS: readonly ImportSubmissionKind[] = [
  'automatic_source',
  'community_manual',
  'organizer_manual',
  'admin_url',
] as const;

export const CONTRACT_ONLY_IMPORT_SUBMISSION_KINDS: readonly ImportSubmissionKind[] = [
  'media_upload',
  'file_feed',
  'partner_api',
] as const;

export type ImportSubmitterRole =
  | 'system'
  | 'community'
  | 'organizer'
  | 'admin'
  | 'partner';

export type ImportSubmitterTrustHint =
  | 'untrusted'
  | 'trusted_organizer'
  | 'official_source'
  | 'admin';

export interface ImportSubmitter {
  userId?: string;
  role: ImportSubmitterRole;
  displayName?: string;
  /** Extension point for future reputation; not a full trust system. */
  trustHint?: ImportSubmitterTrustHint;
}

export interface ImportSubmissionPayload {
  title?: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  locationText?: string;
  description?: string;
  /** Raw source genre strings; normalized later in the genre contract. */
  genres?: string[];
  lineupNames?: string[];
  websiteUrl?: string;
  ticketUrl?: string;
  imageUrl?: string;
  admissionPrice?: {
    amount: number;
    currency: string;
    text?: string;
  };
  /** URL submission / admin URL import entry point. */
  eventUrl?: string;
  /** Community correction against an existing published event (supplement, not duplicate). */
  correctionTargetEventId?: string;
}

export interface ImportSubmission {
  id: string;
  kind: ImportSubmissionKind;
  submitter: ImportSubmitter;
  submittedAt: string;
  /** Optional for automatic_source when connectorOutputs already carry the payload. */
  payload?: ImportSubmissionPayload;
  sourceId?: string;
  sourceFamily?: CleanSourceFamily;
  /** Pre-adapted connector outputs for automatic_source (and tests). */
  connectorOutputs?: ConnectorOutput[];
  /** Confirmed genres on an existing event — weaker evidence must not overwrite. */
  existingConfirmedGenres?: string[];
  /** Optional duplicate candidates already known to the caller. */
  knownDuplicateEventIds?: string[];
  /** Field keys locked by manual admin edits. */
  manualLocks?: string[];
}

export function isWiredImportSubmissionKind(kind: ImportSubmissionKind): boolean {
  return (WIRED_IMPORT_SUBMISSION_KINDS as readonly string[]).includes(kind);
}

function lineupFromNames(names: string[] | undefined): LineupEvidenceEntry[] | undefined {
  if (!names?.length) return undefined;
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((displayName, index) => ({
      sortOrder: index,
      displayName,
      rawSourceSpelling: displayName,
      normalizedName: displayName.toLowerCase(),
      billingRelation: 'SOLO' as const,
      isB2b: false,
      isF2f: false,
      isLiveSet: false,
      confidence: 0.7,
      reviewState: 'accepted' as const,
      inclusionReason: 'manual_submission',
    }));
}

function inferSourceFamily(submission: ImportSubmission): CleanSourceFamily {
  if (submission.sourceFamily) return submission.sourceFamily;
  // Manual/admin ingress defaults to official_website evidence role unless caller sets family.
  return 'official_website';
}

/**
 * Maps any wired submission into ConnectorOutput units for the shared clean core path.
 * Contract-only kinds throw — no OCR/PDF/CSV engines in this phase.
 */
export function submissionToConnectorOutputs(submission: ImportSubmission): ConnectorOutput[] {
  if (!isWiredImportSubmissionKind(submission.kind)) {
    throw new Error(`import_submission_kind_not_wired:${submission.kind}`);
  }

  if (submission.kind === 'automatic_source') {
    if (!submission.connectorOutputs?.length) {
      throw new Error('automatic_source_requires_connector_outputs');
    }
    return submission.connectorOutputs.map((output) => ({ ...output }));
  }

  const payload = submission.payload ?? {};
  const family = inferSourceFamily(submission);
  const sourceId =
    submission.sourceId ??
    `${submission.kind}:${submission.submitter.userId ?? submission.submitter.role}`;
  const sourceUrl =
    payload.eventUrl?.trim() ||
    payload.websiteUrl?.trim() ||
    payload.ticketUrl?.trim() ||
    `submission://${submission.id}`;
  const isTicketFamily = family !== 'official_website';
  const officialWebsiteUrl = isTicketFamily
    ? payload.websiteUrl?.trim()
    : payload.websiteUrl?.trim() || sourceUrl;
  const publicTicketUrl = isTicketFamily
    ? payload.ticketUrl?.trim() || sourceUrl
    : payload.ticketUrl?.trim();

  return [
    {
      sourceId,
      sourceFamily: family,
      sourceUrl,
      verifiedAt: submission.submittedAt,
      title: payload.title,
      startDate: payload.startDate,
      endDate: payload.endDate,
      venueName: payload.venueName,
      locationText: payload.locationText,
      officialWebsiteUrl,
      outboundTicketUrls: publicTicketUrl ? [publicTicketUrl] : [],
      description: payload.description,
      genres: payload.genres,
      lineup: lineupFromNames(payload.lineupNames),
      lineupState: payload.lineupNames?.length ? 'explicit_artists' : undefined,
      publicTicketUrl,
      admissionPrice: payload.admissionPrice,
      diagnostics: [
        `submission_kind:${submission.kind}`,
        `submitter_role:${submission.submitter.role}`,
        ...(payload.correctionTargetEventId
          ? [`correction_target:${payload.correctionTargetEventId}`]
          : []),
        ...(payload.imageUrl ? ['image_present'] : []),
      ],
    },
  ];
}
