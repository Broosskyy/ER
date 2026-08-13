import { describe, expect, it } from 'vitest';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import {
  buildCanonicalEventFromVerifiedPublicEvidence,
  type VerifiedOfficialEvidence,
} from '@/features/import/domain/build-canonical-event-from-verified-public-evidence';
import {
  compactLineupArtistIdentityKey,
  dedupeLineupEvidenceEntries,
} from '@/features/import/domain/golden-content-quality-gate';
import { evaluateLineupPublishGate } from '@/features/import/domain/lineup-publish-gate';
import { resolveDescriptionGenrePublish } from '@/features/import/domain/description-genre-publish-resolver';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { extractLineupFromContentBlocks } from '@/features/import/unified-website/lineup-extraction';

const VERIFIED_AT = '2026-08-12T15:14:45.485Z';

const LOONYLAND_DESCRIPTION =
  "Let's go Loony... We're back on the MAINFLOOR.On August 21st, LOONYLAND returns to Bootshaus with LUCA DANTE SPADAFORA, 2 ENGEL & CHARLIE and more.MAINFLOOR:LUCA DANTE SPADAFORA 2 ENGEL & CHARLIEOLIVER MAGENTADJ OLDEJEY AUX PLATINES▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔Einlass ab 18 Jahren / Age for admission 18 yearsBootshaus / Auenweg 173 / 51063 Cologne▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔Bootshaus Mobile App:https://bit.ly/Bootshaus-AppBootshaus Merchandisehttps://snash.com/kollektionen/bootshaus/▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔www.bootshaus.tv";

function buildLoonylandOfficial(): VerifiedOfficialEvidence {
  const record = createBootshausProductionSourceRecord();
  const importSource = mapSourceRecordToImportSource(record);
  return {
    pageUrl: 'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie',
    pageTitle: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
    eventDate: '2026-08-21T22:00:00',
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    description: LOONYLAND_DESCRIPTION,
    lineupContentBlocks: [LOONYLAND_DESCRIPTION],
    verifiedAt: VERIFIED_AT,
  };
}

describe('bootshaus content golden regressions', () => {
  it('parses isolated MAINFLOOR blob with five acts', () => {
    const lineup = extractLineupFromContentBlocks([
      'MAINFLOOR:LUCA DANTE SPADAFORA 2 ENGEL & CHARLIEOLIVER MAGENTADJ OLDEJEY AUX PLATINES',
    ]);
    expect(lineup.entries.map((entry) => entry.displayName)).toEqual([
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);
  });

  it('parses Loonyland MAINFLOOR with five acts and preserves compound billing', () => {
    const lineup = extractLineupFromContentBlocks([LOONYLAND_DESCRIPTION]);
    const deduped = dedupeLineupEvidenceEntries(lineup.entries);
    const names = deduped.map((entry) => entry.displayName);

    expect(names).toEqual([
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);
    expect(names.filter((name) => compactLineupArtistIdentityKey(name) === 'lucadantespadafora').length).toBe(1);
    expect(names).not.toContain('2 ENGEL');
    expect(names).not.toContain('CHARLIE');
  });

  it('builds Loonyland canonical lineup without Luca duplicate', () => {
    const build = buildCanonicalEventFromVerifiedPublicEvidence({
      officialEvidence: buildLoonylandOfficial(),
    });
    const names = build.lineupPatch.entries.map((entry) => entry.displayName);
    expect(names).toEqual([
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);
  });

  it('strips footer and lineup blocks from Loonyland consumer description', () => {
    const desc = resolveDescriptionGenrePublish({
      event: {
        eventId: 'evt-loonyland',
        title: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
        startDate: '2026-08-21T22:00:00',
      },
      officialDescription: LOONYLAND_DESCRIPTION,
      observedAt: VERIFIED_AT,
    });
    expect(desc.descriptionContaminated).toBe(false);
    expect(desc.description).toContain('LOONYLAND returns');
    expect(desc.description).not.toMatch(/\bmain\s*floor\b/i);
    expect(desc.description).not.toMatch(/bit\.ly/i);
    expect(desc.description).not.toMatch(/einlass ab/i);
  });

  it('puts CHRIS STUSSY in lineup from pres.-by title when official evidence confirms', () => {
    const gate = evaluateLineupPublishGate({
      event: {
        eventId: 'evt-chris-stussy',
        title: 'CHRIS STUSSY pres. by BOOTSHAUS',
        startDate: '2026-10-16T22:00:00',
        venueName: 'Bootshaus',
        websiteUrl: 'https://bootshaus.tv/events/16-10-26-chris-stussy-pres-by-bootshaus',
      },
      contentBlocks: ['Line Up:\n">Line-Up\n\nGenres'],
      identityEvidence: {
        evidence: {
          pageTitle: 'CHRIS STUSSY pres. by BOOTSHAUS',
          eventDate: '2026-10-16T22:00:00',
          venueName: 'Bootshaus',
        },
        officialEventUrl: 'https://bootshaus.tv/events/16-10-26-chris-stussy-pres-by-bootshaus',
        verifiedAt: VERIFIED_AT,
      },
    });

    expect(gate.extraction.entries.map((entry) => entry.displayName)).toEqual(['CHRIS STUSSY']);
    expect(gate.reason).toBe('single_headliner_pres_by_title');
  });

  it('marks Affenkäfig as lineup_not_announced without inventing artists', () => {
    const gate = evaluateLineupPublishGate({
      event: {
        eventId: 'evt-affenkaefig',
        title: 'AFFENKÄFIG RULES // BOOTSHAUS KÖLN',
        startDate: '2026-10-23T23:00:00',
        venueName: 'Bootshaus',
      },
      contentBlocks: [
        'Events\nAFFENKÄFIG RULES // BOOTSHAUS KÖLN\n\nLine Up:\nhauen wir euch bald um die Ohren. Sichert euch so lange die vergünstigten Tickets im Shop.',
      ],
      identityEvidence: {
        evidence: {
          pageTitle: 'AFFENKÄFIG RULES // BOOTSHAUS KÖLN',
          eventDate: '2026-10-23T23:00:00',
        },
        verifiedAt: VERIFIED_AT,
      },
    });

    expect(gate.reason).toBe('lineup_not_announced');
    expect(gate.extraction.entries).toHaveLength(0);
  });
});
