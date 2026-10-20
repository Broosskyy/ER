import { describe,expect,it } from 'vitest';
import type { OfficialEventEvidence, OfficialLineupCandidate } from '../../types';
import { restrictBootshausLineupToOfficialText } from '../restrict-ocr-lineup';

const act=(displayName:string):OfficialLineupCandidate=>({
  displayName,rawText:displayName,evidenceRole:'artist',
  sourceType:'official_text',confidence:'high',
}) as OfficialLineupCandidate;
const evidence=(acts:string[]):OfficialEventEvidence=>({
  connectorId:'bootshaus-official',
  sourceEventKey:'event-2026',officialUrl:'https://bootshaus.tv/events/event-2026/',
  fetchedAt:'2026-10-20T19:00:00Z',startsAt:'2026-11-07T22:00:00+01:00',
  title:'Unreal Night II',sourceTimezone:'Europe/Berlin',
  pageFingerprint:'sha',listUrl:'https://bootshaus.tv/events/',
  lineupCandidates:acts.map(act),enrichmentGaps:[],
} as OfficialEventEvidence);

describe('Bootshaus official artist evidence',()=>{
  it('prevents OCR concatenation from replacing individual official acts',()=>{
    const original=evidence(['999999999','6EJOU','IN VERRUF']);
    const merged=evidence(['9999999996EJOU','IN VERRUF','RANDOM FLYER WORD']);
    const restricted=restrictBootshausLineupToOfficialText(original,merged);
    expect(restricted.lineupCandidates.map(a=>a.displayName))
      .toEqual(['999999999','6EJOU','IN VERRUF']);
    expect(restricted.enrichmentGaps).toContain('media_lineup_requires_independent_verification');
  });
  it('does not publish synthetic artists if promoter has not announced a lineup',()=>{
    const original=evidence([]);
    const merged=evidence(['THA WATCHER','AALST 528 SCREECHER >< CHAOTIC HOSTILITY']);
    expect(restrictBootshausLineupToOfficialText(original,merged).lineupCandidates).toEqual([]);
  });
  it('keeps unchanged trusted artist text and other source fields',()=>{
    const original=evidence(['KLOFAMA']);
    const merged={...evidence(['KLOFAMA']),descriptionClean:'Real page description'};
    const restricted=restrictBootshausLineupToOfficialText(original,merged);
    expect(restricted).toBe(merged);
  });
});