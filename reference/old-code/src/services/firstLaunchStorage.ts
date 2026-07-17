import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  onboardingComplete: '@eternal_rave/onboarding_complete',
  welcomeComplete: '@eternal_rave/welcome_complete',
  guestMode: '@eternal_rave/guest_mode',
} as const;

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEYS.onboardingComplete);
  return value === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboardingComplete, 'true');
}

export async function isWelcomeComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEYS.welcomeComplete);
  return value === 'true';
}

export async function setWelcomeComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.welcomeComplete, 'true');
}

export async function isGuestModeActive(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEYS.guestMode);
  return value === 'true';
}

export async function setGuestModeActive(active: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.guestMode, active ? 'true' : 'false');
}

export async function clearGuestMode(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.guestMode);
}

export async function getLaunchRoute(): Promise<'/onboarding' | '/welcome' | '/home'> {
  const onboardingDone = await isOnboardingComplete();
  if (!onboardingDone) return '/onboarding';
  const welcomeDone = await isWelcomeComplete();
  if (!welcomeDone) return '/welcome';
  return '/home';
}
