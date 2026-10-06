function normalizedPath(url: URL): string {
  return url.pathname.replace(/\/+$/, '') || '/';
}

const GENERIC_PATH =
  /^\/(?:|tickets?|shop|events?|eventkalender|programm|program|calendar|faq|kontakt|contact|impressum|privacy|datenschutz|agb|terms|about|ueber-uns|über-uns)$/i;

export function isGenericNonEventSupplementalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const path = normalizedPath(url);
    if (GENERIC_PATH.test(path)) {
      return true;
    }
    if (/\/(?:category|categories|tag|tags|artists?|venues?|locations?)\/?$/i.test(path)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function tokenSet(value?: string): Set<string> {
  return new Set(
    (value ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9äöüß]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  );
}

export function isEventSpecificSupplementalUrl(
  rawUrl: string,
  context: { title?: string; venueName?: string },
): boolean {
  if (isGenericNonEventSupplementalUrl(rawUrl)) {
    return false;
  }

  try {
    const url = new URL(rawUrl);
    const corpus = decodeURIComponent(`${url.pathname} ${url.search}`).toLowerCase();
    const evidenceTokens = new Set([
      ...tokenSet(context.title),
      ...tokenSet(context.venueName),
    ]);

    if (evidenceTokens.size === 0) {
      return /\/(?:event|events|veranstaltung|party|rave|show)\//i.test(url.pathname);
    }

    let matches = 0;
    for (const token of evidenceTokens) {
      if (corpus.includes(token)) {
        matches += 1;
      }
    }

    return (
      matches >= 1 ||
      /\/(?:event|events|veranstaltung|party|rave|show)\//i.test(url.pathname)
    );
  } catch {
    return false;
  }
}
