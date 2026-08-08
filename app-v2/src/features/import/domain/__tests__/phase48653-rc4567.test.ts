import { describe, expect, it } from 'vitest';

import {
  evaluatePublishEligibility,
  verifyPublishScope,
} from '@/features/import/publish/unified-website-controlled-publish';
import {
  extractGenresFromTrustedText,
  resolveDescriptionGenrePublish,
  stripAffenkaefigDescriptionNoise,
} from '@/features/import/domain/description-genre-publish-resolver';
import {
  descriptionConfirmsArtistPerformance,
  evaluateLineupPublishGate,
} from '@/features/import/domain/lineup-publish-gate';
import {
  assessTicketEvidencePersistence,
  buildTicketEvidenceProvenanceRecords,
} from '@/features/import/domain/ticket-evidence-provenance';
import { extractLineupFromContentBlocks } from '@/features/import/unified-website/lineup-extraction';
import { localizeConsumerTicketPhaseLabel } from '@/features/events/formatting/ticket-phase-consumer-bridge';
import type { CanonicalTicketWriteAudit } from '@/features/events/domain/canonical-ticket-writer';

const FIXTURE_SOURCE_BOOTSHAUS = 'source-bootshaus-koeln';

describe('RC-4 generic publish scope', () => {
  it('requires configured event allowlist for rollout scope', () => {
    const empty = verifyPublishScope({
      sourceId: FIXTURE_SOURCE_BOOTSHAUS,
      eventId: 'evt-any',
      config: { enabled: true, eventIds: [] },
    });
    expect(empty.ok).toBe(false);
    expect(empty.issues).toContain('publish_event_allowlist_empty');

    const scoped = verifyPublishScope({
      sourceId: FIXTURE_SOURCE_BOOTSHAUS,
      eventId: 'evt-in-scope',
      config: {
        enabled: true,
        sourceIds: [FIXTURE_SOURCE_BOOTSHAUS],
        eventIds: ['evt-in-scope'],
      },
    });
    expect(scoped.ok).toBe(true);
  });

  it('separates eligibility from rollout scope', () => {
    const eligibility = evaluatePublishEligibility({
      sourceId: FIXTURE_SOURCE_BOOTSHAUS,
      eventId: 'evt-out-of-scope',
      config: { sourceIds: [FIXTURE_SOURCE_BOOTSHAUS] },
    });
    expect(eligibility.eligible).toBe(true);

    const scope = verifyPublishScope({
      sourceId: FIXTURE_SOURCE_BOOTSHAUS,
      eventId: 'evt-out-of-scope',
      config: {
        enabled: true,
        sourceIds: [FIXTURE_SOURCE_BOOTSHAUS],
        eventIds: ['evt-other'],
      },
    });
    expect(scope.ok).toBe(false);
  });
});

describe('RC-5 description and genres', () => {
  it('preserves Underland description and extracts Hardtechno/Uptempo', () => {
    const body =
      'Underland returns to Essigfabrik with a night of Hardtechno and Uptempo.\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\nBootshaus Mobile App';
    const stripped = stripAffenkaefigDescriptionNoise(body);
    expect(stripped.cleaned).toContain('Hardtechno');
    const genres = extractGenresFromTrustedText(stripped.cleaned!, '2026-08-06T10:00:00.000Z');
    expect(genres?.genres).toEqual(expect.arrayContaining(['Hard Techno']));
  });

  it('does not invent MDMA description or genre without trusted evidence', () => {
    const result = resolveDescriptionGenrePublish({
      event: {
        eventId: 'evt-mdma',
        title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
        startDate: '2026-10-10T20:00:00.000Z',
      },
      ticketPlatformDescription: 'CHROME COLOGNE night at Bootshaus',
      ticketEvidence: {
        pageTitle: 'CHROME COLOGNE',
        eventDate: '2026-10-10T20:00:00.000Z',
      },
    });
    expect(result.description).toBeUndefined();
    expect(result.genreLabels).toBeUndefined();
    expect(result.blockedReason).toContain('ticket_platform_description_blocked');
  });

  it('keeps LEVI HOUSE from official source tags', () => {
    const result = resolveDescriptionGenrePublish({
      event: {
        eventId: 'evt-levi',
        title: 'LEVI – Live at Bootshaus',
        startDate: '2026-09-05T20:00:00.000Z',
      },
      officialDescription: 'LEVI brings House to the mainfloor.',
      ticketPlatformGenres: ['Club Event', 'House'],
    });
    expect(result.genreLabels).toEqual(['House']);
    expect(result.description).toContain('LEVI');
  });

  it('rejects navigation boilerplate genres', () => {
    const genres = extractGenresFromTrustedText('Zum Inhalt springen Club Event Open-Air Event', '2026-08-06T10:00:00.000Z');
    expect(genres).toBeUndefined();
  });
});

describe('RC-6 lineup', () => {
  it('parses BC173 artists and stops before Public Transport Info', () => {
    const blocks = [
      'Lineup',
      'FAST BOY',
      'DHALI',
      'LIONKAY',
      'ONINE',
      'Public Transport Info',
      'Take the tram to Cologne Süd',
    ];
    const extraction = extractLineupFromContentBlocks(blocks);
    expect(extraction.entries.map((entry) => entry.displayName)).toEqual([
      'FAST BOY',
      'DHALI',
      'LIONKAY',
      'ONINE',
    ]);
  });

  it('parses BC173 lineup from a single multiline description block', () => {
    const extraction = extractLineupFromContentBlocks([
      "LET'S GET LOCO!\n\nLINEUP:\n\nFAST BOY\n\nDHALI\n\nLIONKAY\n\nONINE\n\nPublic Transport Info:\n\nTickets included",
    ]);
    expect(extraction.entries.map((entry) => entry.displayName)).toEqual([
      'FAST BOY',
      'DHALI',
      'LIONKAY',
      'ONINE',
    ]);
  });

  it('allows LEVI headliner with corroborated identity evidence bundle', () => {
    const gate = evaluateLineupPublishGate({
      event: {
        eventId: 'evt-levi',
        title: 'NIGHTSWITHUS presents LEVI',
        startDate: '2026-08-07T20:00:00.000Z',
        venueName: 'Bootshaus',
        websiteUrl: 'https://bootshaus.tv/events/nightswithus-presents-levi',
      },
      contentBlocks: [
        'NIGHTSWITHUS returns with another unforgettable night with LEVI!',
      ],
      identityEvidence: {
        evidence: {
          pageTitle: 'NIGHTSWITHUS presents LEVI | Bootshaus Club',
          listRowTitle: 'LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne',
          eventDate: '2026-08-07T20:00:00+02:00',
          venueName: 'Bootshaus',
        },
        officialEventUrl: 'https://bootshaus.tv/events/nightswithus-presents-levi',
        officialPage: {
          officialPageUrl: 'https://bootshaus.tv/events/nightswithus-presents-levi',
          pageTitle: 'NIGHTSWITHUS presents LEVI | Bootshaus Club',
          outboundTicketUrls: ['https://bootshaus-tickets.ticket.io/YvJnLSXd/'],
        },
        officialOutboundTicketUrls: ['https://bootshaus-tickets.ticket.io/YvJnLSXd/'],
        evidenceUrl: 'https://bootshaus-club.ticket.io/YvJnLSXd/',
        verifiedAt: '2026-08-07T21:56:59.440Z',
      },
    });
    expect(gate.allowed).toBe(true);
    expect(gate.headlinerOnly).toBe('LEVI');
    expect(gate.extraction.entries.map((entry) => entry.displayName)).toEqual(['LEVI']);
  });

  it('allows R3HAB as single headliner with corroborated identity evidence', () => {
    const gate = evaluateLineupPublishGate({
      event: {
        eventId: 'evt-r3hab',
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T20:00:00.000Z',
        venueName: 'Bootshaus',
        websiteUrl: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
      },
      contentBlocks: ['On September 4th, BOOTSHAUS presents R3HAB on the MAINFLOOR.'],
      identityEvidence: {
        evidence: {
          pageTitle: 'R3HAB pres. by BOOTSHAUS | Bootshaus Club',
          listRowTitle: 'R3HAB pres. by BOOTSHAUS',
          eventDate: '2026-09-04T22:00:00+02:00',
          venueName: 'Bootshaus',
        },
        officialEventUrl: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
        officialPage: {
          officialPageUrl: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
          pageTitle: 'R3HAB pres. by BOOTSHAUS | Bootshaus Club',
          outboundTicketUrls: ['https://bootshaus-club.ticket.io/C7JPnatZ/'],
        },
        officialOutboundTicketUrls: ['https://bootshaus-club.ticket.io/C7JPnatZ/'],
        evidenceUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        verifiedAt: '2026-08-07T21:56:59.440Z',
      },
    });
    expect(gate.allowed).toBe(true);
    expect(gate.extraction.entries.map((entry) => entry.displayName)).toEqual(['R3HAB']);
  });

  it('treats Lineup TBA as confirmed empty lineup without artists', () => {
    const gate = evaluateLineupPublishGate({
      event: {
        eventId: 'evt-sommerfest',
        title: 'Bootshaus Sommerfest',
        startDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Bootshaus',
        websiteUrl: 'https://bootshaus.tv/events/bootshaus-sommerfest',
      },
      contentBlocks: ['Electro/EDM vs. Deep/TechHouse vs. Techno vs. DnB/Trap/Dubstep Lineup TBA'],
      identityEvidence: {
        evidence: {
          pageTitle: 'Bootshaus Sommerfest | Bootshaus Club',
          listRowTitle: 'Bootshaus Sommerfest',
          eventDate: '2026-09-05T22:00:00+02:00',
          venueName: 'Bootshaus',
        },
        officialEventUrl: 'https://bootshaus.tv/events/bootshaus-sommerfest',
        officialPage: {
          officialPageUrl: 'https://bootshaus.tv/events/bootshaus-sommerfest',
          pageTitle: 'Bootshaus Sommerfest | Bootshaus Club',
          outboundTicketUrls: ['https://bootshaus-club.ticket.io/vB0cAmWg/'],
        },
        officialOutboundTicketUrls: ['https://bootshaus-club.ticket.io/vB0cAmWg/'],
        evidenceUrl: 'https://bootshaus-club.ticket.io/vB0cAmWg/',
        verifiedAt: '2026-08-07T21:56:59.440Z',
      },
    });
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBe('lineup_tba_confirmed');
    expect(gate.extraction.entries).toHaveLength(0);
  });

  it('blocks single headliner when description does not confirm performance', () => {
    const gate = evaluateLineupPublishGate({
      event: {
        eventId: 'evt-levi',
        title: 'NIGHTSWITHUS presents LEVI',
        startDate: '2026-08-07T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      contentBlocks: ['Secure your tickets now!'],
      identityEvidence: {
        evidence: {
          pageTitle: 'NIGHTSWITHUS presents LEVI | Bootshaus Club',
          eventDate: '2026-08-07T20:00:00+02:00',
          venueName: 'Bootshaus',
        },
        officialPage: {
          pageTitle: 'NIGHTSWITHUS presents LEVI | Bootshaus Club',
          outboundTicketUrls: ['https://bootshaus-tickets.ticket.io/YvJnLSXd/'],
        },
        officialOutboundTicketUrls: ['https://bootshaus-tickets.ticket.io/YvJnLSXd/'],
        verifiedAt: '2026-08-07T21:56:59.440Z',
      },
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('single_headliner_blocked_description_not_confirmed');
  });

  it('never treats transport prose as artists', () => {
    expect(descriptionConfirmsArtistPerformance('Public Transport Info tickets included', 'Public')).toBe(
      false,
    );
    const extraction = extractLineupFromContentBlocks([
      'LINEUP:\nFAST BOY\nPublic Transport Info:\nTake the tram',
    ]);
    expect(extraction.entries.map((entry) => entry.displayName)).toEqual(['FAST BOY']);
  });

  it('blocks lineup when identity fails', () => {
    const gate = evaluateLineupPublishGate({
      event: {
        eventId: 'evt-mdma',
        title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
        startDate: '2026-10-10T20:00:00.000Z',
      },
      contentBlocks: ['CHROME'],
      pageEvidence: {
        pageTitle: 'CHROME COLOGNE',
        eventDate: '2026-10-10T20:00:00.000Z',
      },
      contaminationDetected: true,
    });
    expect(gate.allowed).toBe(false);
  });
});

describe('RC-7 consumer labels', () => {
  it('localizes generic admission labels while preserving raw provenance label', () => {
    expect(localizeConsumerTicketPhaseLabel('Admission')).toEqual({
      displayName: 'Ticket',
      rawLabel: 'Admission',
    });
    expect(localizeConsumerTicketPhaseLabel('E-Ticket — Early Bird')).toEqual({
      displayName: 'E-Ticket — Early Bird',
      rawLabel: 'E-Ticket — Early Bird',
    });
  });
});

describe('RC-F checkout evidence persistence', () => {
  it('can persist via field provenance and source reference metadata without migration', () => {
    const assessment = assessTicketEvidencePersistence();
    expect(assessment.persistenceGap).toBe(false);
    expect(assessment.canPersistWithoutMigration).toBe(true);

    const audit: CanonicalTicketWriteAudit = {
      identityVerdict: 'exact',
      identityReason: 'title_date_venue_compatible',
      freshnessDecision: 'incoming_verified_at_is_newer',
      freshnessFallbackRule: 'incoming_newer_verified',
      checkoutEvidenceUrl: 'https://nacht-manager.de/ticketing/native_event.php?id=24',
      publicCtaCandidateUrl: 'https://ticketkings.de/event/sample/',
      blockedCriticalFields: [],
      diagnostics: [],
    };

    const records = buildTicketEvidenceProvenanceRecords({
      canonicalEventId: 'evt-1',
      sourceId: 'source-ticket-kings',
      audit,
      verifiedAt: '2026-08-06T10:00:00.000Z',
    });
    expect(records.some((record) => record.fieldPath === 'ticketEvidence.checkoutUrl')).toBe(true);
    expect(records.some((record) => record.fieldPath === 'ticketEvidence.sourceSnapshot')).toBe(true);
  });
});
