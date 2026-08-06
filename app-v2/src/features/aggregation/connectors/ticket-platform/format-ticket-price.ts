export function formatGermanTicketPrice(
  amount: number | undefined,
  currency: string = 'EUR',
  options: { soldOut?: boolean; prefix?: string } = {},
): string | undefined {
  if (options.soldOut) {
    return 'Ausverkauft';
  }
  if (amount === undefined || !Number.isFinite(amount)) {
    return undefined;
  }

  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/\u00A0/g, ' ');

  const prefix = options.prefix ?? 'ab';
  return `${prefix} ${formatted}`;
}

export function parseGermanPriceText(value: string | undefined): {
  amount?: number;
  currency?: string;
  soldOut?: boolean;
} {
  if (!value) {
    return {};
  }
  const normalized = value.trim().toLowerCase();
  if (/ausverkauft|sold\s*out/.test(normalized)) {
    return { soldOut: true };
  }

  const match = value.match(/([\d]+[.,]\d{2}|\d+)\s*(€|eur)/i);
  if (!match) {
    return {};
  }

  const amount = Number.parseFloat(match[1]!.replace(',', '.'));
  return {
    amount: Number.isFinite(amount) ? amount : undefined,
    currency: 'EUR',
  };
}

export function formatTicketPriceFromOverviewText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/ausverkauft|sold\s*out/i.test(trimmed)) {
    return 'Ausverkauft';
  }
  const amountMatch = trimmed.match(
    /tickets?\s+(?:from|ab)\s+([\d.,]+)\s*(?:euro|€|eur)?/i,
  );
  if (amountMatch?.[1]) {
    const amount = Number.parseFloat(amountMatch[1].replace(',', '.'));
    if (Number.isFinite(amount)) {
      return formatGermanTicketPrice(amount, 'EUR');
    }
  }
  return formatDisplayPriceText(trimmed) ?? trimmed;
}

/** Normalize stored/raw Ticket.io price strings for UI display. */
export function formatDisplayPriceText(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/ausverkauft|sold\s*out/i.test(trimmed)) {
    return 'Ausverkauft';
  }

  const parsed = parseGermanPriceText(trimmed);
  if (parsed.soldOut) {
    return 'Ausverkauft';
  }
  if (parsed.amount !== undefined) {
    const hasAbPrefix = /\bab\b/i.test(trimmed);
    return formatGermanTicketPrice(parsed.amount, parsed.currency ?? 'EUR', {
      prefix: hasAbPrefix ? 'ab' : undefined,
    });
  }

  const overviewAmount = trimmed.match(/([\d]+[.,]\d{2}|\d+)\s*(?:euro|€|eur)/i);
  if (overviewAmount?.[1]) {
    const amount = Number.parseFloat(overviewAmount[1].replace(',', '.'));
    if (Number.isFinite(amount)) {
      return formatGermanTicketPrice(amount, 'EUR', {
        prefix: /\bab\b/i.test(trimmed) ? 'ab' : undefined,
      });
    }
  }

  return trimmed;
}
