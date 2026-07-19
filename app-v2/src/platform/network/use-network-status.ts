import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface NetworkStatus {
  isOnline: boolean;
  isSupported: boolean;
}

function readNetworkStatus(): NetworkStatus {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return { isOnline: true, isSupported: false };
  }

  return {
    isOnline: navigator.onLine,
    isSupported: true,
  };
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => readNetworkStatus());

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => setStatus({ isOnline: true, isSupported: true });
    const handleOffline = () => setStatus({ isOnline: false, isSupported: true });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
