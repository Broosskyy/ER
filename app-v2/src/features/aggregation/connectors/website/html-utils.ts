/**
 * Minimal HTML utilities for configurable selector extraction.
 * No script evaluation. Regex-based for deterministic node tests.
 */

export function extractAttribute(html: string, selector: string, attribute = 'href'): string[] {
  if (selector.startsWith('[') && selector.endsWith(']')) {
    const attrName = selector.slice(1, -1);
    const pattern = new RegExp(`${attrName}=["']([^"']+)["']`, 'gi');
    const values: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      if (match[1]) values.push(match[1]);
    }
    return values;
  }

  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    const pattern = new RegExp(
      `<([a-zA-Z0-9]+)[^>]*class=["'](?:[^"']*\\s)?${escapeRegex(className)}(?:\\s[^"']*)?["'][^>]*>`,
      'gi',
    );
    return extractFromMatchedTags(html, pattern, attribute);
  }

  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    const pattern = new RegExp(`<([a-zA-Z0-9]+)[^>]*id=["']${escapeRegex(id)}["'][^>]*>`, 'i');
    return extractFromMatchedTags(html, pattern, attribute);
  }

  const tagPattern = new RegExp(`<${escapeRegex(selector)}[^>]*>`, 'gi');
  return extractFromMatchedTags(html, tagPattern, attribute);
}

export function extractTextContent(html: string, selector: string): string[] {
  const openPattern = buildOpenTagPattern(selector);
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = openPattern.exec(html)) !== null) {
    const start = match.index + match[0].length;
    const closeTag = `</${match[1] ?? 'div'}>`;
    const end = html.indexOf(closeTag, start);
    if (end < 0) continue;
    const text = stripTags(html.slice(start, end)).trim();
    if (text) results.push(text);
  }
  return results;
}

export function extractLinks(html: string, selector: string, attribute = 'href'): string[] {
  const openPattern = buildOpenTagPattern(selector);
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = openPattern.exec(html)) !== null) {
    const tag = match[0];
    const attrMatch = new RegExp(`${attribute}=["']([^"']+)["']`, 'i').exec(tag);
    if (attrMatch?.[1]) {
      results.push(attrMatch[1]);
    }
  }
  return results;
}

export function countMatches(html: string, selector: string): number {
  return buildOpenTagPattern(selector).test(html)
    ? (html.match(buildOpenTagPattern(selector)) ?? []).length
    : extractTextContent(html, selector).length;
}

function buildOpenTagPattern(selector: string): RegExp {
  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    return new RegExp(
      `<([a-zA-Z0-9]+)[^>]*class=["'](?:[^"']*\\s)?${escapeRegex(className)}(?:\\s[^"']*)?["'][^>]*>`,
      'gi',
    );
  }
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    return new RegExp(`<([a-zA-Z0-9]+)[^>]*id=["']${escapeRegex(id)}["'][^>]*>`, 'gi');
  }
  return new RegExp(`<${escapeRegex(selector)}[^>]*>`, 'gi');
}

function extractFromMatchedTags(html: string, pattern: RegExp, attribute: string): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const attrMatch = new RegExp(`${attribute}=["']([^"']+)["']`, 'i').exec(match[0]);
    if (attrMatch?.[1]) {
      results.push(attrMatch[1]);
    }
  }
  return results;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractBlocksBySelector(html: string, selector: string, includeOuter: boolean): string[] {
  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    const pattern = new RegExp(
      `<([a-zA-Z0-9]+)[^>]*class=["'](?:[^"']*\\s)?${escapeRegex(className)}(?:\\s[^"']*)?["'][^>]*>[\\s\\S]*?<\\/\\1>`,
      'gi',
    );
    const results: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      if (includeOuter) {
        results.push(match[0]);
      } else {
        const contentStart = match[0].indexOf('>') + 1;
        const contentEnd = match[0].lastIndexOf('<');
        results.push(match[0].slice(contentStart, contentEnd));
      }
    }
    return results;
  }

  const openPattern = buildOpenTagPattern(selector);
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = openPattern.exec(html)) !== null) {
    const tagName = match[1] ?? 'div';
    const start = match.index;
    const openEnd = start + match[0].length;
    const closeTag = `</${tagName}>`;
    const closeIndex = html.indexOf(closeTag, openEnd);
    if (closeIndex < 0) {
      continue;
    }
    results.push(includeOuter ? html.slice(start, closeIndex + closeTag.length) : html.slice(openEnd, closeIndex));
  }
  return results;
}

/**
 * Returns the inner HTML of each element matching the selector.
 */
export function extractContainerBlocks(html: string, selector: string): string[] {
  return extractBlocksBySelector(html, selector, false);
}

/**
 * Returns full outer HTML (including the matched opening tag) for each container.
 */
export function extractContainerOuterBlocks(html: string, selector: string): string[] {
  return extractBlocksBySelector(html, selector, true);
}

export function extractMetaProperty(html: string, property: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(property)}["']`,
    'i',
  );
  return pattern.exec(html)?.[1] ?? reversePattern.exec(html)?.[1];
}

export function extractMetaName(html: string, name: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+name=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(name)}["']`,
    'i',
  );
  return pattern.exec(html)?.[1] ?? reversePattern.exec(html)?.[1];
}
