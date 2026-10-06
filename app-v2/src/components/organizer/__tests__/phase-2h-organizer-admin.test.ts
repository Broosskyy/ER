import { describe, expect, it } from 'vitest';

import {
  resolveDuplicateFieldBadgeStatus,
  resolveDuplicateFieldLabel,
  resolveReviewBadgeStatus,
  resolveReviewStatusLabel,
  resolveSourceBadgeStatus,
  resolveSourceStatusLabel,
} from '@/components/admin/admin-styles';
import type {
  AdminReviewViewModel,
  AuditLogViewModel,
  DuplicateCandidateViewModel,
  EventSourceViewModel,
  ReviewTimelineViewModel,
} from '@/components/admin/view-models';
import {
  resolveIntegrationBadgeStatus,
  resolveSubmissionBadgeStatus,
  resolveSubmissionBannerVariant,
  resolveSubmissionStatusLabel,
  resolveTeamRoleBadgeStatus,
  resolveTeamRoleLabel,
  resolveVerificationBadgeStatus,
  resolveVerificationStatusLabel,
} from '@/components/organizer/organizer-styles';
import type {
  EventDraftViewModel,
  OrganizerMetricViewModel,
  ProfileCompletionViewModel,
  SubmissionStepViewModel,
  TeamMemberManagementViewModel,
} from '@/components/organizer/view-models';

describe('Phase 2H organizer and admin display contracts', () => {
  it('resolves submission status labels and banner variants', () => {
    expect(resolveSubmissionStatusLabel('draft')).toBe('Entwurf');
    expect(resolveSubmissionStatusLabel('changes_requested')).toBe('Änderungen angefordert');
    expect(resolveSubmissionBadgeStatus('approved')).toBe('success');
    expect(resolveSubmissionBannerVariant('rejected')).toBe('error');
    expect(resolveSubmissionBannerVariant('published')).toBe('success');
  });

  it('resolves team role and verification labels', () => {
    expect(resolveTeamRoleLabel('owner')).toBe('Owner');
    expect(resolveTeamRoleBadgeStatus('editor')).toBe('success');
    expect(resolveVerificationStatusLabel('under_review')).toBe('In Prüfung');
    expect(resolveVerificationBadgeStatus('approved')).toBe('success');
  });

  it('resolves integration and admin review statuses', () => {
    expect(resolveIntegrationBadgeStatus('syncing')).toBe('info');
    expect(resolveReviewStatusLabel('pending')).toBe('Pending');
    expect(resolveReviewBadgeStatus('changes_requested')).toBe('warning');
    expect(resolveSourceStatusLabel('rate_limited')).toBe('Rate Limit');
    expect(resolveSourceBadgeStatus('error')).toBe('error');
  });

  it('resolves duplicate comparison field states', () => {
    expect(resolveDuplicateFieldLabel('conflict')).toBe('Konflikt');
    expect(resolveDuplicateFieldBadgeStatus('equal')).toBe('success');
    expect(resolveDuplicateFieldBadgeStatus('missing')).toBe('default');
  });

  it('keeps organizer and admin view models presentation-only', () => {
    const metric: OrganizerMetricViewModel = {
      id: 'views',
      kind: 'views',
      label: 'Aufrufe',
      valueLabel: '48.7K',
      accessibilityLabel: 'Aufrufe',
    };
    const step: SubmissionStepViewModel = {
      id: 's1',
      index: 1,
      label: 'Basisinfos',
      state: 'active',
    };
    const draft: EventDraftViewModel = {
      id: 'd1',
      title: 'Industrial Rebirth',
      lastEditedLabel: 'Heute',
      currentStep: 4,
      totalSteps: 5,
      status: 'draft',
      accessibilityLabel: 'Draft',
    };
    const completion: ProfileCompletionViewModel = {
      percent: 72,
      statusLabel: 'Fast fertig',
      openItems: ['Logo'],
      accessibilityLabel: 'Completion',
    };
    const member: TeamMemberManagementViewModel = {
      id: 'm1',
      name: 'Daniel Weber',
      emailLabel: 'daniel@voidevents.de',
      role: 'owner',
      statusLabel: 'Online',
      accessibilityLabel: 'Member',
    };
    const review: AdminReviewViewModel = {
      id: 'r1',
      type: 'event',
      title: 'Underground Movement',
      status: 'pending',
      timestampLabel: 'Vor 15 Min.',
      accessibilityLabel: 'Review',
    };
    const timeline: ReviewTimelineViewModel = {
      id: 't1',
      entries: [],
      accessibilityLabel: 'Timeline',
    };
    const source: EventSourceViewModel = {
      id: 's1',
      name: 'Resident Advisor',
      sourceType: 'api',
      sourceTypeLabel: 'API',
      status: 'active',
      accessibilityLabel: 'Source',
    };
    const duplicate: DuplicateCandidateViewModel = {
      id: 'dup1',
      events: [],
      similarityScoreLabel: '92%',
      accessibilityLabel: 'Duplicate',
    };
    const audit: AuditLogViewModel = {
      id: 'a1',
      actorLabel: 'Max Admin',
      actionLabel: 'Genehmigt',
      entityLabel: 'Event',
      timestampLabel: 'Jetzt',
      accessibilityLabel: 'Audit',
    };

    expect('calculate' in metric).toBe(false);
    expect('navigate' in step).toBe(false);
    expect('persist' in draft).toBe(false);
    expect('compute' in completion).toBe(false);
    expect('invite' in member).toBe(false);
    expect('moderate' in review).toBe(false);
    expect('generateHistory' in timeline).toBe(false);
    expect('sync' in source).toBe(false);
    expect('merge' in duplicate).toBe(false);
    expect('log' in audit).toBe(false);
  });
});
