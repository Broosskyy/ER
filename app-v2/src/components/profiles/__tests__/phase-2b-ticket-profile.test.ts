import { describe, expect, it } from 'vitest';

import { resolveTicketStatus } from '@/components/discovery/event-status-styles';
import type { ProfileTab } from '@/components/profiles/ProfileTabs';
import { resolveVerificationStatus } from '@/components/profiles/verification-styles';
import {
  earlyBirdTicket,
  organizerCard,
  soldOutRegularTicket,
  teamMembers,
  ticketSummary,
  userProfile,
} from '@/components/preview/phase-2b-fixtures';
import type { FollowState } from '@/components/profiles/view-models';

describe('Phase 2B ticket display contracts', () => {
  it('resolves issued and availability statuses without order logic', () => {
    const statuses = [
      'available',
      'reserved',
      'paid',
      'valid',
      'used',
      'cancelled',
      'refunded',
      'expired',
      'sold_out',
    ] as const;

    for (const status of statuses) {
      expect(resolveTicketStatus(status).label).not.toHaveLength(0);
    }

    expect(resolveTicketStatus('used').label).toBe('Verwendet');
    expect(resolveTicketStatus('refunded').badgeStatus).toBe('info');
    expect(resolveTicketStatus('sold_out').badgeStatus).toBe('error');
  });

  it('keeps ticket product availability and service fees as display values', () => {
    expect(earlyBirdTicket.serviceFeeLabel).toBe('inkl. 4,90 € Servicegebühr');
    expect(soldOutRegularTicket.status).toBe('sold_out');
    expect(ticketSummary.totalLabel).toBe('64,90 €');
    expect('priceCents' in earlyBirdTicket).toBe(false);
  });
});

describe('Phase 2B profile and organizer display contracts', () => {
  it('supports all follow states without callbacks in view models', () => {
    const states: FollowState[] = ['follow', 'following', 'requested', 'loading', 'disabled'];
    expect(states).toHaveLength(5);
    expect('onPress' in userProfile).toBe(false);
  });

  it('retains the mockup-backed Events and About tab identifiers', () => {
    const tabs: ProfileTab[] = ['events', 'about'];
    expect(tabs).toEqual(['events', 'about']);
  });

  it('resolves all verification and claim display states', () => {
    expect(resolveVerificationStatus('verified').badgeStatus).toBe('success');
    expect(resolveVerificationStatus('pending').badgeStatus).toBe('warning');
    expect(resolveVerificationStatus('unverified').badgeStatus).toBe('default');
    expect(resolveVerificationStatus('rejected').badgeStatus).toBe('error');
    expect(organizerCard.claimStatus).toBe('verified');
  });

  it('uses display-only organizer team roles', () => {
    expect(teamMembers.map((member) => member.role)).toEqual(['admin', 'editor', 'viewer']);
    expect(teamMembers.every((member) => !('repository' in member))).toBe(true);
  });
});
