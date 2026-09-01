function isDecorativeSeparatorBlock(block: string): boolean {
  const trimmed = block.trim();
  return trimmed.length >= 20 && /^[\s*=_\-–—|]+$/u.test(trimmed);
}

function normalizeBlock(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isDuplicateBlock(candidate: string, seen: Set<string>): boolean {
  const normalized = normalizeBlock(candidate);
  if (!normalized || normalized.length < 24) {
    return false;
  }
  if (seen.has(normalized)) {
    return true;
  }
  for (const existing of seen) {
    if (existing.length >= 40 && normalized.includes(existing)) {
      return true;
    }
    if (normalized.length >= 40 && existing.includes(normalized)) {
      return true;
    }
  }
  return false;
}

export function deduplicateDescriptionBlocks(description: string): string {
  const blocks = description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (blocks.length <= 1) {
    return description.trim();
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const block of blocks) {
    if (isDecorativeSeparatorBlock(block)) {
      if (!unique.some((entry) => isDecorativeSeparatorBlock(entry))) {
        unique.push(block);
      }
      continue;
    }
    if (isDuplicateBlock(block, seen)) {
      continue;
    }
    seen.add(normalizeBlock(block));
    unique.push(block);
  }
  return unique.join('\n\n').trim();
}
