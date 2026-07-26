import { StyleSheet, View } from 'react-native';

import { TicketStatusBadge } from '@/components/discovery/EventStatusBadge';
import { FollowButton } from '@/components/profiles/FollowButton';
import { OrganizerClaimBadge, OrganizerProfileCard, TeamMemberRow } from '@/components/profiles/OrganizerComponents';
import { ProfileHeader } from '@/components/profiles/ProfileHeader';
import { ProfileTabs } from '@/components/profiles/ProfileTabs';
import { VerificationBadge } from '@/components/profiles/VerificationBadge';
import { QRCodePlaceholder } from '@/components/ticketing/QRCodePlaceholder';
import { TicketCard } from '@/components/ticketing/TicketCard';
import { TicketSummary } from '@/components/ticketing/TicketSummary';
import { TicketTypeCard } from '@/components/ticketing/TicketTypeCard';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';

import {
  artistProfile,
  earlyBirdTicket,
  freeRsvpTicket,
  organizerCard,
  organizerProfile,
  purchasedHardTechnoTicket,
  soldOutRegularTicket,
  teamMembers,
  ticketSummary,
  userProfile,
  venueProfile,
  vipTicket,
} from './phase-2b-fixtures';
import { PreviewThemeFrame } from './PreviewThemeFrame';

function TicketingShowcase() {
  return <Stack gap="md">
    <TicketCard ticket={purchasedHardTechnoTicket} onPress={() => undefined} />
    <TicketCard ticket={freeRsvpTicket} variant="available" onPress={() => undefined} />
    <TicketCard ticket={purchasedHardTechnoTicket} variant="compact" onPress={() => undefined} />
    <TicketTypeCard ticketType={earlyBirdTicket} selected onPress={() => undefined} />
    <TicketTypeCard ticketType={soldOutRegularTicket} onPress={() => undefined} />
    <TicketTypeCard ticketType={vipTicket} onPress={() => undefined} />
    <TicketSummary summary={ticketSummary} />
    <Stack direction="horizontal" gap="sm" style={styles.wrap}>
      <TicketStatusBadge status="valid" /><TicketStatusBadge status="used" /><TicketStatusBadge status="refunded" /><TicketStatusBadge status="sold_out" />
    </Stack>
    <QRCodePlaceholder status="valid" hintLabel="Gültig" />
    <QRCodePlaceholder status="used" />
  </Stack>;
}

function ProfileShowcase() {
  return <Stack gap="md">
    <ProfileHeader profile={userProfile} primaryAction={<FollowButton state="follow" onPress={() => undefined} />} />
    <ProfileHeader profile={organizerProfile} followAction={<FollowButton state="following" onPress={() => undefined} />} />
    <ProfileHeader profile={venueProfile} />
    <ProfileHeader profile={artistProfile} />
    <Stack direction="horizontal" gap="sm" style={styles.wrap}>
      <FollowButton state="follow" onPress={() => undefined} /><FollowButton state="following" onPress={() => undefined} /><FollowButton state="requested" onPress={() => undefined} /><FollowButton state="loading" /><FollowButton state="disabled" />
    </Stack>
    <ProfileTabs tabs={['events', 'about']} selectedTab="events" onTabPress={() => undefined} />
  </Stack>;
}

function OrganizerShowcase() {
  return <Stack gap="md">
    <OrganizerProfileCard organizer={organizerCard} followState="follow" onFollowPress={() => undefined} onPress={() => undefined} />
    <Stack direction="horizontal" gap="sm" style={styles.wrap}>
      <OrganizerClaimBadge status="unclaimed" /><OrganizerClaimBadge status="pending" /><OrganizerClaimBadge status="verified" /><OrganizerClaimBadge status="rejected" />
      <VerificationBadge status="verified" showIcon /><VerificationBadge status="pending" showIcon /><VerificationBadge status="unverified" /><VerificationBadge status="rejected" />
    </Stack>
    {teamMembers.map((member) => <TeamMemberRow key={member.id} member={member} onMenuPress={() => undefined} />)}
  </Stack>;
}

export function Phase2BTicketProfilePreview() {
  return (
    <Section title="Sprint 2A Phase 2B – Ticket, Profile & Organizer Components" subtitle="Mockup-backed presentation components only; no checkout, follow, claim, or team business logic">
      <Section title="Ticketing"><View style={styles.frames}><PreviewThemeFrame mode="light" label="Light"><TicketingShowcase /></PreviewThemeFrame><PreviewThemeFrame mode="dark" label="Dark"><TicketingShowcase /></PreviewThemeFrame></View></Section>
      <Section title="Profile"><View style={styles.frames}><PreviewThemeFrame mode="light" label="Light"><ProfileShowcase /></PreviewThemeFrame><PreviewThemeFrame mode="dark" label="Dark"><ProfileShowcase /></PreviewThemeFrame></View></Section>
      <Section title="Organizer"><View style={styles.frames}><PreviewThemeFrame mode="light" label="Light"><OrganizerShowcase /></PreviewThemeFrame><PreviewThemeFrame mode="dark" label="Dark"><OrganizerShowcase /></PreviewThemeFrame></View></Section>
    </Section>
  );
}

const styles = StyleSheet.create({
  frames: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  wrap: { flexWrap: 'wrap' },
});
