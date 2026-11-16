import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="de">
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="Portfolio- und Trading-Übersicht über alle verbundenen Börsen." />

        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0d3646" />
        <meta name="color-scheme" content="light" />

        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trading" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
