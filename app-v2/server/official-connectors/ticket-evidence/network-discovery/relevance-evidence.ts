import type { ElectronicRelevance } from './types';
import type { DetailAccessStatus } from './detail-types';

export type LineupDomainBoost = 'HIGH' | 'LIKELY' | 'NONE';

export interface RelevanceEvidenceInput {
  title: string;
  description?: string;
  genreHints?: string[];
  lineupHints?: string[];
  venueName?: string;
  organizerName?: string;
  detailAccess?: DetailAccessStatus;
  lineupDomainBoost?: LineupDomainBoost;
  lineupElectronicArtistCount?: number;
}

export interface RelevanceEvidenceResult {
  relevance: ElectronicRelevance;
  reasons: string[];
  ambiguityReason?: string;
  strongPositiveHits: string[];
  weakPositiveHits: string[];
  negativeHits: string[];
}

const STRONG_POSITIVE: Array<{ id: string; pattern: RegExp; rejectWindow?: RegExp }> = [
  { id: 'techno', pattern: /\btechno\b/i },
  { id: 'hard_techno', pattern: /\bhard\s*techno\b/i },
  {
    id: 'house',
    pattern: /\bhouse\b/i,
    // "House" is a highly ambiguous English noun and frequently appears in
    // non-music entities such as Penguin Random House or "House of ...".
    rejectWindow: /\b(?:random|publishing|book|chocolate)\s+house\b|\bhouse\s+of\b/i,
  },
  { id: 'deep_house', pattern: /\bdeep\s*house\b/i },
  { id: 'tech_house', pattern: /\btech\s*house\b/i },
  { id: 'melodic_techno', pattern: /\bmelodic\s*techno\b/i },
  { id: 'trance', pattern: /\btrance\b/i },
  { id: 'psytrance', pattern: /\bpsytrance\b/i },
  { id: 'edm', pattern: /\bedm\b/i },
  { id: 'hardstyle', pattern: /\bhardstyle\b/i },
  { id: 'gabber', pattern: /\bgabber\b/i },
  { id: 'dnb', pattern: /\bdrum\s*(?:&|and|n)?\s*bass\b/i },
  { id: 'dnb_short', pattern: /\bdnb\b/i },
  { id: 'jungle', pattern: /\bjungle\b/i },
  {
    id: 'electro',
    pattern: /\belectro(?:nic)?\b/i,
    // Electro-acoustic / elektroakustisch is not equivalent to the club genre Electro.
    rejectWindow: /\belectro(?:nic)?[\s-]?acoustic\b|\belektroakust/i,
  },
  { id: 'rave', pattern: /\brave\b/i },
  { id: 'dj_set', pattern: /\bdj[\s-]?set\b/i },
  { id: 'hard_techno_abbrev', pattern: /\bhard[\s-]?techno\b/i },
];

const WEAK_POSITIVE: Array<{ id: string; pattern: RegExp }> = [
  // "hardcore" is cross-domain (hard dance vs. punk/post-hardcore). It needs corroboration.
  { id: 'hardcore', pattern: /\bhardcore\b/i },
  // A generic club night is not sufficient proof of electronic music by itself.
  { id: 'club_night', pattern: /\bclub\s*night\b/i },
  { id: 'festival', pattern: /\bfestival\b/i },
  { id: 'open_air', pattern: /\bopen\s*air\b/i },
  { id: 'club', pattern: /\bclub\b/i },
  { id: 'night', pattern: /\bnight\b/i },
  { id: 'all_night_long', pattern: /\ball\s*night\s*long\b/i },
  { id: 'live', pattern: /\blive\b/i },
  { id: 'dj', pattern: /\bdj\b/i },
  { id: 'b2b', pattern: /\bb2b\b/i },
  { id: 'warehouse', pattern: /\bwarehouse\b/i },
  { id: 'underground', pattern: /\bunderground\b/i },
  { id: 'mainfloor', pattern: /\bmainfloor\b/i },
  { id: 'minimal', pattern: /\bminimal\b/i },
  { id: 'industrial', pattern: /\bindustrial\b/i },
  { id: 'schranz', pattern: /\bschranz\b/i },
];

const ELECTRONIC_VENUE_HINTS = [
  'bootshaus',
  'affenkaefig',
  'affenkäfig',
  'kitkat',
  'unreal',
  'nibirii',
  'zaagstep',
  'underland',
  'gewölbe',
  'gewoelbe',
  'glow',
];

const STRONG_NEGATIVE: Array<{ id: string; pattern: RegExp; ambiguous?: boolean }> = [
  { id: 'comedy', pattern: /\b(?:comedy|kabarett|stand[\s-]?up)\b/i },
  { id: 'theatre', pattern: /\b(?:theater|theatre|musical)\b/i },
  { id: 'opera', pattern: /\b(?:opera|oper(?:n|ette)?)\b/i },
  { id: 'classical', pattern: /\b(?:klassik|classical|symphon(?:y|ie)|orchestra)\b/i },
  { id: 'sport', pattern: /\b(?:sport|fußball|football|marathon|triathlon)\b/i },
  { id: 'family', pattern: /\b(?:kinder|family|familie|kindertheater)\b/i },
  { id: 'business', pattern: /\b(?:business|conference|messe|seminar)\b/i },
  { id: 'circus', pattern: /\b(?:weihnachtsmarkt|christmas market|circus)\b/i },
  { id: 'flea_market', pattern: /\b(?:flohmarkt|flea\s*market|vintage\s*markt)\b/i },
  { id: 'market_seller', pattern: /\b(?:verk[aä]ufer\s+werden|stand\s+mieten|aussteller\s+werden)\b/i },
  { id: 'workshop', pattern: /\b(?:workshop|kurs|seminar|song[\s-]?writing|songwriting)\b/i },
  { id: 'exhibition', pattern: /\b(?:ausstellung|exhibition|vernissage|galerie)\b/i },
  { id: 'food', pattern: /\b(?:food\s*festival|street\s*food|kulinarisch|brunch|dinner\s*show)\b/i },
  { id: 'film', pattern: /\b(?:kino|filmvorführung|film\s*screening|movie\s*night)\b/i },
  { id: 'liveshow', pattern: /\b(?:liveshow|live\s*show|band\s*contest|sprungbrett)\b/i, ambiguous: true },
  { id: 'rock_pop', pattern: /\b(?:rock\s*concert|pop\s*concert|singer[-\s]?songwriter|indie\s*rock)\b/i },
  { id: 'punk_metal_hardcore', pattern: /\b(?:punk|post[\s-]?hardcore|metal(?:core)?|hardcore[\s-]?punk|screamo|noise[\s-]?rock|emo)\b/i },
  { id: 'hip_hop_rap', pattern: /\b(?:hip[\s-]?hop|rap(?:per|music)?)\b/i },
  { id: 'k_pop', pattern: /\bk[\s-]?pop\b/i },
  { id: 'spoken_word', pattern: /\b(?:spoken\s*word|literatur|reading|vortrag|lesung)\b/i },
  {
    id: 'books_literature',
    pattern: /\b(?:buchhandlung|buchhandlungen|buchtipp|buchtipps|buecher|bücher|krimi(?:s)?|thriller|autorin|autor|literaturkritik)\b/i,
  },
  {
    id: 'culinary_food',
    pattern: /\b(?:chocolate|schokolade|schokoladen|food|kulinarik|kulinarisch|tasting)\b/i,
  },
  {
    id: 'performance_art',
    pattern: /\b(?:konzert[-\s]?performance|lecture\s+performance|performance\s+art|installative\s+ausstellung|künstlerische\s+forschung|kuenstlerische\s+forschung)\b/i,
  },
  { id: 'jazz', pattern: /\bjazz\b/i, ambiguous: false },
  { id: 'improvisation', pattern: /\bimprovisation\b/i, ambiguous: true },
  { id: 'new_music', pattern: /\bneuer\s+musik\b/i, ambiguous: true },
  {
    id: 'electro_acoustic',
    pattern: /\belectro(?:nic)?[\s-]?acoustic\b|\belektroakust/i,
    ambiguous: true,
  },
  { id: 'acoustic', pattern: /\b(?:akustisch|acoustic)\b/i, ambiguous: true },
  { id: 'cultural_performance', pattern: /\b(?:tanztheater|performancekunst|kabarett)\b/i },
  { id: 'general_market', pattern: /\b(?:wochenmarkt|bauernmarkt|street\s*market)\b/i },
];

const EXPERIMENTAL_ELECTRONIC_POSITIVE = [
  /\bexperimental\s+electronic\b/i,
  /\belectronic\s+improvisation\b/i,
  /\blive\s+electronic\b/i,
];

function collectMatches(
  corpus: string,
  entries: Array<{ id: string; pattern: RegExp; rejectWindow?: RegExp }>,
): string[] {
  return entries
    .filter((entry) => {
      entry.pattern.lastIndex = 0;
      const match = entry.pattern.exec(corpus);
      if (!match || match.index == null) {
        return false;
      }
      if (!entry.rejectWindow) {
        return true;
      }
      const window = corpus.slice(
        Math.max(0, match.index - 24),
        Math.min(corpus.length, match.index + match[0].length + 24),
      );
      return !entry.rejectWindow.test(window);
    })
    .map((entry) => entry.id);
}

function hasElectronicVenueCorroboration(input: RelevanceEvidenceInput): boolean {
  const venue = (input.venueName ?? '').toLowerCase();
  const title = input.title.toLowerCase();
  return ELECTRONIC_VENUE_HINTS.some((hint) => {
    const normalized = hint.toLowerCase();
    return venue.includes(normalized) || title.includes(normalized);
  });
}

function hasExperimentalElectronicSignal(corpus: string): boolean {
  return EXPERIMENTAL_ELECTRONIC_POSITIVE.some((pattern) => pattern.test(corpus));
}

const DEFINITIVE_CULTURE_NEGATIVE = new Set([
  'flea_market',
  'market_seller',
  'workshop',
  'exhibition',
  'food',
  'film',
  'comedy',
  'theatre',
  'opera',
  'classical',
  'sport',
  'family',
  'business',
  'circus',
  'rock_pop',
  'punk_metal_hardcore',
  'hip_hop_rap',
  'k_pop',
  'spoken_word',
  'books_literature',
  'culinary_food',
  'performance_art',
  'cultural_performance',
  'general_market',
]);

const UNAMBIGUOUS_ELECTRONIC_POSITIVE = new Set([
  'techno',
  'hard_techno',
  'deep_house',
  'tech_house',
  'melodic_techno',
  'trance',
  'psytrance',
  'edm',
  'hardstyle',
  'gabber',
  'dnb',
  'dnb_short',
  'jungle',
  'electro',
  'hard_techno_abbrev',
]);

function hasUnambiguousElectronicPositive(hits: string[]): boolean {
  return hits.some((hit) => UNAMBIGUOUS_ELECTRONIC_POSITIVE.has(hit));
}

function hasDefinitiveCultureNegative(hits: string[]): boolean {
  return hits.some((hit) => DEFINITIVE_CULTURE_NEGATIVE.has(hit));
}

export function classifyRelevanceEvidence(input: RelevanceEvidenceInput): RelevanceEvidenceResult {
  const corpus = [
    input.title,
    input.description ?? '',
    input.venueName ?? '',
    input.organizerName ?? '',
    ...(input.genreHints ?? []),
    ...(input.lineupHints ?? []),
  ]
    .join(' ')
    .trim();

  const reasons: string[] = [];
  const strongPositiveHits = collectMatches(corpus, STRONG_POSITIVE);
  const weakPositiveHits = collectMatches(corpus, WEAK_POSITIVE);
  const negativeHits = STRONG_NEGATIVE.filter((entry) => entry.pattern.test(corpus)).map((entry) => entry.id);

  if (
    input.detailAccess === 'BLOCKED_BY_SECURITY' ||
    input.detailAccess === 'PROVIDER_ACCESS_UNAVAILABLE'
  ) {
    return {
      relevance: 'AMBIGUOUS',
      reasons: ['provider_access_unavailable'],
      ambiguityReason: 'provider_access_unavailable',
      strongPositiveHits,
      weakPositiveHits,
      negativeHits,
    };
  }

  for (const hit of negativeHits) {
    reasons.push(`negative:${hit}`);
  }
  for (const hit of strongPositiveHits) {
    reasons.push(`strong_positive:${hit}`);
  }
  for (const hit of weakPositiveHits) {
    reasons.push(`weak_positive:${hit}`);
  }

  const hasStrongPositive = strongPositiveHits.length > 0 || hasExperimentalElectronicSignal(corpus);
  const hasWeakPositive = weakPositiveHits.length > 0 || hasElectronicVenueCorroboration(input);
  const hasStrongNegative = negativeHits.length > 0;
  const negativeIsAmbiguousOnly = negativeHits.every((hit) =>
    STRONG_NEGATIVE.find((entry) => entry.id === hit)?.ambiguous,
  );
  const hasDefinitiveNegative = negativeHits.some(
    (hit) => !STRONG_NEGATIVE.find((entry) => entry.id === hit)?.ambiguous,
  );

  if (hasStrongNegative && !hasStrongPositive) {
    if (hasDefinitiveNegative) {
      return {
        relevance: 'IRRELEVANT',
        reasons,
        strongPositiveHits,
        weakPositiveHits,
        negativeHits,
      };
    }
    if (hasWeakPositive) {
      return {
        relevance: 'AMBIGUOUS',
        reasons: [...reasons, 'conflict:weak_electronic_vs_non_electronic'],
        ambiguityReason: 'mixed_music_program',
        strongPositiveHits,
        weakPositiveHits,
        negativeHits,
      };
    }
    return {
      relevance: negativeIsAmbiguousOnly ? 'AMBIGUOUS' : 'IRRELEVANT',
      reasons,
      ambiguityReason: negativeIsAmbiguousOnly ? 'non_electronic_format_evidence' : undefined,
      strongPositiveHits,
      weakPositiveHits,
      negativeHits,
    };
  }

  if (hasStrongNegative && hasStrongPositive) {
    if (hasExperimentalElectronicSignal(corpus)) {
      return {
        relevance: 'HIGH_RELEVANCE',
        reasons: [...reasons, 'experimental_electronic_override'],
        strongPositiveHits,
        weakPositiveHits,
        negativeHits,
      };
    }
    if (hasDefinitiveCultureNegative(negativeHits) && !hasUnambiguousElectronicPositive(strongPositiveHits)) {
      return {
        relevance: 'IRRELEVANT',
        reasons: [...reasons, 'definitive_non_electronic_override'],
        strongPositiveHits,
        weakPositiveHits,
        negativeHits,
      };
    }
    return {
      relevance: 'AMBIGUOUS',
      reasons: [...reasons, 'conflict:mixed_electronic_and_non_electronic'],
      ambiguityReason: 'mixed_music_program',
      strongPositiveHits,
      weakPositiveHits,
      negativeHits,
    };
  }

  if (hasStrongPositive) {
    return {
      relevance: 'HIGH_RELEVANCE',
      reasons,
      strongPositiveHits,
      weakPositiveHits,
      negativeHits,
    };
  }

  if (
    input.lineupDomainBoost === 'HIGH' ||
    (input.lineupElectronicArtistCount ?? 0) >= 2
  ) {
    return {
      relevance: 'HIGH_RELEVANCE',
      reasons: [...reasons, 'lineup_electronic_artist_consensus'],
      strongPositiveHits: [...strongPositiveHits, 'lineup_consensus'],
      weakPositiveHits,
      negativeHits,
    };
  }

  if (input.lineupDomainBoost === 'LIKELY' || (input.lineupHints?.length ?? 0) >= 5) {
    const clubLineupSignal =
      (input.lineupHints?.length ?? 0) >= 5 &&
      /(?:klub|club|floor|rave|night|b2b)/i.test(corpus);
    if (input.lineupDomainBoost === 'LIKELY' || clubLineupSignal) {
      return {
        relevance: 'LIKELY_RELEVANT',
        reasons: [...reasons, 'lineup_multi_artist_club_evidence'],
        strongPositiveHits,
        weakPositiveHits: [...weakPositiveHits, 'lineup_structure'],
        negativeHits,
      };
    }
  }

  if (hasWeakPositive) {
    const likelyFromVenue =
      hasElectronicVenueCorroboration(input) &&
      (/\b(?:pres\.?|presented\s+by|w\/|with)\b/i.test(input.title) || Boolean(input.venueName?.trim()));
    return {
      relevance: likelyFromVenue ? 'LIKELY_RELEVANT' : 'AMBIGUOUS',
      reasons: likelyFromVenue
        ? [...reasons, 'likely:electronic_venue_corroboration']
        : [...reasons, 'ambiguous:weak_signal_only'],
      ambiguityReason: likelyFromVenue ? undefined : 'genre_not_explicit',
      strongPositiveHits,
      weakPositiveHits,
      negativeHits,
    };
  }

  if (/\b(?:party|floor|beats|sound)\b/i.test(corpus)) {
    return {
      relevance: 'AMBIGUOUS',
      reasons: [...reasons, 'ambiguous_club_signal'],
      ambiguityReason: 'mixed_music_program',
      strongPositiveHits,
      weakPositiveHits,
      negativeHits,
    };
  }

  if (!input.description && (input.lineupHints?.length ?? 0) === 0) {
    return {
      relevance: 'AMBIGUOUS',
      reasons: [...reasons, 'insufficient_detail_evidence'],
      ambiguityReason: 'insufficient_detail_evidence',
      strongPositiveHits,
      weakPositiveHits,
      negativeHits,
    };
  }

  return {
    relevance: 'AMBIGUOUS',
    reasons: [...reasons, 'genre_not_explicit'],
    ambiguityReason: 'genre_not_explicit',
    strongPositiveHits,
    weakPositiveHits,
    negativeHits,
  };
}
