import { normalizeTicketPriceLine } from './normalize-ticket-price';

const DOOR_ADMISSION_PATTERNS = [
  /Eintritt[:\s]+(\d+[.,]\d{2})\s*Euro/gi,
  /Eintritt[:\s]+(\d+)\s*Euro/gi,
  /Admission[:\s]+(\d+[.,]\d{2})\s*Euro/gi,
  /Admission[:\s]+(\d+)\s*Euro/gi,
];

export interface OfficialDoorAdmissionPrice {
  amountMinor: number;
  currency: string;
  rawPriceText: string;
}

export function extractOfficialDoorAdmissionFromHtml(html: string): OfficialDoorAdmissionPrice | undefined {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  for (const pattern of DOOR_ADMISSION_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match?.[1]) {
      continue;
    }
    const normalized = normalizeTicketPriceLine(`${match[1]} EUR`);
    if (normalized.amountMinor == null) {
      continue;
    }
    return {
      amountMinor: normalized.amountMinor,
      currency: normalized.currency ?? 'EUR',
      rawPriceText: match[0].trim(),
    };
  }

  return undefined;
}
