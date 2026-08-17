export interface NormalizedTicketPrice {
  rawPrice: string;
  amountMinor?: number;
  currency?: string;
  isMinimumPrice: boolean;
  feeNotice?: string;
  parseError?: 'ticket_price_unparseable';
}

const PRICE_PATTERN =
  /(?:(?:ab|from)\s+)?(?:(€|EUR)\s*)?(\d{1,4}(?:[.,]\d{2})?)\s*(?:€|EUR)?(?:\s*\+\s*(?:Gebühr|fee|fees).*)?/i;

export function normalizeTicketPriceLine(rawPrice: string): NormalizedTicketPrice {
  const trimmed = rawPrice.replace(/\s+/g, ' ').trim();
  const isMinimumPrice = /\b(?:ab|from)\b/i.test(trimmed);
  const feeMatch = trimmed.match(/\+\s*(Gebühr|fee|fees)[^.]*/i);
  const feeNotice = feeMatch?.[0]?.trim();

  const match = trimmed.match(PRICE_PATTERN);
  if (!match) {
    return {
      rawPrice: trimmed,
      isMinimumPrice,
      feeNotice,
      parseError: 'ticket_price_unparseable',
    };
  }

  const currencyToken = match[1]?.toUpperCase();
  const amountText = match[2]?.replace(',', '.');
  if (!amountText) {
    return {
      rawPrice: trimmed,
      isMinimumPrice,
      feeNotice,
      parseError: 'ticket_price_unparseable',
    };
  }
  const amount = Number.parseFloat(amountText);
  if (!Number.isFinite(amount)) {
    return {
      rawPrice: trimmed,
      isMinimumPrice,
      feeNotice,
      parseError: 'ticket_price_unparseable',
    };
  }

  return {
    rawPrice: trimmed,
    amountMinor: Math.round(amount * 100),
    currency: currencyToken === '€' || currencyToken === 'EUR' || trimmed.includes('€') || trimmed.includes('EUR') ? 'EUR' : undefined,
    isMinimumPrice,
    feeNotice,
  };
}
