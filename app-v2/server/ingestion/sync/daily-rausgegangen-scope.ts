/**
 * Rotate already stored source bindings so every known event gets a bounded
 * periodic refresh without excluding other events from the daily discovery.
 * The saved URLs are public source identifiers, never ticket credentials.
 */
export function pickScheduledRausgegangenSourceUrls(
  urls: string[], dayIndex: number, limit = 24,
): string[] {
  const valid = [...new Set(urls.filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' &&
        ['rausgegangen.de','www.rausgegangen.de'].includes(parsed.hostname) &&
        /^\/events\/[a-z0-9-]+\/?$/i.test(parsed.pathname) &&
        !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }))];
  if (!valid.length) return [];
  const offset = ((Math.trunc(dayIndex) % valid.length) + valid.length) % valid.length;
  return [...valid.slice(offset),...valid.slice(0,offset)].slice(0,limit);
}
