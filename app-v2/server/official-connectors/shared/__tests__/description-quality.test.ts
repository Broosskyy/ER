import { describe, expect, it } from 'vitest';

import {
  extractEditorialDescription,
  isInvalidPrimaryDescription,
  preferDescription,
} from '../description-quality';

describe('description quality classifier', () => {
  it('rejects ticket.io admission/legal boilerplate as primary description', () => {
    const boilerplate =
      'Age for Admission 18 years / Einlass ab 18 Jahren! All sales are final / Jeder Kauf ist endgültig No refund by artist cancellation / Kein Umtausch bei Artist Absage';
    expect(isInvalidPrimaryDescription(boilerplate)).toBe(true);
    expect(extractEditorialDescription(boilerplate)).toBeUndefined();
  });

  it('removes raw inline URLs from primary editorial copy', () => {
    const raw =
      'Das vollständige Line-up findet ihr auf Instagram https://www.instagram.com/example/ und weitere Infos unter https://linktr.ee/example. Danach geht die Party weiter.';
    const clean = extractEditorialDescription(raw);
    expect(clean).toBeDefined();
    expect(clean).not.toMatch(/https?:\/\//);
    expect(clean).not.toContain('linktr.ee');
    expect(clean).toContain('Danach geht die Party weiter.');
  });

  it('prefers official editorial description over ticket boilerplate', () => {
    const official =
      'The High Priestess of Hard Techno is coming to Bootshaus. On December 11th, Sara Landry takes over Bootshaus.';
    const ticket =
      'Age for Admission 18 years / Einlass ab 18 Jahren! All sales are final / Jeder Kauf ist endgültig';
    const preferred = preferDescription(official, ticket);
    expect(preferred.source).toBe('left');
    expect(preferred.value).toContain('Hard Techno');
  });
});
