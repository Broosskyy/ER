import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import type { EventIdentitySnapshot } from '@/features/import/ticket-platform-identity/types';
import { extractLineupFromContentBlocks } from '@/features/import/unified-website/lineup-extraction';

export interface LineupPublishGateInput {
  event: EventIdentitySnapshot;
  contentBlocks: string[];
  pageEvidence?: {
    pageTitle?: string;
    listRowTitle?: string;
    eventDate?: string;
    venueName?: string;
  };
  titlePatternArtist?: string;
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

export function evaluateLineupPublishGate(input: LineupPublishGateInput): LineupPublishGateResult {
  if (input.contaminationDetected) {
    return {
      allowed: false,
      reason: 'lineup_blocked_contamination',
      extraction: { state: 'empty', entries: [], inclusionReason: 'Contamination gate blocked lineup' },
    };
  }

  const identity = evaluateEventEvidenceIdentityGate({
    event: input.event,
    evidence: {
      pageTitle: input.pageEvidence?.pageTitle,
      listRowTitle: input.pageEvidence?.listRowTitle,
      eventDate: input.pageEvidence?.eventDate,
      venueName: input.pageEvidence?.venueName,
    },
  });

  if (!identity.criticalFieldsPublishAllowed && identity.verdict !== 'partial_review_only') {
    return {
      allowed: false,
      reason: `lineup_blocked_identity:${identity.verdict}`,
      extraction: { state: 'empty', entries: [], inclusionReason: identity.reason },
    };
  }

  const extraction = extractLineupFromContentBlocks(input.contentBlocks);
  if (extraction.state === 'explicit_artists' && extraction.entries.length > 0) {
    return {
      allowed: identity.criticalFieldsPublishAllowed,
      reason: identity.criticalFieldsPublishAllowed
        ? 'structured_lineup_identity_ok'
        : `lineup_review_only:${identity.verdict}`,
      extraction,
    };
  }

  const titleArtist = input.titlePatternArtist ?? extractHeadlinerFromTitle(input.event.title);
  if (
    titleArtist &&
    input.descriptionMentionsArtist &&
    identity.criticalFieldsPublishAllowed
  ) {
    const entry: LineupEvidenceEntry = {
      sortOrder: 0,
      displayName: titleArtist,
      rawSourceSpelling: titleArtist,
      normalizedName: titleArtist,
      billingRelation: 'HEADLINER',
      isB2b: false,
      isF2f: false,
      isLiveSet: false,
      confidence: 0.82,
      reviewState: 'not_reviewed',
      inclusionReason: 'Headliner confirmed by title pattern and description mention',
    };
    return {
      allowed: true,
      reason: 'single_headliner_dual_confirmation',
      extraction: {
        state: 'explicit_artists',
        entries: [entry],
        inclusionReason: entry.inclusionReason,
      },
      headlinerOnly: titleArtist,
    };
  }

  return {
    allowed: false,
    reason: 'no_structured_lineup_or_dual_headliner_confirmation',
    extraction,
  };
}
