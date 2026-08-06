import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import {
  approvedWriteProposals,
  buildDefaultUnifiedWebsitePublishFlagSnapshot,
  buildPublishPreview,
  evaluatePublishEligibility,
  isForbiddenPublishField,
  planPublishMutations,
  verifyPublishScope,
} from '@/features/import/publish/unified-website-controlled-publish';
import {
  buildImportContextForIntegratedShadow,
  runUnifiedWebsiteImport,
} from '@/features/import/unified-website';

const FIXTURE_BOOTSHAUS_SOURCE = 'source-bootshaus-koeln';
const FIXTURE_R3HAB_EVENT_ID = 'evt-1785339421539-k3swcrl';
const FIXTURE_SOMMERFEST_EVENT_ID = 'evt-1785339391167-tfaixrr';

const R3HAB_URL = 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus';
const SOMMERFEST_URL = 'https://bootshaus.tv/events/bootshaus-sommerfest';

function loadFixture(file: string): string {
  return readFileSync(join(process.cwd(), 'docs/real-data/_phase4823_live_evidence', file), 'utf8');
}

function baseEvent(overrides: Partial<AdminEventRecord>): AdminEventRecord {
  return {
    id: FIXTURE_R3HAB_EVENT_ID,
    title: 'R3HAB pres. by BOOTSHAUS',
    status: 'published',
    sourceId: FIXTURE_BOOTSHAUS_SOURCE,
    websiteUrl: R3HAB_URL,
    description:
      'On August 7th, BOOTSHAUS presents R3HAB on the MAINFLOOR.A special night with one of electronic music&rsquo;s most established names.MAINFLOOR:R3HAB',
    ticketUrl: 'https://bit.ly/Bootshaus-AppBootshaus',
    venueName: 'Bootshaus',
    ...overrides,
  } as AdminEventRecord;
}

describe('phase486 publish flags', () => {
  it('defaults to disabled with empty allowlists and dry-run true', () => {
    const snapshot = buildDefaultUnifiedWebsitePublishFlagSnapshot();
    expect(snapshot.unifiedWebsitePublishEnabled).toBe(false);
    expect(snapshot.unifiedWebsitePublishDryRun).toBe(true);
    expect(snapshot.defaultsSafe).toBe(true);
    expect(snapshot.shadowFlagsSeparate).toBe(true);
  });
});

describe('phase486 publish scope', () => {
  it('rejects events outside configured rollout allowlist', () => {
    const result = verifyPublishScope({
      sourceId: FIXTURE_BOOTSHAUS_SOURCE,
      eventId: 'evt-out-of-rollout-scope',
      config: {
        enabled: true,
        sourceIds: [FIXTURE_BOOTSHAUS_SOURCE],
        eventIds: [FIXTURE_R3HAB_EVENT_ID],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.includes('not in publish event allowlist'))).toBe(true);
  });

  it('accepts bootshaus pass-1 events when configured', () => {
    const result = verifyPublishScope({
      sourceId: FIXTURE_BOOTSHAUS_SOURCE,
      eventId: FIXTURE_R3HAB_EVENT_ID,
      config: {
        enabled: true,
        sourceIds: [FIXTURE_BOOTSHAUS_SOURCE],
        eventIds: [FIXTURE_R3HAB_EVENT_ID, FIXTURE_SOMMERFEST_EVENT_ID],
      },
    });
    expect(result.ok).toBe(true);
  });
});

describe('phase486 field scope', () => {
  it('forbids ticket price and venue writes', () => {
    expect(isForbiddenPublishField('priceText')).toBe(true);
    expect(isForbiddenPublishField('venueName')).toBe(true);
    expect(isForbiddenPublishField('title')).toBe(false);
  });
});

describe('phase486 downgrade prevention preview', () => {
  it('proposes substantive R3HAB corrections', () => {
    const unified = runUnifiedWebsiteImport({
      context: buildImportContextForIntegratedShadow({
        sourceId: FIXTURE_BOOTSHAUS_SOURCE,
        sourceName: 'Bootshaus Köln',
        eventId: FIXTURE_R3HAB_EVENT_ID,
        websiteUrl: R3HAB_URL,
      }),
      html: loadFixture('live-official-website-98.html'),
      fetchMeta: { status: 200, finalUrl: R3HAB_URL },
    });

    const proposals = buildPublishPreview({
      event: baseEvent({}),
      unified,
      provenanceByField: {},
      sourceId: FIXTURE_BOOTSHAUS_SOURCE,
    });

    const approved = approvedWriteProposals(proposals);
    const fields = approved.map((p) => p.field);
    expect(fields).toContain('description');
    expect(fields).toContain('ticketUrl');
    expect(fields).toContain('lineup');
    expect(fields).not.toContain('priceText' as never);
  });

  it('proposes zero or minimal Sommerfest writes when already correct', () => {
    const unified = runUnifiedWebsiteImport({
      context: buildImportContextForIntegratedShadow({
        sourceId: FIXTURE_BOOTSHAUS_SOURCE,
        sourceName: 'Bootshaus Köln',
        eventId: FIXTURE_SOMMERFEST_EVENT_ID,
        websiteUrl: SOMMERFEST_URL,
      }),
      html: loadFixture('live-official-website-80.html'),
      fetchMeta: { status: 200, finalUrl: SOMMERFEST_URL },
    });

    const proposals = buildPublishPreview({
      event: baseEvent({
        id: FIXTURE_SOMMERFEST_EVENT_ID,
        title: 'Bootshaus Sommerfest',
        websiteUrl: SOMMERFEST_URL,
        description: 'Electro/EDM vs. Deep/TechHouse vs. Techno vs. DnB/Trap/Dubstep Lineup TBA',
        ticketUrl: 'https://bootshaus-club.ticket.io/vB0cAmWg/',
        venueName: 'Essigfabrik',
        priceText: 'Tickets ab 11,90 Euro',
      }),
      unified,
      provenanceByField: {},
      sourceId: FIXTURE_BOOTSHAUS_SOURCE,
    });

    const { mutations } = planPublishMutations(proposals);
    const forbidden = mutations.filter((m) => m.field === ('venueName' as never));
    expect(forbidden).toHaveLength(0);
    expect(mutations.filter((m) => m.field === 'lineup')).toHaveLength(0);
  });
});
