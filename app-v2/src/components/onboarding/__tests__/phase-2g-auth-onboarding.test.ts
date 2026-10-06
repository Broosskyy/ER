import { describe, expect, it } from 'vitest';

import {
  resolveAuthNoticeBannerVariant,
  resolvePermissionBadgeStatus,
  resolvePermissionStatusLabel,
} from '@/components/onboarding/onboarding-styles';
import type {
  AuthFormViewModel,
  NotificationPreferenceViewModel,
  OnboardingSlideViewModel,
  PermissionCardViewModel,
  SocialAuthProviderViewModel,
  TermsAgreementViewModel,
  VerificationStateViewModel,
} from '@/components/onboarding/view-models';

describe('Phase 2G onboarding and auth display contracts', () => {
  it('resolves permission status labels and badge statuses', () => {
    expect(resolvePermissionStatusLabel('granted')).toBe('Erlaubt');
    expect(resolvePermissionStatusLabel('denied')).toBe('Abgelehnt');
    expect(resolvePermissionBadgeStatus('limited')).toBe('warning');
    expect(resolvePermissionBadgeStatus('unavailable')).toBe('default');
  });

  it('resolves auth notice banner variants', () => {
    expect(resolveAuthNoticeBannerVariant('error')).toBe('error');
    expect(resolveAuthNoticeBannerVariant('email_sent')).toBe('success');
    expect(resolveAuthNoticeBannerVariant('verification_required')).toBe('warning');
    expect(resolveAuthNoticeBannerVariant('rate_limit')).toBe('error');
  });

  it('keeps onboarding, auth, and permission models presentation-only', () => {
    const slide: OnboardingSlideViewModel = {
      id: 'welcome',
      title: 'Discover',
      description: 'Events in deiner Nähe',
      accessibilityLabel: 'Welcome slide',
    };
    const form: AuthFormViewModel = {
      title: 'Welcome back',
      submitLabel: 'Anmelden',
    };
    const social: SocialAuthProviderViewModel = {
      provider: 'google',
      label: 'Mit Google fortfahren',
      accessibilityLabel: 'Google Login',
    };
    const verification: VerificationStateViewModel = {
      state: 'pending',
      title: 'Verifizierung ausstehend',
      accessibilityLabel: 'Pending verification',
    };
    const permission: PermissionCardViewModel = {
      kind: 'location',
      title: 'Standort',
      description: 'Events in deiner Nähe',
      accessibilityLabel: 'Location permission',
    };
    const preference: NotificationPreferenceViewModel = {
      id: 'reminders',
      title: 'Event-Erinnerungen',
      enabled: true,
    };
    const terms: TermsAgreementViewModel = {
      acceptTerms: true,
      acceptPrivacy: true,
      termsLabel: 'AGB',
      privacyLabel: 'Datenschutz',
    };

    expect('navigation' in slide).toBe(false);
    expect('validate' in form).toBe(false);
    expect('oauth' in social).toBe(false);
    expect('sendEmail' in verification).toBe(false);
    expect('requestPermission' in permission).toBe(false);
    expect('persist' in preference).toBe(false);
    expect('legalAcceptance' in terms).toBe(false);
  });
});
