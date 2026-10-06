export function compactOcrKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeOcrArtistLine(text: string): string {
  let normalized = text.replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/^[\s"'([{¢$€£>«]+/, '');
  normalized = normalized.replace(/[\s"'|[\]}>»]+$/g, '');
  normalized = normalized.replace(/\|+/g, ' ');
  normalized = normalized.replace(/([A-Za-z0-9])\s*\/\s*([A-Za-z0-9])/g, '$1 $2');
  normalized = normalized.replace(/\b(\d+)\s+ENGEL\s+8\s+CHARLIE\b/i, '$1 ENGEL & CHARLIE');
  normalized = normalized.replace(/\bDJ\s+([A-Z][A-Z0-9]+)\b/i, 'DJ $1');
  return normalized.replace(/\s+/g, ' ').trim();
}
