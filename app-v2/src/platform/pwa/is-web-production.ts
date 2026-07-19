import { Platform } from 'react-native';

export function isWebProductionBuild(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}
