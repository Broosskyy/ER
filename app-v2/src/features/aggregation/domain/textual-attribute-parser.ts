import { decodeHtmlEntities, stripHtml } from '@/features/import/normalization/text-normalizer';
import type { SourcedEventAttribute } from '@/features/aggregation/domain/event-structured-detail';

const FLOOR_PATTERN = /(\d+)\s*(?:floors?|stages?|rooms?)\b/i;
const AGE_PATTERN =
  /(?:mindestalter|age(?:\s*(?:limit|restriction))?|ab)\s*:?\s*(\d{1,2})\s*\+?/i;
const DOORS_PATTERN = /(?:doors?\s*open|einlass)\s*(?:at|ab|:)?\s*(\d{1,2}[:.]\d{2})/i;

function pushUnique(
  attributes: SourcedEventAttribute[],
  entry: SourcedEventAttribute,
): void {
  if (attributes.some((a) => a.key === entry.key)) {
    return;
  }
  attributes.push(entry);
}

/** Extract structured event attributes from free-text descriptions (no OCR). */
export function extractAttributesFromDescriptionText(
  description: string | undefined,
  source = 'description_text',
): {
  attributes: SourcedEventAttribute[];
  minimumAge?: string;
  doorsOpenAt?: string;
  floorCount?: number;
  venueEnvironment?: 'indoor' | 'outdoor' | 'hybrid';
} {
  if (!description?.trim()) {
    return { attributes: [] };
  }

  const plain = stripHtml(decodeHtmlEntities(description)).replace(/\s+/g, ' ').trim();
  const attributes: SourcedEventAttribute[] = [];
  let minimumAge: string | undefined;
  let doorsOpenAt: string | undefined;
  let floorCount: number | undefined;
  let venueEnvironment: 'indoor' | 'outdoor' | 'hybrid' | undefined;

  if (/\bopen\s*air\b/i.test(plain)) {
    pushUnique(attributes, { key: 'open_air', label: 'Open Air', source, confidence: 0.85 });
    venueEnvironment = 'outdoor';
  }
  if (/\boutdoor\b/i.test(plain) && !venueEnvironment) {
    pushUnique(attributes, { key: 'outdoor', label: 'Outdoor', source, confidence: 0.8 });
    venueEnvironment = 'outdoor';
  }
  if (/\bindoor\b/i.test(plain)) {
    pushUnique(attributes, { key: 'indoor', label: 'Indoor', source, confidence: 0.8 });
    venueEnvironment = venueEnvironment === 'outdoor' ? 'hybrid' : 'indoor';
  }
  if (/\bfestival\b/i.test(plain)) {
    pushUnique(attributes, { key: 'festival', label: 'Festival', source, confidence: 0.75 });
  }
  if (/\bafter\s*hour\b/i.test(plain)) {
    pushUnique(attributes, { key: 'afterhour', label: 'Afterhour', source, confidence: 0.75 });
  }
  if (/\blive\b/i.test(plain) && /\bline[\s-]?up\b/i.test(plain)) {
    pushUnique(attributes, { key: 'concert', label: 'Live', source, confidence: 0.7 });
  }

  const floorMatch = plain.match(FLOOR_PATTERN);
  if (floorMatch?.[1]) {
    floorCount = Number.parseInt(floorMatch[1], 10);
    if (Number.isFinite(floorCount)) {
      pushUnique(attributes, {
        key: 'multi_floor',
        label: `${floorCount} Floors`,
        value: floorCount,
        source,
        confidence: 0.85,
      });
    }
  }

  const ageMatch = plain.match(AGE_PATTERN);
  if (ageMatch?.[1]) {
    minimumAge = `${ageMatch[1]}+`;
    pushUnique(attributes, {
      key: 'accessible',
      label: `Age ${minimumAge}`,
      value: minimumAge,
      source,
      confidence: 0.8,
    });
  }

  const doorsMatch = plain.match(DOORS_PATTERN);
  if (doorsMatch?.[1]) {
    doorsOpenAt = doorsMatch[1].replace('.', ':');
  }

  return { attributes, minimumAge, doorsOpenAt, floorCount, venueEnvironment };
}
