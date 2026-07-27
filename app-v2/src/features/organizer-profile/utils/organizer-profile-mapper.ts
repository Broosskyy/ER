import type { ImageSourcePropType } from 'react-native';

import type { OrganizerMetricViewModel, SocialLinkViewModel } from '@/components/organizer/view-models';
import type { ProfileHeaderViewModel } from '@/components/profiles/view-models';
import type { AdminEventRecord } from '@/data/types/records';

import type { OrganizerProfileRecord } from '../types/organizer-profile';

function toImageSource(uri?: string): ImageSourcePropType | undefined {
  if (!uri?.trim()) {
    return undefined;
  }
  return { uri: uri.trim() };
}

export function mapOrganizerProfileToHeader(
  profile: OrganizerProfileRecord,
): ProfileHeaderViewModel {
  return {
    id: profile.id,
    type: 'organizer',
    name: profile.name.trim() || 'Organizer-Profil',
    handleOrTypeLabel: 'Veranstalter',
    bio: profile.description.trim() || undefined,
    locationLabel: profile.location.trim() || undefined,
    websiteLabel: profile.website.trim() || undefined,
    avatar: toImageSource(profile.logoUri),
    verificationStatus: 'unverified',
    accessibilityLabel: `Organizer-Profil von ${profile.name.trim() || 'Unbenannt'}`,
  };
}

export function mapOrganizerSocialLinks(profile: OrganizerProfileRecord): SocialLinkViewModel[] {
  return profile.socialLinks
    .filter((link) => link.url.trim())
    .map((link) => ({
      id: link.id,
      platform: link.platform,
      valueLabel: link.url.trim(),
      accessibilityLabel: `${link.platform} ${link.url.trim()}`,
    }));
}

export function buildOrganizerLocalStats(events: AdminEventRecord[]): OrganizerMetricViewModel[] {
  const drafts = events.filter((event) => event.status === 'draft').length;
  const inReview = events.filter((event) => event.status === 'review').length;
  const published = events.filter((event) => event.status === 'published').length;

  return [
    {
      id: 'drafts',
      kind: 'pending_events',
      label: 'Entwürfe',
      valueLabel: String(drafts),
      accessibilityLabel: `${drafts} Entwürfe`,
    },
    {
      id: 'review',
      kind: 'pending',
      label: 'In Prüfung',
      valueLabel: String(inReview),
      accessibilityLabel: `${inReview} Events in Prüfung`,
    },
    {
      id: 'published',
      kind: 'events',
      label: 'Veröffentlicht',
      valueLabel: String(published),
      accessibilityLabel: `${published} veröffentlichte Events`,
    },
  ];
}
