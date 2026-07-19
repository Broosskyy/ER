import * as SplashScreen from 'expo-splash-screen';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { bootstrapApp, resetAppBootstrap } from '@/core/bootstrap/app-bootstrap';
import { BootstrapGate } from '@/core/bootstrap/BootstrapGate';
import { AppError, getErrorMessage } from '@/core/errors/app-error';

interface RepositoryContextValue {
  ready: boolean;
  error: string | null;
  retry: () => void;
}

const RepositoryContext = createContext<RepositoryContextValue>({
  ready: false,
  error: null,
  retry: () => undefined,
});

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    bootstrapApp()
      .then(() => {
        if (!cancelled) {
          setReady(true);
          void SplashScreen.hideAsync();
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof AppError ? cause.message : getErrorMessage(cause));
          void SplashScreen.hideAsync();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    resetAppBootstrap();
    setReady(false);
    setError(null);
    setAttempt((value) => value + 1);
  };

  return (
    <RepositoryContext.Provider value={{ ready, error, retry }}>
      <BootstrapGate ready={ready} error={error} onRetry={retry}>
        {children}
      </BootstrapGate>
    </RepositoryContext.Provider>
  );
}

export function useRepositoriesReady(): RepositoryContextValue {
  return useContext(RepositoryContext);
}
