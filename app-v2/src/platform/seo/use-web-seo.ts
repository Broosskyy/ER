import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { PageSeoInput } from '@/platform/seo/seo-config';
import { applyJsonLd, applyPageSeo, clearJsonLd } from '@/platform/seo/seo-meta';

export interface WebSeoOptions extends PageSeoInput {
  jsonLd?: Record<string, unknown> | null;
  jsonLdId?: string;
}

export function useWebSeo(options: WebSeoOptions): void {
  const { jsonLd, jsonLdId = 'page-json-ld', ...seo } = options;
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    applyPageSeo(seo);

    if (jsonLd) {
      applyJsonLd(jsonLdId, jsonLd);
    } else {
      clearJsonLd(jsonLdId);
    }

    return () => {
      clearJsonLd(jsonLdId);
    };
    // jsonLd compared via serialized key; seo fields listed explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable SEO field deps
  }, [
    seo.title,
    seo.description,
    seo.path,
    seo.imagePath,
    seo.noindex,
    seo.ogType,
    jsonLdKey,
    jsonLdId,
  ]);
}
