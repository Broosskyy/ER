import type { AppIconName } from '@/components/primitives/AppIcon';
import type { BadgeStatus } from '@/components/feedback/badge-styles';

import type { VerificationStatus } from './view-models';

export interface ResolvedVerificationStatus {
  label: string;
  badgeStatus: BadgeStatus;
  icon: AppIconName;
}

export function resolveVerificationStatus(status: VerificationStatus): ResolvedVerificationStatus {
  switch (status) {
    case 'verified':
      return { label: 'Verifiziert', badgeStatus: 'success', icon: 'checkmark-circle' };
    case 'pending':
      return { label: 'In Prüfung', badgeStatus: 'warning', icon: 'hourglass-outline' };
    case 'rejected':
      return { label: 'Abgelehnt', badgeStatus: 'error', icon: 'close-circle-outline' };
    case 'official_source':
      return { label: 'Offizielle Quelle', badgeStatus: 'info', icon: 'shield-outline' };
    case 'profile_not_claimed':
      return { label: 'Profil nicht beansprucht', badgeStatus: 'default', icon: 'person-outline' };
    case 'organizer_confirmed':
      return { label: 'Veranstalter bestätigt', badgeStatus: 'success', icon: 'checkmark-circle' };
    case 'unverified':
    default:
      return { label: 'Nicht verifiziert', badgeStatus: 'default', icon: 'help-circle-outline' };
  }
}
