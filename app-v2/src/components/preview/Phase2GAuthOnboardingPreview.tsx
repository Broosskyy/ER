import { useState } from 'react';
import { View } from 'react-native';

import { AuthDivider } from '@/components/auth-ui/AuthDivider';
import { AuthErrorState, AuthLoadingState } from '@/components/auth-ui/AuthStates';
import { AuthForm } from '@/components/auth-ui/AuthForm';
import { AuthNotice } from '@/components/auth-ui/AuthNotice';
import { EmailField } from '@/components/auth-ui/EmailField';
import { PasswordField } from '@/components/auth-ui/PasswordField';
import { SocialAuthButton } from '@/components/auth-ui/SocialAuthButton';
import { TermsAgreement } from '@/components/auth-ui/TermsAgreement';
import { VerificationCodeInput } from '@/components/auth-ui/VerificationCodeInput';
import { VerificationState } from '@/components/auth-ui/VerificationState';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { AppBrandHeader } from '@/components/onboarding/AppBrandHeader';
import { CityOnboardingSelector } from '@/components/onboarding/CityOnboardingSelector';
import { OnboardingActions } from '@/components/onboarding/OnboardingActions';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingSlide } from '@/components/onboarding/OnboardingSlide';
import { LocationPermissionCard } from '@/components/permissions/LocationPermissionCard';
import { NotificationPermissionCard } from '@/components/permissions/NotificationPermissionCard';
import { NotificationPreferenceRow } from '@/components/permissions/NotificationPreferenceRow';
import { PermissionCard } from '@/components/permissions/PermissionCard';
import { PermissionExplainer } from '@/components/permissions/PermissionExplainer';
import { PermissionStatusBadge } from '@/components/permissions/PermissionStatusBadge';

import {
  appleAuth,
  communitySlide,
  discoverSlide,
  emailSentVerification,
  expiredVerification,
  forgotPasswordForm,
  googleAuth,
  loginForm,
  notificationPreferences,
  onboardingCities,
  pendingVerification,
  registerForm,
  registrationTerms,
  ticketsSlide,
  welcomeSlide,
} from './phase-2g-fixtures';
import { PreviewThemeFrame } from './PreviewThemeFrame';

function OnboardingShowcase() {
  return (
    <Stack gap="xl">
      <AppBrandHeader subtitle="DISCOVER. CONNECT. DANCE." />
      <OnboardingSlide slide={welcomeSlide} />
      <OnboardingProgress currentStep={1} totalSteps={4} />
      <OnboardingActions onPrimaryPress={() => undefined} onSkipPress={() => undefined} />
      <OnboardingSlide slide={discoverSlide} />
      <OnboardingProgress currentStep={2} totalSteps={4} />
      <OnboardingActions onPrimaryPress={() => undefined} onBackPress={() => undefined} onSkipPress={() => undefined} />
      <OnboardingSlide slide={communitySlide} />
      <OnboardingSlide slide={ticketsSlide} />
      <OnboardingActions primaryLabel="Los geht's" onPrimaryPress={() => undefined} onBackPress={() => undefined} />
      <CityOnboardingSelector cities={onboardingCities} onSelect={() => undefined} />
    </Stack>
  );
}

function AuthShowcase() {
  const [code, setCode] = useState('123');

  return (
    <Stack gap="xl">
      <AppBrandHeader variant="compact" subtitle="Welcome back" />
      <AuthForm
        form={loginForm}
        onSubmit={() => undefined}
        onSecondaryAction={() => undefined}
        socialProviders={[googleAuth]}
        onSocialPress={() => undefined}
      >
        <EmailField placeholder="E-Mail-Adresse" />
        <PasswordField placeholder="Passwort" />
      </AuthForm>
      <AuthDivider />
      <SocialAuthButton provider={appleAuth} onPress={() => undefined} />
      <AuthForm form={registerForm} onSubmit={() => undefined}>
        <EmailField placeholder="E-Mail-Adresse" />
        <PasswordField placeholder="Passwort" />
        <PasswordField placeholder="Passwort bestätigen" />
        <TermsAgreement agreement={registrationTerms} onToggleTerms={() => undefined} onTogglePrivacy={() => undefined} />
      </AuthForm>
      <AuthForm form={forgotPasswordForm} onSubmit={() => undefined}>
        <EmailField placeholder="E-Mail-Adresse" />
      </AuthForm>
      <AuthNotice kind="error" title="Falsches Passwort" message="E-Mail oder Passwort ist ungültig." />
      <AuthNotice kind="account_exists" title="Account existiert bereits" message="Melde dich an oder setze dein Passwort zurück." />
      <AuthNotice kind="session_expired" title="Sitzung abgelaufen" message="Bitte melde dich erneut an." />
      <AuthNotice kind="email_sent" title="E-Mail gesendet" message="Prüfe dein Postfach für den Reset-Link." />
      <VerificationCodeInput value={code} onChangeText={setCode} />
      <VerificationState state={emailSentVerification} onResend={() => undefined} />
      <VerificationState state={pendingVerification} />
      <VerificationState state={expiredVerification} />
      <AuthLoadingState />
      <AuthErrorState onRetry={() => undefined} />
    </Stack>
  );
}

function PermissionsShowcase() {
  return (
    <Stack gap="xl">
      <PermissionStatusBadge status="granted" />
      <PermissionStatusBadge status="denied" />
      <PermissionCard
        permission={{
          kind: 'location',
          title: 'Standort',
          description: 'Events in deiner Nähe entdecken',
          status: 'not_requested',
          accessibilityLabel: 'Standort',
        }}
      />
      <LocationPermissionCard onAllowPress={() => undefined} onDenyPress={() => undefined} />
      <LocationPermissionCard status="denied" onAllowPress={() => undefined} onDenyPress={() => undefined} />
      <NotificationPermissionCard
        preferences={notificationPreferences}
        onAllowPress={() => undefined}
        onDenyPress={() => undefined}
        onPreferenceChange={() => undefined}
      />
      <NotificationPreferenceRow preference={notificationPreferences[0]!} onValueChange={() => undefined} />
      <PermissionExplainer
        title="Datenschutz"
        description="Ohne Standort siehst du weiterhin Events, aber keine personalisierte Nähe-Sortierung."
        privacyHint="Standortdaten werden nicht an Dritte verkauft."
      />
    </Stack>
  );
}

function Phase2GShowcase() {
  return (
    <Stack gap="xxl">
      <Section title="Onboarding">
        <OnboardingShowcase />
      </Section>
      <Section title="Auth">
        <AuthShowcase />
      </Section>
      <Section title="Permissions">
        <PermissionsShowcase />
      </Section>
    </Stack>
  );
}

export function Phase2GAuthOnboardingPreview() {
  return (
    <Section
      title="Sprint 2A Phase 2G – Onboarding, Auth & Permissions"
      subtitle="UI-only onboarding, auth, and permission presentation — no auth APIs, OAuth, or permission requests"
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <PreviewThemeFrame mode="light" label="Light">
          <Phase2GShowcase />
        </PreviewThemeFrame>
        <PreviewThemeFrame mode="dark" label="Dark">
          <Phase2GShowcase />
        </PreviewThemeFrame>
      </View>
    </Section>
  );
}
