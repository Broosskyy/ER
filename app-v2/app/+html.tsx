import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { PWA_CONFIG } from '@/platform/pwa/pwa-config';

const siteUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '';
const robots = process.env.EXPO_PUBLIC_WEB_NOINDEX === 'true' ? 'noindex, nofollow' : 'index, follow';

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
        <meta name="description" content={PWA_CONFIG.description} />
        <meta name="robots" content={robots} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={PWA_CONFIG.shortName} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={PWA_CONFIG.name} />
        <meta property="og:description" content={PWA_CONFIG.description} />
        {siteUrl ? <meta property="og:url" content={siteUrl} /> : null}
        <meta property="og:image" content="/pwa/icon-512.png" />
        <link rel="manifest" href={PWA_CONFIG.manifestPath} />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
        <title>{PWA_CONFIG.name}</title>
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
