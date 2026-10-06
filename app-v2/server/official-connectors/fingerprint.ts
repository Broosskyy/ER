import { createHash } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function fingerprintHtmlPage(html: string): string {
  return sha256Hex(html.replace(/\s+/g, ' ').trim());
}
