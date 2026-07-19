import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { featureFlags } from '@/core/config/feature-flags';
import { AppError, getErrorMessage } from '@/core/errors/app-error';
import { initializeRepositories } from '@/data/repositories/registry';

interface RepositoryContextValue {
  ready: boolean;
  error: string | null;
  retry: () => void;
}

const RepositoryContext = createContext<RepositoryContextValue>({
  ready: !featureFlags.useSupabase,
  error: null,
  retry: () => undefined,
});

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!featureFlags.useSupabase);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (featureFlags.useSupabase) {
      initializeRepositories()
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setError(
              cause instanceof AppError ? cause.message : getErrorMessage(cause),
            );
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (!ready && error) {
    // Supabase mode failed — still render children so app can show error UI if needed
  }

  return (
    <RepositoryContext.Provider
      value={{
        ready,
        error,
        retry: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepositoriesReady(): RepositoryContextValue {
  return useContext(RepositoryContext);
}
