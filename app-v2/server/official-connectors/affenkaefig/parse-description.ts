const LINEUP_NOT_ANNOUNCED_PATTERNS = [
  /line\s*-?\s*up.*bald/i,
  /lineup.*soon/i,
  /wird bald angekündigt/i,
  /coming soon/i,
  /line-?up\s+soon/i,
  /ticket\s+infos?\s+soon/i,
];

export function containsLineupNotAnnouncedSignal(text: string): boolean {
  return LINEUP_NOT_ANNOUNCED_PATTERNS.some((pattern) => pattern.test(text));
}

export function cleanAffenkaefigDescription(html: string): string | undefined {
  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return undefined;
  }

  return normalized;
}
