import { Stack } from 'expo-router';
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#0B0B0F" />
        <title>Eternal Rave</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                width: 100%;
                min-height: 100%;
              }
              body {
                background-color: #0B0B0F;
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
