import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import { translateAuthError } from '@/features/i18n/auth-errors';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export type ResendConfirmationStatus = 'idle' | 'loading' | 'success' | 'error';

export function useResendConfirmation(email: string, returnTo?: string) {
  const { t } = useAppTranslation();
  const { resendConfirmationEmail } = useAuth();
  const [status, setStatus] = useState<ResendConfirmationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const resend = useCallback(async () => {
    if (status === 'loading' || email.trim().length === 0) {
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      await resendConfirmationEmail(email.trim(), returnTo);
      setStatus('success');
    } catch (cause) {
      setStatus('error');
      setError(translateAuthError(cause, t));
    }
  }, [email, resendConfirmationEmail, returnTo, status, t]);

  return {
    resend,
    status,
    error,
    loading: status === 'loading',
    succeeded: status === 'success',
  };
}
