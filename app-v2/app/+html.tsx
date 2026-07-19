import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { PWA_CONFIG } from '@/platform/pwa/pwa-config';
import {
  SEO_CONFIG,
  getWebBaseUrl,
  isGlobalNoIndex,
  resolveOgImageUrl,
} from '@/platform/seo/seo-config';
import {
  buildOrganizationJsonLd,
  buildWebApplicationJsonLd,
  buildWebSiteJsonLd,
} from '@/platform/seo/structured-data';

const siteUrl = getWebBaseUrl() ?? '';
const robots = isGlobalNoIndex() ? 'noindex, nofollow' : 'index, follow';
const ogImage = resolveOgImageUrl();
const googleVerification = process.env.EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

const globalJsonLd = [
  buildOrganizationJsonLd(),
  buildWebSiteJsonLd(),
  buildWebApplicationJsonLd(),
];

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang={PWA_CONFIG.lang}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content={PWA_CONFIG.themeColor} />
        <meta name="description" content={SEO_CONFIG.defaultDescription} />
        <meta name="robots" content={robots} />
        <meta name="author" content={SEO_CONFIG.author} />
        <meta name="application-name" content={SEO_CONFIG.siteName} />
        <meta name="generator" content={SEO_CONFIG.generator} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={PWA_CONFIG.shortName} />
        {googleVerification ? (
          <meta name="google-site-verification" content={googleVerification} />
        ) : null}
        <meta property="og:type" content={SEO_CONFIG.ogType} />
        <meta property="og:title" content={SEO_CONFIG.defaultTitle} />
        <meta property="og:description" content={SEO_CONFIG.defaultDescription} />
        <meta property="og:site_name" content={SEO_CONFIG.siteName} />
        <meta property="og:locale" content={SEO_CONFIG.locale} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content={String(SEO_CONFIG.ogImageWidth)} />
        <meta property="og:image:height" content={String(SEO_CONFIG.ogImageHeight)} />
        {siteUrl ? <meta property="og:url" content={siteUrl} /> : null}
        <meta name="twitter:card" content={SEO_CONFIG.twitterCard} />
        <meta name="twitter:title" content={SEO_CONFIG.defaultTitle} />
        <meta name="twitter:description" content={SEO_CONFIG.defaultDescription} />
        <meta name="twitter:image" content={ogImage} />
        {siteUrl ? <link rel="canonical" href={siteUrl} /> : null}
        <link rel="manifest" href={PWA_CONFIG.manifestPath} />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
        <title>{SEO_CONFIG.defaultTitle}</title>
        {globalJsonLd.map((data, index) => (
          <script key={`jsonld-${index}`} type="application/ld+json">
            {JSON.stringify(data)}
          </script>
        ))}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                width: 100%;
                min-height: 100%;
              }
              body {
                background-color: ${PWA_CONFIG.backgroundColor};
                overflow: auto;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
