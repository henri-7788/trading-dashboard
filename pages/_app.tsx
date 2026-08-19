import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { Inter, JetBrains_Mono } from 'next/font/google'

const ui = Inter({ subsets: ['latin'], variable: '--font-ui' })
const data = JetBrains_Mono({ subsets: ['latin'], variable: '--font-data' })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${ui.variable} ${data.variable} font-sans`}>
      <Component {...pageProps} />
    </div>
  )
}
