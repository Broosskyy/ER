import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

export function readMetaContent(html: string, property: string): string | undefined {
  const match =
    html.match(new RegExp(`property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')) ??
    html.match(new RegExp(`content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i')) ??
    html.match(new RegExp(`name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
  return match?.[1]?.trim();
}

export function extractOgMeta(html: string): {
  title?: string;
  description?: string;
  imageUrl?: string;
  url?: string;
} {
  const title =
    readMetaContent(html, 'og:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = readMetaContent(html, 'og:description');
  const imageUrl = readMetaContent(html, 'og:image');
  const url = readMetaContent(html, 'og:url');
  return {
    title: title ? decodeHtmlEntities(title) : undefined,
    description: description ? decodeHtmlEntities(description) : undefined,
    imageUrl,
    url,
  };
}
