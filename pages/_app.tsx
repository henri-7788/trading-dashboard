import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Inter, JetBrains_Mono } from 'next/font/google'
import PwaStatus from '../components/PwaStatus'

const ui = Inter({ subsets: ['latin'], variable: '--font-ui' })
const data = JetBrains_Mono({ subsets: ['latin'], variable: '--font-data' })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${ui.variable} ${data.variable} font-sans`}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <PwaStatus />
      <Component {...pageProps} />
    </div>
  )
}
