/** Mockup-derived placeholder imagery — no gray placeholders in consumer UI */
export const PlaceholderAssets = {
  hero: require('../../assets/onboarding/04_Onboarding_02_Discover_Events.png'),
  club: require('../../assets/onboarding/05_Onboarding_03_Community.png'),
  eventA: require('../../assets/onboarding/03_Onboarding_01_Welcome.png'),
  eventB: require('../../assets/onboarding/06_Onboarding_04_Tickets.png'),
  eventC: require('../../assets/onboarding/09_Home.png'),
  banner: require('../../assets/onboarding/04_Onboarding_02_Discover_Events.png'),
  logo: require('../../assets/onboarding/02_Splash_Logo.png'),
} as const;

export const PLACEHOLDER_EVENT_IMAGES = [
  PlaceholderAssets.eventA,
  PlaceholderAssets.eventB,
  PlaceholderAssets.hero,
  PlaceholderAssets.eventC,
  PlaceholderAssets.club,
];

export const PLACEHOLDER_CLUB_IMAGES = [
  PlaceholderAssets.club,
  PlaceholderAssets.hero,
  PlaceholderAssets.eventB,
  PlaceholderAssets.eventA,
];
