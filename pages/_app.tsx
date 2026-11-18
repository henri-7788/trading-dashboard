import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Geist } from 'next/font/google'
import Background from '../components/Background'
import PwaStatus from '../components/PwaStatus'

const ui = Geist({ subsets: ['latin'], variable: '--font-ui' })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${ui.variable} font-sans`}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Trading Dashboard</title>
      </Head>
      <Background />
      <PwaStatus />
      <Component {...pageProps} />
    </div>
  )
}
