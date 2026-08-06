import type { ImageSourcePropType } from 'react-native';

import type { ArtistRecord, OrganizerRecord, VenueRecord } from '@/data/types/records';
import type { ProfileHeaderViewModel, VerificationStatus } from '@/components/profiles/view-models';
import type { OrganizerProfileViewModel } from '@/components/profiles/view-models';
import type { VenueDetailViewModel } from '@/components/event-detail/view-models';
import type { LineupItemViewModel } from '@/components/discovery/view-models';
import type { Event } from '@/features/events/types/event';

import { listArtistAliases } from '@/features/profiles/services/entity-profile-loader';
import {
  resolveOrganizerVerificationStatus,
  resolveVenueVerificationStatus,
} from '@/features/profiles/utils/entity-verification-status';
import {
  buildEntityHandleLabel,
  resolveVenuePublicTypeLabel,
} from '@/features/profiles/utils/entity-type-labels';

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
  const coverImage: ImageSourcePropType | undefined = record.logoUrl
    ? { uri: record.logoUrl }
    : undefined;

  return {
    id: record.id,
    type: 'organizer',
    name: record.name,
    avatar,
    coverImage,
    handleOrTypeLabel: buildEntityHandleLabel('Veranstalter', record.city),
    verificationStatus: resolveOrganizerVerificationStatus(record.id),
    bio: record.description,
    locationLabel: record.city && record.country ? `${record.city}, ${record.country}` : record.city,
    websiteLabel: record.website,
    stats: eventCount > 0 ? [{ id: 'events', valueLabel: String(eventCount), label: 'Events' }] : undefined,
    accessibilityLabel: `Organizer-Profil von ${record.name}`,
  };
}

export function toVenueProfileHeader(record: VenueRecord, eventCount: number): ProfileHeaderViewModel {
  const typeLabel = resolveVenuePublicTypeLabel(record.venueType);
  return {
    id: record.id,
    type: 'venue',
    name: record.name,
    handleOrTypeLabel: buildEntityHandleLabel(typeLabel, record.city),
    verificationStatus: resolveVenueVerificationStatus(record.id),
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
  const coverImage: ImageSourcePropType | undefined = record.imageUrl
    ? { uri: record.imageUrl }
    : undefined;
  const aliases = listArtistAliases(record.id).filter((alias: string) => alias !== record.name);

  return {
    id: record.id,
    type: 'artist',
    name: record.name,
    avatar,
    coverImage,
    handleOrTypeLabel:
      genreLabels.length > 0
        ? buildEntityHandleLabel(`Artist · ${genreLabels.join(', ')}`)
        : buildEntityHandleLabel('Artist'),
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
    verificationStatus: resolveOrganizerVerificationStatus(record.id),
    accessibilityLabel: `Veranstalter ${record.name}`,
  };
}

export function toVenueDetailFromRecord(
  record: VenueRecord,
  event?: Pick<Event, 'address' | 'venue' | 'city'>,
): VenueDetailViewModel {
  const streetAddress = formatAddress(record);
  const address = streetAddress ?? (event?.address?.trim() ? event.address.trim() : undefined);

  return {
    id: record.id,
    name: record.name,
    addressLabel: address,
    cityLabel: record.city,
    verified: resolveVenueVerificationStatus(record.id) === 'official_source',
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
