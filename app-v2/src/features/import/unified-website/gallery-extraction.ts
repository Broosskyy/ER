import { readMetaContent } from './html-meta';

const GALLERY_IMAGE_PATTERNS = [
  /<img[^>]*class="[^"]*(?:event-gallery|gallery-image|event-image)[^"]*"[^>]*src=["']([^"']+)["']/gi,
  /<img[^>]*src=["']([^"']+)["'][^>]*class="[^"]*(?:event-gallery|gallery-image|event-image)[^"]*"/gi,
];

function isUsableGalleryUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return false;
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(trimmed) || /cdn\.|amazonaws\.com|cloudfront/i.test(trimmed);
}

export function extractGalleryUrls(html: string, primaryImage?: string): string[] {
  const urls = new Set<string>();
  if (primaryImage && isUsableGalleryUrl(primaryImage)) {
    urls.add(primaryImage);
  }

  const ogImage = readMetaContent(html, 'og:image');
  if (ogImage && isUsableGalleryUrl(ogImage)) {
    urls.add(ogImage);
  }

  for (const pattern of GALLERY_IMAGE_PATTERNS) {
    let match: RegExpExecArray | null;
    const flags = pattern.flags.includes('g') ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
    while ((match = flags.exec(html)) !== null) {
      const url = match[1]?.trim();
      if (url && isUsableGalleryUrl(url)) {
        urls.add(url);
      }
    }
  }

  return [...urls];
}
