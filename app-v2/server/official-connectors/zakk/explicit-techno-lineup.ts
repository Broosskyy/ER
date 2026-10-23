import type { OfficialLineupCandidate } from '../types';
import { validateOfficialLineupAct, inferLineupEvidenceRole } from '../shared/lineup-normalization';

/**
 * Only quote artists in a specifically published billing sentence.
 * Generic prose, style names, placeholders and inferred DJs do not qualify.
 */
export function extractZakkPublishedTechnoBilling(source: string): OfficialLineupCandidate[] {
  const match = source.match(/\btechno\s+mit\s+([^:.!?\n]{5,110})(?=[:.!?\n]|$)/i);
  if (!match?.[1]) return [];
  const raw = match[1].trim();
  if (!/\s(?:&|und)\s|\s*,\s*/i.test(raw) || /\b(?:tba|folgt|coming soon)\b/i.test(raw)) return [];
  const acts = raw.split(/\s+&\s+|\s+und\s+|\s*,\s*/i).map(s=>s.trim()).filter(Boolean);
  if (acts.length < 2 || acts.length > 8) return [];
  if (acts.some(name=> !validateOfficialLineupAct(name,'explicit_sentence').accepted)) return [];
  return acts.map((displayName,billingOrder)=>({
    displayName,
    rawText: displayName,
    billingOrder,
    evidenceOrigin:'official_text' as const,
    evidenceRole:inferLineupEvidenceRole(displayName,billingOrder),
  }));
}
