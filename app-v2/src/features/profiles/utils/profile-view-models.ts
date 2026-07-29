import type { ImageSourcePropType } from 'react-native';

import type { ArtistRecord, OrganizerRecord, VenueRecord } from '@/data/types/records';
import type { ProfileHeaderViewModel, VerificationStatus } from '@/components/profiles/view-models';
import type { OrganizerProfileViewModel } from '@/components/profiles/view-models';
import type { VenueDetailViewModel } from '@/components/event-detail/view-models';
import type { LineupItemViewModel } from '@/components/discovery/view-models';
import type { Event } from '@/features/events/types/event';

import { listArtistAliases } from '@/features/profiles/services/entity-profile-loader';

function mapArtistVerification(status: ArtistRecord['verificationStatus']): VerificationStatus {
  if (status === 'verified') return 'verified';
  return 'unverified';
}

function formatAddress(venue: VenueRecord): string | undefined {
  if (venue.street) {
    const house = venue.houseNumber ? ` ${venue.houseNumber}` : '';
    const postal = venue.postalCode ? `${venue.postalCode} ` : '';
    return `${venue.street}${house}, ${postal}${venue.city}`.trim();
  }
  if (venue.address) {
    return venue.address;
  }
  if (venue.city) {
    return venue.city;
  }
  return undefined;
}

export function toOrganizerProfileHeader(
  record: OrganizerRecord,
  eventCount: number,
): ProfileHeaderViewModel {
  const avatar: ImageSourcePropType | undefined = record.logoUrl
    ? { uri: record.logoUrl }
    : undefined;

  return {
    id: record.id,
    type: 'organizer',
    name: record.name,
    avatar,
    handleOrTypeLabel: record.city ? `Veranstalter · ${record.city}` : 'Veranstalter',
    verificationStatus: 'unverified',
    bio: record.description,
    locationLabel: record.city && record.country ? `${record.city}, ${record.country}` : record.city,
    websiteLabel: record.website,
    stats: eventCount > 0 ? [{ id: 'events', valueLabel: String(eventCount), label: 'Events' }] : undefined,
    accessibilityLabel: `Organizer-Profil von ${record.name}`,
  };
}

export function toVenueProfileHeader(record: VenueRecord, eventCount: number): ProfileHeaderViewModel {
  return {
    id: record.id,
    type: 'venue',
    name: record.name,
    handleOrTypeLabel: record.city ? `Club · ${record.city}` : 'Venue',
    verificationStatus: 'unverified',
    bio: record.notes,
    locationLabel: formatAddress(record),
    websiteLabel: record.website,
    stats: eventCount > 0 ? [{ id: 'events', valueLabel: String(eventCount), label: 'Events' }] : undefined,
    accessibilityLabel: `Venue-Profil von ${record.name}`,
  };
}

export function toArtistProfileHeader(
  record: ArtistRecord,
  eventCount: number,
  genreLabels: string[],
): ProfileHeaderViewModel {
  const avatar: ImageSourcePropType | undefined = record.imageUrl
    ? { uri: record.imageUrl }
    : undefined;
  const aliases = listArtistAliases(record.id).filter((alias: string) => alias !== record.name);

  return {
    id: record.id,
    type: 'artist',
    name: record.name,
    avatar,
    handleOrTypeLabel:
      genreLabels.length > 0 ? `Artist · ${genreLabels.join(', ')}` : 'Artist',
    verificationStatus: mapArtistVerification(record.verificationStatus),
    bio: record.bio,
    locationLabel: record.city && record.country ? `${record.city}, ${record.country}` : record.city,
    websiteLabel: record.website,
    stats: [
      ...(eventCount > 0 ? [{ id: 'events' as const, valueLabel: String(eventCount), label: 'Auftritte' }] : []),
      ...(aliases.length > 0
        ? [{ id: 'following' as const, valueLabel: String(aliases.length), label: 'Aliases' }]
        : []),
    ],
    accessibilityLabel: `Artist-Profil von ${record.name}`,
  };
}

export function toOrganizerDetailFromRecord(
  record: OrganizerRecord,
  eventCount: number,
): OrganizerProfileViewModel {
  const avatar: ImageSourcePropType | undefined = record.logoUrl
    ? { uri: record.logoUrl }
    : undefined;

  return {
    id: record.id,
    name: record.name,
    logo: avatar,
    description: record.description,
    eventCountLabel: eventCount > 0 ? `${eventCount} Events` : '',
    followerCountLabel: '',
    verificationStatus: 'unverified',
    accessibilityLabel: `Veranstalter ${record.name}`,
  };
}

export function toVenueDetailFromRecord(
  record: VenueRecord,
  event?: Pick<Event, 'address' | 'venue' | 'city'>,
): VenueDetailViewModel {
  const address = formatAddress(record) ?? event?.address ?? `${record.name}, ${record.city}`;

  return {
    id: record.id,
    name: record.name,
    addressLabel: address,
    cityLabel: record.city,
    verified: false,
    descriptionLabel: record.notes,
    accessibilityLabel: `${record.name}, ${record.city}`,
  };
}

export function toLineupItemFromArtist(record: ArtistRecord, headliner = false): LineupItemViewModel {
  const avatar: ImageSourcePropType | undefined = record.imageUrl
    ? { uri: record.imageUrl }
    : undefined;

  return {
    id: record.id,
    name: record.name,
    image: avatar,
    headliner,
    profileNavigable: true,
    accessibilityLabel: record.name,
  };
}

export function toLineupItemFromName(name: string, headliner = false): LineupItemViewModel {
  return {
    name,
    headliner,
    profileNavigable: false,
    accessibilityLabel: name,
  };
}
