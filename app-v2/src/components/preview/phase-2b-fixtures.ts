import type { TicketCardViewModel, TicketSummaryViewModel, TicketTypeViewModel } from '@/components/ticketing/view-models';
import type { OrganizerProfileViewModel, ProfileHeaderViewModel, TeamMemberViewModel } from '@/components/profiles/view-models';

export const purchasedHardTechnoTicket: TicketCardViewModel = {
  id: 'erf-26-7x9k3l',
  eventTitle: 'Eternal Rave Festival 2026',
  categoryLabel: 'FESTIVAL',
  dateLabel: '12. – 14. Juni 2026',
  timeLabel: '12:00 – 06:00',
  venueLabel: 'Rummelsburger Bucht',
  cityLabel: 'Berlin',
  ticketTypeLabel: '1 × General Admission',
  priceLabel: '89,00 €',
  status: 'valid',
  ticketIdLabel: 'Ticket #ERF26-7X9K3L',
  qrHintLabel: 'Ticket anzeigen',
  accessibilityLabel: 'Gültiges General Admission Ticket für Eternal Rave Festival 2026',
};

export const freeRsvpTicket: TicketCardViewModel = {
  id: 'rheinland-rsvp',
  eventTitle: 'Rheinland Open Air',
  dateLabel: '12. Juli 2026',
  venueLabel: 'Rheinpark',
  cityLabel: 'Köln',
  ticketTypeLabel: 'Kostenloses RSVP',
  priceLabel: '0,00 €',
  status: 'available',
  accessibilityLabel: 'Kostenloses RSVP für Rheinland Open Air',
};

export const earlyBirdTicket: TicketTypeViewModel = {
  id: 'early-bird',
  name: 'Early Bird',
  description: 'Zugang für alle Festivaltage.',
  priceLabel: '59,00 €',
  remainingLabel: 'Noch 48 verfügbar',
  salesPeriodLabel: 'Verkauf bis 11. Juni 2026',
  serviceFeeLabel: 'inkl. 4,90 € Servicegebühr',
  status: 'available',
  accessibilityLabel: 'Early Bird Ticket für 59 Euro',
};

export const soldOutRegularTicket: TicketTypeViewModel = {
  id: 'regular',
  name: 'Regular Ticket',
  description: 'Standardzugang.',
  priceLabel: '79,00 €',
  status: 'sold_out',
  accessibilityLabel: 'Ausverkauftes Regular Ticket',
};

export const vipTicket: TicketTypeViewModel = {
  id: 'vip',
  name: 'VIP Ticket',
  description: 'Backstage-Lounge und bevorzugter Einlass.',
  priceLabel: '149,00 €',
  availabilityLabel: 'Begrenzte Verfügbarkeit',
  status: 'unavailable',
  accessibilityLabel: 'Nicht verfügbares VIP Ticket',
};

export const ticketSummary: TicketSummaryViewModel = {
  subtotalLabel: '59,00 €',
  serviceFeeLabel: '4,90 €',
  additionalFees: [{ id: 'city-fee', label: 'Kulturbeitrag', valueLabel: '1,00 €' }],
  totalLabel: '64,90 €',
  accessibilityLabel: 'Preisübersicht mit Gesamtpreis 64 Euro 90',
};

export const userProfile: ProfileHeaderViewModel = {
  id: 'manuel',
  type: 'user',
  name: 'Manuel',
  handleOrTypeLabel: '@ravesberlin',
  verificationStatus: 'verified',
  locationLabel: 'Berlin, Germany',
  stats: [{ id: 'followers', valueLabel: '1.2K', label: 'Follower' }, { id: 'following', valueLabel: '386', label: 'Folge ich' }, { id: 'events', valueLabel: '24', label: 'Events' }],
  accessibilityLabel: 'Profil von Manuel',
};

export const organizerProfile: ProfileHeaderViewModel = {
  id: 'rave-united',
  type: 'organizer',
  name: 'Rave United',
  handleOrTypeLabel: '@raveunited',
  verificationStatus: 'verified',
  bio: 'Wir erschaffen unvergessliche Rave-Erlebnisse.',
  locationLabel: 'Berlin, Deutschland',
  websiteLabel: 'raveunited.com',
  stats: [{ id: 'events', valueLabel: '24', label: 'Veranstaltet' }, { id: 'followers', valueLabel: '18.6K', label: 'Follower' }, { id: 'following', valueLabel: '93', label: 'Folge ich' }],
  accessibilityLabel: 'Organizer-Profil von Rave United',
};

export const venueProfile: ProfileHeaderViewModel = { ...organizerProfile, id: 'kraftwerk-mitte', type: 'venue', name: 'Kraftwerk Mitte', handleOrTypeLabel: 'Club · Dresden', verificationStatus: 'unverified', accessibilityLabel: 'Venue-Profil von Kraftwerk Mitte' };
export const artistProfile: ProfileHeaderViewModel = { ...userProfile, id: 'sara-landry', type: 'artist', name: 'Sara Landry', handleOrTypeLabel: 'Artist · Hard Techno', accessibilityLabel: 'Artist-Profil von Sara Landry' };

export const organizerCard: OrganizerProfileViewModel = {
  id: 'rave-united',
  name: 'Rave United',
  description: 'Veranstalter für Techno und Hard Techno Events in Deutschland.',
  eventCountLabel: '24',
  followerCountLabel: '18.6K',
  verificationStatus: 'verified',
  claimStatus: 'verified',
  accessibilityLabel: 'Verifizierter Veranstalter Rave United',
};

export const teamMembers: TeamMemberViewModel[] = [
  { id: 'daniel-weber', name: 'Daniel Weber', role: 'admin', statusLabel: 'Zuletzt aktiv: Jetzt', accessibilityLabel: 'Daniel Weber, Admin' },
  { id: 'lisa-hoffmann', name: 'Lisa Hoffmann', role: 'editor', statusLabel: 'Zuletzt aktiv: Heute, 14:32', accessibilityLabel: 'Lisa Hoffmann, Editor' },
  { id: 'sarah-lange', name: 'Sarah Lange', role: 'viewer', statusLabel: 'Zuletzt aktiv: Gestern, 20:45', accessibilityLabel: 'Sarah Lange, Viewer' },
];
