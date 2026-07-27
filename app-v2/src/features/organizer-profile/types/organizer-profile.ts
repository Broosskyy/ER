import type { SocialPlatform } from '@/components/organizer/view-models';

export interface OrganizerSocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
}

export interface OrganizerProfileRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  location: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  logoUri?: string;
  bannerUri?: string;
  socialLinks: OrganizerSocialLink[];
  createdAt: string;
  updatedAt: string;
}

export function createOrganizerProfileId(): string {
  return `organizer-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createOrganizerSocialLink(
  platform: SocialPlatform,
  url: string,
): OrganizerSocialLink {
  return {
    id: `social-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    platform,
    url: url.trim(),
  };
}

export const EMPTY_ORGANIZER_PROFILE: Omit<OrganizerProfileRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  location: '',
  website: '',
  contactEmail: '',
  contactPhone: '',
  socialLinks: [],
};
