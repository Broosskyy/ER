import type { ElectronicRelevance } from './types';

const HIGH_POSITIVE = [
  /\btechno\b/i,
  /\bhard\s*techno\b/i,
  /\bhouse\b/i,
  /\btrance\b/i,
  /\bedm\b/i,
  /\bhardstyle\b/i,
  /\bhardcore\b/i,
  /\bdrum\s*(?:&|and|n)?\s*bass\b/i,
  /\bdnb\b/i,
  /\belectronic\b/i,
  /\brave\b/i,
  /\bclub\s*night\b/i,
  /\b(?:open\s*air|festival)\b/i,
  /\b(?:bootshaus|affenkaefig|affenkäfig|kitkat|unreal|nibirii|zaagstep|underland)\b/i,
];

const LIKELY_POSITIVE = [
  /\b(?:dj|live act|b2b|all\s*night\s*long)\b/i,
  /\b(?:mainfloor|warehouse|underground)\b/i,
  /\b(?:psytrance|minimal|melodic|industrial|schranz)\b/i,
  /\b(?:electro|breakbeat|uk\s*garage|bass)\b/i,
];

const NEGATIVE = [
  /\b(?:comedy|kabarett|theater|theatre|musical|opera|klassik|classical)\b/i,
  /\b(?:sport|fußball|football|marathon|triathlon)\b/i,
  /\b(?:kinder|family|familie|kindertheater)\b/i,
  /\b(?:business|conference|messe|seminar|workshop)\b/i,
  /\b(?:weihnachtsmarkt|christmas market|circus)\b/i,
];

export interface RelevanceInput {
  title: string;
  description?: string;
  genreHints?: string[];
  venueName?: string;
  organizerName?: string;
}

export function classifyElectronicRelevance(input: RelevanceInput): {
  relevance: ElectronicRelevance;
  reasons: string[];
} {
  const corpus = [
    input.title,
    input.description ?? '',
    input.venueName ?? '',
    input.organizerName ?? '',
    ...(input.genreHints ?? []),
  ]
    .join(' ')
    .trim();

  const reasons: string[] = [];

  for (const pattern of NEGATIVE) {
    if (pattern.test(corpus)) {
      reasons.push(`negative:${pattern.source}`);
      return { relevance: 'IRRELEVANT', reasons };
    }
  }

  for (const pattern of HIGH_POSITIVE) {
    if (pattern.test(corpus)) {
      reasons.push(`high:${pattern.source}`);
      return { relevance: 'HIGH_RELEVANCE', reasons };
    }
  }

  for (const pattern of LIKELY_POSITIVE) {
    if (pattern.test(corpus)) {
      reasons.push(`likely:${pattern.source}`);
      return { relevance: 'LIKELY_RELEVANT', reasons };
    }
  }

  if (/\b(?:party|club|night|floor|beats|sound)\b/i.test(corpus)) {
    reasons.push('ambiguous_club_signal');
    return { relevance: 'AMBIGUOUS', reasons };
  }

  reasons.push('no_clear_electronic_signal');
  return { relevance: 'AMBIGUOUS', reasons };
}
