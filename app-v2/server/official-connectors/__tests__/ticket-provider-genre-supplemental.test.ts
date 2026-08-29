import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractTicketProviderGenreLabels } from '../ticket-evidence/extract-ticket-provider-genres';
import { parseTicketKingsDetailDom } from '../ticket-evidence/parse-ticket-kings-detail-dom';
import { reconcileVerifiedTicketSupplementalEvidence } from '../ticket-evidence/reconcile-verified-ticket-supplemental';
import type { OfficialEventEvidence } from '../types';

function baseEvidence(): OfficialEventEvidence {
  return {
    connectorId: 'affenkaefig-official',
    sourceEventKey: 'underland',
    listUrl: 'https://affenkaefig.info/events/',
    officialUrl: 'https://affenkaefig.info/event/underland/',
    fetchedAt: '2026-08-29T10:00:00.000Z',
    pageFingerprint: 'fp',
    title: 'Underland',
    startsAt: '2026-09-05T20:00:00.000Z',
    sourceTimezone: 'Europe/Berlin',
    lineupCandidates: [],
    explicitGenreLabels: [],
    enrichmentGaps: ['genres_missing'],
    rejectedCandidates: [],
  };
}

describe('ticket provider genre supplemental evidence', () => {
  it('extracts normalized genres from ticket provider description phrases', () => {
    const labels = extractTicketProviderGenreLabels({
      description:
        'Die Essigfabrik wird zu eurem persönlichen Spielplatz für Hardtechno und Uptempo.',
    });
    expect(labels).toContain('Hard Techno');
    expect(labels).not.toContain('Uptempo');
  });

  it('ignores non-music event categories', () => {
    const labels = extractTicketProviderGenreLabels({
      structuredLabels: ['Club Event', 'Hardtechno'],
    });
    expect(labels).toEqual(['Hard Techno']);
  });

  it('merges verified ticket genres into official evidence', () => {
    const reconciled = reconcileVerifiedTicketSupplementalEvidence(baseEvidence(), {
      identityResult: 'ticket_identity_verified',
      providerEvidence: {
        event: {},
        supplementalContent: {
          genreLabels: ['Hardtechno'],
        },
      },
    } as never);

    expect(reconciled.explicitGenreLabels).toContain('Hard Techno');
    expect(reconciled.enrichmentGaps).not.toContain('genres_missing');
  });

  it('parses underland ticketkings cache for description genres', () => {
    const fixturePath = join(process.cwd(), '.tmp/m9-2-ticketkings-underland.html');
    const body = readFileSync(fixturePath, 'utf8');
    const parsed = parseTicketKingsDetailDom(body, 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/');
    expect(parsed.descriptionClean).toMatch(/UNDERLAND/i);
    expect(parsed.genreLabels).toContain('Hard Techno');
  });
});
