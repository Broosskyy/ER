import type { ArtistRecord, OrganizerRecord, VenueRecord } from '@/data/types/records';
import type { FollowEntityType } from '@/features/follows/follow-service';

export interface EntitySocialLink {
  id: string;
  label: string;
  url: string;
  network: 'website' | 'instagram' | 'facebook' | 'soundcloud' | 'spotify' | 'resident-advisor';
}

export interface EntityProfileAboutContent {
  description?: string;
  locationLabel?: string;
  websiteLabel?: string;
  genreLabels: string[];
  socialLinks: EntitySocialLink[];
  /** Reserved gallery contract — populated when media pipeline ships. */
  galleryImageUrls: string[];
}

function pushSocial(
  links: EntitySocialLink[],
  network: EntitySocialLink['network'],
  label: string,
  url?: string,
): void {
  const trimmed = url?.trim();
  if (!trimmed) {
    return;
  }
  links.push({ id: network, label, url: trimmed, network });
}

function socialLinksFromOrganizer(record: OrganizerRecord): EntitySocialLink[] {
  const links: EntitySocialLink[] = [];
  pushSocial(links, 'website', 'Website', record.website);
  pushSocial(links, 'instagram', 'Instagram', record.instagram);
  pushSocial(links, 'facebook', 'Facebook', record.facebook);
  pushSocial(links, 'soundcloud', 'SoundCloud', record.soundcloud);
  pushSocial(links, 'resident-advisor', 'Resident Advisor', record.residentAdvisor);
  return links;
}

function socialLinksFromArtist(record: ArtistRecord): EntitySocialLink[] {
  const links: EntitySocialLink[] = [];
  pushSocial(links, 'website', 'Website', record.website);
  pushSocial(links, 'instagram', 'Instagram', record.instagram);
  pushSocial(links, 'facebook', 'Facebook', record.facebook);
  pushSocial(links, 'soundcloud', 'SoundCloud', record.soundcloud);
  pushSocial(links, 'spotify', 'Spotify', record.spotify);
  return links;
}

function socialLinksFromVenue(record: VenueRecord): EntitySocialLink[] {
  const links: EntitySocialLink[] = [];
  pushSocial(links, 'website', 'Website', record.website);
  pushSocial(links, 'instagram', 'Instagram', record.instagram);
  return links;
}

export function buildEntityProfileAboutContent(
  entityType: FollowEntityType,
  record: OrganizerRecord | VenueRecord | ArtistRecord,
  genreLabels: string[] = [],
): EntityProfileAboutContent {
  if (entityType === 'organizer') {
    const organizer = record as OrganizerRecord;
    return {
      description: organizer.description?.trim() || undefined,
      locationLabel:
        organizer.city && organizer.country
          ? `${organizer.city}, ${organizer.country}`
          : organizer.city?.trim() || undefined,
      websiteLabel: organizer.website?.trim() || undefined,
      genreLabels: [],
      socialLinks: socialLinksFromOrganizer(organizer),
      galleryImageUrls: [],
    };
  }

  if (entityType === 'venue') {
    const venue = record as VenueRecord;
    return {
      description: venue.notes?.trim() || undefined,
      locationLabel: formatVenueLocationLabel(venue),
      websiteLabel: venue.website?.trim() || undefined,
      genreLabels: [],
      socialLinks: socialLinksFromVenue(venue),
      galleryImageUrls: [],
    };
  }

  const artist = record as ArtistRecord;
  return {
    description: artist.bio?.trim() || undefined,
    locationLabel:
      artist.city && artist.country
        ? `${artist.city}, ${artist.country}`
        : artist.city?.trim() || undefined,
    websiteLabel: artist.website?.trim() || undefined,
    genreLabels: genreLabels,
    socialLinks: socialLinksFromArtist(artist),
    galleryImageUrls: [],
  };
}

function formatVenueLocationLabel(venue: VenueRecord): string | undefined {
  if (venue.street) {
    const house = venue.houseNumber ? ` ${venue.houseNumber}` : '';
    const postal = venue.postalCode ? `${venue.postalCode} ` : '';
    return `${venue.street}${house}, ${postal}${venue.city}`.trim();
  }
  if (venue.address?.trim()) {
    return venue.address.trim();
  }
  return venue.city?.trim() || undefined;
}

export function hasEntityProfileAboutContent(content: EntityProfileAboutContent): boolean {
  return Boolean(
    content.description ||
      content.locationLabel ||
      content.websiteLabel ||
      content.genreLabels.length > 0 ||
      content.socialLinks.length > 0,
  );
}
