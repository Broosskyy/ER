import type { ImageSourcePropType } from 'react-native';

/** Presentation contracts for public-profile and organizer components. */
export type VerificationStatus = 'verified' | 'pending' | 'unverified' | 'rejected';
export type FollowState = 'follow' | 'following' | 'requested' | 'loading' | 'disabled';
export type ProfileType = 'user' | 'organizer' | 'venue' | 'artist';
export type OrganizerClaimStatus = 'unclaimed' | 'pending' | 'verified' | 'rejected';
export type TeamMemberRole = 'owner' | 'admin' | 'editor' | 'promoter' | 'viewer';

export interface ProfileStatViewModel {
  id: 'followers' | 'following' | 'events' | 'posts';
  valueLabel: string;
  label: string;
}

export interface ProfileHeaderViewModel {
  id: string;
  type: ProfileType;
  name: string;
  avatar?: ImageSourcePropType;
  handleOrTypeLabel: string;
  verificationStatus: VerificationStatus;
  bio?: string;
  locationLabel?: string;
  websiteLabel?: string;
  stats?: ProfileStatViewModel[];
  accessibilityLabel: string;
}

export interface OrganizerProfileViewModel {
  id: string;
  name: string;
  logo?: ImageSourcePropType;
  description?: string;
  eventCountLabel: string;
  followerCountLabel: string;
  verificationStatus: VerificationStatus;
  claimStatus?: OrganizerClaimStatus;
  accessibilityLabel: string;
}

export interface TeamMemberViewModel {
  id: string;
  name: string;
  avatar?: ImageSourcePropType;
  role: TeamMemberRole;
  statusLabel: string;
  accessibilityLabel: string;
}
