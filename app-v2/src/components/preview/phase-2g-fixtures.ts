import type { AuthFormViewModel, OnboardingSlideViewModel, SocialAuthProviderViewModel, TermsAgreementViewModel, VerificationStateViewModel } from '@/components/onboarding/view-models';
import type { NotificationPreferenceViewModel } from '@/components/onboarding/view-models';

export const welcomeSlide: OnboardingSlideViewModel = {
  id: 'welcome',
  title: 'Discover the world\'s best electronic ',
  highlightedTitle: 'events.',
  description: 'Finde Raves, Clubs und Festivals in deiner Nähe und weltweit.',
  accessibilityLabel: 'Welcome to Eternal Rave',
};

export const discoverSlide: OnboardingSlideViewModel = {
  id: 'discover',
  stepLabel: 'STEP 2 OF 4',
  title: 'Discover ',
  highlightedTitle: 'events near you.',
  description: 'Finde die besten Raves, Clubs und Festivals in deiner Umgebung oder wo immer du bist.',
  accessibilityLabel: 'Discover events near you',
};

export const communitySlide: OnboardingSlideViewModel = {
  id: 'community',
  stepLabel: 'STEP 3 OF 4',
  title: 'Connect with the ',
  highlightedTitle: 'community.',
  description: 'Lerne Gleichgesinnte kennen, teile deine Erlebnisse und werde Teil der globalen Rave-Szene.',
  accessibilityLabel: 'Connect with the community',
};

export const ticketsSlide: OnboardingSlideViewModel = {
  id: 'tickets',
  stepLabel: 'STEP 4 OF 4',
  title: 'Ready to ',
  highlightedTitle: 'rave?',
  description: 'Buche deine Tickets, sichere dir exklusive Deals und erlebe Nächte, die du nie vergisst.',
  accessibilityLabel: 'Ready to rave',
};

export const loginForm: AuthFormViewModel = {
  title: 'Welcome back',
  description: 'Melde dich an, um dein nächstes Nightlife-Erlebnis zu entdecken.',
  submitLabel: 'Anmelden',
  secondaryActionLabel: 'Passwort vergessen?',
};

export const registerForm: AuthFormViewModel = {
  title: 'Create your account',
  description: 'Werde Teil der globalen Electronic-Music-Community.',
  submitLabel: 'Account erstellen',
  secondaryActionLabel: 'Schon dabei? Anmelden',
};

export const forgotPasswordForm: AuthFormViewModel = {
  title: 'Passwort zurücksetzen',
  description: 'Wir senden dir einen Link zum Zurücksetzen deines Passworts.',
  submitLabel: 'Link senden',
  secondaryActionLabel: 'Zurück zum Login',
};

export const googleAuth: SocialAuthProviderViewModel = {
  provider: 'google',
  label: 'Mit Google fortfahren',
  accessibilityLabel: 'Mit Google fortfahren',
};

export const appleAuth: SocialAuthProviderViewModel = {
  provider: 'apple',
  label: 'Mit Apple fortfahren',
  accessibilityLabel: 'Mit Apple fortfahren',
};

export const registrationTerms: TermsAgreementViewModel = {
  acceptTerms: true,
  acceptPrivacy: false,
  acceptMarketing: false,
  termsLabel: 'Ich akzeptiere die Allgemeinen Geschäftsbedingungen.',
  privacyLabel: 'Ich akzeptiere die Datenschutzerklärung.',
  marketingLabel: 'Ich möchte Updates zu Events und Deals erhalten.',
};

export const emailSentVerification: VerificationStateViewModel = {
  state: 'email_sent',
  title: 'E-Mail gesendet',
  description: 'Wir haben dir einen Bestätigungslink geschickt. Öffne dein Postfach, um deinen Account zu aktivieren.',
  emailLabel: 'ravesberlin@example.com',
  accessibilityLabel: 'E-Mail-Verifizierung gesendet',
};

export const pendingVerification: VerificationStateViewModel = {
  state: 'pending',
  title: 'Verifizierung ausstehend',
  description: 'Bestätige deine E-Mail-Adresse, um fortzufahren.',
  accessibilityLabel: 'Verifizierung ausstehend',
};

export const expiredVerification: VerificationStateViewModel = {
  state: 'expired',
  title: 'Link abgelaufen',
  description: 'Der Verifizierungslink ist abgelaufen. Fordere einen neuen Link an.',
  accessibilityLabel: 'Verifizierung abgelaufen',
};

export const onboardingCities = [
  { id: 'berlin', cityLabel: 'Berlin, Germany', selected: true },
  { id: 'koeln', cityLabel: 'Köln, Germany' },
];

export const notificationPreferences: NotificationPreferenceViewModel[] = [
  {
    id: 'event-reminders',
    title: 'Event-Erinnerungen',
    description: 'Erinnerungen zu gespeicherten Events',
    enabled: true,
    icon: 'calendar-outline',
  },
  {
    id: 'ticket-updates',
    title: 'Ticket-Updates',
    description: 'Bestätigungen und Ticketänderungen',
    enabled: true,
    icon: 'ticket-outline',
  },
  {
    id: 'organizer-updates',
    title: 'Organizer-Updates',
    description: 'Neue Events von Veranstaltern, denen du folgst',
    enabled: false,
    icon: 'people-outline',
  },
];
