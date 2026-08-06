import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';

const DATE_LIKE_PRICE = /\b(20\d{2}|19\d{2})\b/;
const QUANTITY_LIKE = /\b\d+\s*x\s*\d+\b/i;

export interface NormalizedCanonicalTicketPrice {
  priceText?: string;
  currency?: string;
  minimumPrice?: number;
  maximumPrice?: number;
  feesIncluded?: boolean;
  feeText?: string;
}

function parseAmount(token: string): number | undefined {
  const normalized = token.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export function normalizeCanonicalTicketPrice(input: {
  priceText?: string;
  ticketPhases?: CanonicalTicketPhase[];
}): NormalizedCanonicalTicketPrice {
  const phaseAmounts = (input.ticketPhases ?? [])
    .map((phase) => phase.priceAmount)
    .filter((amount): amount is number => amount !== undefined && Number.isFinite(amount));

  if (phaseAmounts.length > 0) {
    const min = Math.min(...phaseAmounts);
    const max = Math.max(...phaseAmounts);
    const currency = input.ticketPhases?.find((phase) => phase.priceCurrency)?.priceCurrency ?? 'EUR';
    const feePhase = input.ticketPhases?.find((phase) => phase.feeLabel || phase.feeAmount !== undefined);
    return {
      currency,
      minimumPrice: min,
      maximumPrice: max,
      priceText:
        min === max
          ? `${min.toFixed(2).replace('.', ',')} €`
          : `ab ${min.toFixed(2).replace('.', ',')} €`,
      feesIncluded: feePhase ? false : undefined,
      feeText: feePhase?.feeLabel,
    };
  }

  const raw = input.priceText?.trim();
  if (!raw || !hasMeaningfulEventValue(raw)) {
    return {};
  }

  if (/\b(kostenlos|gratis|free|eintritt\s*frei)\b/i.test(raw)) {
    return { priceText: 'Kostenlos', minimumPrice: 0, maximumPrice: 0, currency: 'EUR' };
  }
  if (/\b(spende|donation)\b/i.test(raw)) {
    return { priceText: raw, currency: 'EUR' };
  }
  if (DATE_LIKE_PRICE.test(raw) || QUANTITY_LIKE.test(raw)) {
    return {};
  }

  const rangeMatch = raw.match(
    /(?:ab|from)\s*([\d]+[.,]\d{2}|\d+)\s*(?:€|eur)?\s*(?:-|–|bis|to)\s*([\d]+[.,]\d{2}|\d+)/i,
  );
  if (rangeMatch) {
    const min = parseAmount(rangeMatch[1]!);
    const max = parseAmount(rangeMatch[2]!);
    return {
      priceText: raw,
      currency: /€|eur/i.test(raw) ? 'EUR' : undefined,
      minimumPrice: min,
      maximumPrice: max,
      feesIncluded: /\binkl\b|\bincluding\b/i.test(raw) ? true : /\bzzgl\b|\bexcl\b/i.test(raw) ? false : undefined,
    };
  }

  const fromMatch = raw.match(/(?:ab|from)\s*([\d]+[.,]\d{2}|\d+)/i);
  if (fromMatch) {
    const min = parseAmount(fromMatch[1]!);
    return {
      priceText: raw,
      currency: /€|eur/i.test(raw) ? 'EUR' : undefined,
      minimumPrice: min,
      maximumPrice: min,
    };
  }

  const singleMatch = raw.match(/([\d]+[.,]\d{2}|\d+)\s*(?:€|eur)/i);
  if (singleMatch) {
    const amount = parseAmount(singleMatch[1]!);
    return {
      priceText: raw,
      currency: 'EUR',
      minimumPrice: amount,
      maximumPrice: amount,
      feesIncluded: /\binkl\b/i.test(raw) ? true : /\bzzgl\b/i.test(raw) ? false : undefined,
    };
  }

  return { priceText: raw };
}
