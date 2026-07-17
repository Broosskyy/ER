export const ONBOARDING_SLIDES = [
  {
    id: 'welcome',
    image: require('../../assets/onboarding/03_Onboarding_01_Welcome.png'),
    showBack: false,
    nextLabel: 'Weiter',
  },
  {
    id: 'discover',
    image: require('../../assets/onboarding/04_Onboarding_02_Discover_Events.png'),
    showBack: true,
    nextLabel: 'Weiter',
  },
  {
    id: 'community',
    image: require('../../assets/onboarding/05_Onboarding_03_Community.png'),
    showBack: true,
    nextLabel: 'Weiter',
  },
  {
    id: 'tickets',
    image: require('../../assets/onboarding/06_Onboarding_04_Tickets.png'),
    showBack: true,
    nextLabel: "Los geht's",
  },
] as const;
