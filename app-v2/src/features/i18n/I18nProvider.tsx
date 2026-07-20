import { ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { initI18n, i18n } from '@/features/i18n/i18n';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void initI18n()
      .catch(() => {
        // Fallback initialization is handled by i18next fallbackLng.
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return null;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
