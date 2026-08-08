import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import {
  evaluateEventEvidenceIdentityGate,
  type EventEvidenceIdentityGateInput,
} from '@/features/import/domain/event-evidence-identity-gate';
import type { OfficialPageIdentityEvidence } from '@/features/import/domain/official-page-ticket-corroboration';
import {
  analyzeEventTitleCore,
  compareEventTitleCores,
} from '@/features/import/matching/event-title-core';
import type { EventIdentitySnapshot } from '@/features/import/ticket-platform-identity/types';
import {
  extractLineupFromContentBlocks,
  normalizeLineupContentBlocks,
} from '@/features/import/unified-website/lineup-extraction';

export interface LineupPublishIdentityEvidence {
  evidence?: EventEvidenceIdentityGateInput['evidence'];
  officialEventUrl?: string;
  officialPage?: OfficialPageIdentityEvidence;
  officialOutboundTicketUrls?: string[];
  evidenceUrl?: string;
  verifiedAt?: string;
}

export interface LineupPublishGateInput {
  event: EventIdentitySnapshot;
  contentBlocks: string[];
  /** @deprecated Prefer identityEvidence.evidence */
  pageEvidence?: {
    pageTitle?: string;
    listRowTitle?: string;
    eventDate?: string;
    venueName?: string;
  };
  /** Full identity evidence bundle aligned with canonical ticket writer gate input. */
  identityEvidence?: LineupPublishIdentityEvidence;
  /** Optional override; gate derives from content blocks when omitted. */
  descriptionMentionsArtist?: boolean;
  contaminationDetected?: boolean;
}

export interface LineupPublishGateResult {
  allowed: boolean;
  reason: string;
  extraction: ReturnType<typeof extractLineupFromContentBlocks>;
  headlinerOnly?: string;
}

const HEADLINER_TITLE_PATTERN = /^([A-Z0-9][\w .&'/-]{1,60})\s*(?:[–—-]\s*|\bat\b\s+|\bpresented by\b\s+)/i;

export function extractHeadlinerFromTitle(title: string): string | undefined {
  const match = title.trim().match(HEADLINER_TITLE_PATTERN);
  return match?.[1]?.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function descriptionConfirmsArtistPerformance(description: string, artist: string): boolean {
  if (!description.trim() || !artist.trim()) {
    return false;
  }
  const escaped = escapeRegExp(artist);
  return new RegExp(
    `\\b(?:with|featuring|feat\\.?|presents?)\\s+${escaped}\\b|\\b${escaped}\\b[^.\\n]{0,160}\\b(?:night|returns|live|performance|unforgettable|bring|presents|mainfloor|stage)\\b`,
    'i',
  ).test(description);
}

function recoverArtistDisplayName(
  officialPageTitle: string,
  coreToken: string,
): string | undefined {
  const pattern = new RegExp(`\\b(${escapeRegExp(coreToken).replace(/\\-/g, '[\\s-]')})\\b`, 'i');
  const match = officialPageTitle.match(pattern);
  return match?.[1]?.trim();
}

function buildIdentityGateInput(input: LineupPublishGateInput): EventEvidenceIdentityGateInput {
  const evidence = input.identityEvidence?.evidence ?? input.pageEvidence ?? {};
  return {
    event: input.event,
    evidence: {
      pageTitle: evidence.pageTitle,
      listRowTitle: evidence.listRowTitle,
      eventDate: evidence.eventDate,
      venueName: evidence.venueName,
    },
    officialEventUrl: input.identityEvidence?.officialEventUrl ?? input.event.websiteUrl,
    officialPage: input.identityEvidence?.officialPage,
    officialOutboundTicketUrls: input.identityEvidence?.officialOutboundTicketUrls,
    evidenceUrl: input.identityEvidence?.evidenceUrl,
    verifiedAt: input.identityEvidence?.verifiedAt,
  };
}

function resolveSingleHeadlinerArtist(input: LineupPublishGateInput): {
  artist?: string;
  officialTitleConfirms: boolean;
  descriptionConfirms: boolean;
} {
  const officialPageTitle =
    input.identityEvidence?.officialPage?.pageTitle ??
    input.identityEvidence?.evidence?.pageTitle ??
    input.pageEvidence?.pageTitle;
  if (!officialPageTitle?.trim()) {
    return { officialTitleConfirms: false, descriptionConfirms: false };
  }

  const officialCore = analyzeEventTitleCore(officialPageTitle, {
    venueName: input.event.venueName,
  });
  const eventCore = analyzeEventTitleCore(input.event.title, {
    venueName: input.event.venueName,
  });
  const comparison = compareEventTitleCores(officialCore, eventCore);
  if (!comparison.coresAgree || comparison.sharedCoreTokens.length !== 1) {
    return { officialTitleConfirms: false, descriptionConfirms: false };
  }

  const coreToken = comparison.sharedCoreTokens[0];
  if (!coreToken) {
    return { officialTitleConfirms: false, descriptionConfirms: false };
  }

  const artist = recoverArtistDisplayName(officialPageTitle, coreToken);
  if (!artist) {
    return { officialTitleConfirms: false, descriptionConfirms: false };
  }

  const joinedDescription = normalizeLineupContentBlocks(input.contentBlocks).join('\n');
  const descriptionConfirms =
    input.descriptionMentionsArtist ?? descriptionConfirmsArtistPerformance(joinedDescription, artist);
  const officialTitleConfirms = new RegExp(`\\b${escapeRegExp(artist)}\\b`, 'i').test(officialPageTitle);

  return { artist, officialTitleConfirms, descriptionConfirms };
}

function identityAllowsLineupPublish(
  identity: ReturnType<typeof evaluateEventEvidenceIdentityGate>,
): boolean {
  return (
    identity.criticalFieldsPublishAllowed &&
    (identity.verdict === 'exact' || identity.verdict === 'corroborated')
  );
}

export function evaluateLineupPublishGate(input: LineupPublishGateInput): LineupPublishGateResult {
  if (input.contaminationDetected) {
    return {
      allowed: false,
      reason: 'lineup_blocked_contamination',
      extraction: { state: 'empty', entries: [], inclusionReason: 'Contamination gate blocked lineup' },
    };
  }

  const identity = evaluateEventEvidenceIdentityGate(buildIdentityGateInput(input));

  if (!identity.criticalFieldsPublishAllowed && identity.verdict !== 'partial_review_only') {
    return {
      allowed: false,
      reason: `lineup_blocked_identity:${identity.verdict}`,
      extraction: { state: 'empty', entries: [], inclusionReason: identity.reason },
    };
  }

  const normalizedBlocks = normalizeLineupContentBlocks(input.contentBlocks);
  const extraction = extractLineupFromContentBlocks(normalizedBlocks);

  if (extraction.state === 'tba') {
    return {
      allowed: identityAllowsLineupPublish(identity),
      reason: identityAllowsLineupPublish(identity)
        ? 'lineup_tba_confirmed'
        : `lineup_review_only:${identity.verdict}`,
      extraction,
    };
  }

  if (extraction.state === 'explicit_artists' && extraction.entries.length > 0) {
    return {
      allowed: identityAllowsLineupPublish(identity),
      reason: identityAllowsLineupPublish(identity)
        ? 'structured_lineup_identity_ok'
        : `lineup_review_only:${identity.verdict}`,
      extraction,
    };
  }

  const headliner = resolveSingleHeadlinerArtist(input);
  if (
    headliner.artist &&
    headliner.officialTitleConfirms &&
    headliner.descriptionConfirms &&
    identityAllowsLineupPublish(identity)
  ) {
    const entry: LineupEvidenceEntry = {
      sortOrder: 0,
      displayName: headliner.artist,
      rawSourceSpelling: headliner.artist,
      normalizedName: headliner.artist,
      billingRelation: 'HEADLINER',
      isB2b: false,
      isF2f: false,
      isLiveSet: false,
      confidence: 0.82,
      reviewState: 'not_reviewed',
      inclusionReason:
        'Headliner confirmed by shared title core, official title mention, and description performance evidence',
    };
    return {
      allowed: true,
      reason: 'single_headliner_dual_confirmation',
      extraction: {
        state: 'explicit_artists',
        entries: [entry],
        inclusionReason: entry.inclusionReason,
      },
      headlinerOnly: headliner.artist,
    };
  }

  if (headliner.artist && (!headliner.officialTitleConfirms || !headliner.descriptionConfirms)) {
    return {
      allowed: false,
      reason: !headliner.officialTitleConfirms
        ? 'single_headliner_blocked_title_not_confirmed'
        : 'single_headliner_blocked_description_not_confirmed',
      extraction,
    };
  }

  return {
    allowed: false,
    reason: 'no_structured_lineup_or_dual_headliner_confirmation',
    extraction,
  };
}
