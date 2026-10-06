import AsyncStorage from '@react-native-async-storage/async-storage';

export const HOME_RADIUS_STORAGE_KEY = 'app.homeLocation.radiusKm';

export const HOME_RADIUS_OPTIONS = [25, 50, 100] as const;
export type HomeRadiusKm = (typeof HOME_RADIUS_OPTIONS)[number];
export const DEFAULT_HOME_RADIUS_KM: HomeRadiusKm = 50;

function isHomeRadiusKm(value: number): value is HomeRadiusKm {
  return HOME_RADIUS_OPTIONS.includes(value as HomeRadiusKm);
}

export async function loadHomeRadiusKm(): Promise<HomeRadiusKm> {
  try {
    const raw = await AsyncStorage.getItem(HOME_RADIUS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_HOME_RADIUS_KM;
    }

    const parsed = Number(raw);
    return isHomeRadiusKm(parsed) ? parsed : DEFAULT_HOME_RADIUS_KM;
  } catch {
    return DEFAULT_HOME_RADIUS_KM;
  }
}

export async function saveHomeRadiusKm(radiusKm: HomeRadiusKm): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_RADIUS_STORAGE_KEY, String(radiusKm));
  } catch {
    // Best-effort persistence.
  }
}
