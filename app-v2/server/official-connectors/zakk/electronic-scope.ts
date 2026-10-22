import type { OfficialEventEvidence } from '../types';

/** This official venue also lists rock, pop and mainstream parties. Only
 * explicit electronic genres may enter the Eternal Rave ingestion pipeline. */
export function isZakkElectronicEvent(
  evidence: Pick<OfficialEventEvidence, 'title' | 'descriptionClean'>,
): boolean {
  const text = [evidence.title, evidence.descriptionClean ?? ''].join(' ');
  return /\b(?:hard[ -]?techno|techno|psytrance|trance|hardstyle|hardtek|rave|tech[ -]?house|house[ -]?music|house[ -]?party|electronic(?:[ -]?music)?|elektronisch(?:e|er|en|es)?(?:[ -]?musik)?|drum\s*(?:and|&)\s*bass|dnb)\b/i.test(text);
}
