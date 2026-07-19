import { useWebSeo } from '@/platform/seo/use-web-seo';

/** @deprecated Prefer useWebSeo for full meta tag support. */
export function useWebDocumentTitle(title: string, path?: string): void {
  useWebSeo({ title, path });
}
