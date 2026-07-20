import { describe, expect, it } from 'vitest';

import { de } from '@/features/i18n/locales/de';
import { en } from '@/features/i18n/locales/en';
import {
  getMissingRequiredKeys,
  getTranslationLeafPaths,
  REQUIRED_TRANSLATION_KEYS,
} from '@/features/i18n/resources';

describe('translation resources', () => {
  it('contains the same required keys in de and en', () => {
    expect(getMissingRequiredKeys('de')).toEqual([]);
    expect(getMissingRequiredKeys('en')).toEqual([]);
  });

  it('does not contain empty values for migrated keys', () => {
    for (const key of REQUIRED_TRANSLATION_KEYS) {
      const dePath = key.split('.');
      const enPath = key.split('.');

      let deValue: unknown = de;
      let enValue: unknown = en;

      for (const segment of dePath) {
        deValue = (deValue as Record<string, unknown>)[segment];
        enValue = (enValue as Record<string, unknown>)[segment];
      }

      expect(deValue).toBeTruthy();
      expect(enValue).toBeTruthy();
    }
  });

  it('keeps de and en leaf counts aligned', () => {
    expect(getTranslationLeafPaths('de').length).toBe(getTranslationLeafPaths('en').length);
  });
});
