import type { ImageSourcePropType } from 'react-native';

export type AppBrandVariant = 'compact' | 'large';

export interface OnboardingSlideViewModel {
  id: string;
  stepLabel?: string;
  title: string;
  highlightedTitle?: string;
  description: string;
  image?: ImageSourcePropType;
  badgeLabel?: string;
  footerLabel?: string;
  accessibilityLabel: string;
}

export interface AuthFormViewModel {
  title: string;
  description?: string;
  submitLabel: string;
  secondaryActionLabel?: string;
  termsHint?: string;
}

export type SocialAuthProvider = 'google' | 'apple';

export interface SocialAuthProviderViewModel {
  provider: SocialAuthProvider;
  label: string;
  accessibilityLabel: string;
}

export type VerificationUiState = 'email_sent' | 'pending' | 'verified' | 'expired' | 'error';

export interface VerificationStateViewModel {
  state: VerificationUiState;
  title: string;
  description?: string;
  emailLabel?: string;
  accessibilityLabel: string;
}

export type PermissionKind = 'location' | 'notifications' | 'calendar' | 'camera';

export type PermissionStatus = 'not_requested' | 'granted' | 'denied' | 'limited' | 'unavailable';

export interface PermissionCardViewModel {
  kind: PermissionKind;
  title: string;
  description: string;
  status?: PermissionStatus;
  accessibilityLabel: string;
}

export interface NotificationPreferenceViewModel {
  id: string;
  title: string;
  description?: string;
  enabled?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: 'notifications-outline' | 'calendar-outline' | 'ticket-outline' | 'people-outline' | 'sparkles-outline';
}

export interface TermsAgreementViewModel {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptMarketing?: boolean;
  termsLabel: string;
  privacyLabel: string;
  marketingLabel?: string;
}

export interface AgeConfirmationViewModel {
  minimumAgeLabel: string;
  confirmed: boolean;
  birthYearLabel?: string;
  errorLabel?: string;
}
