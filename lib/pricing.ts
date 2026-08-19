import { fetchMids } from './hyperliquid'
import { fetchCryptoLastPrice } from './providers/ccxt'

const CACHE_TTL_MS = 20_000
const cache = new Map<string, { value: number | null; at: number }>()

function cached(key: string): number | null | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > CACHE_TTL_MS) return undefined
  return hit.value
}

function store(key: string, value: number | null) {
  cache.set(key, { value, at: Date.now() })
}

/** Live price for a crypto symbol: tries Hyperliquid mids first (cheap, already fetched for trades), then a public exchange ticker. */
export async function fetchCryptoPrice(symbol: string): Promise<number | null> {
  const key = `crypto:${symbol}`
  const hit = cached(key)
  if (hit !== undefined) return hit

  try {
    const mids = await fetchMids()
    const mid = parseFloat(mids[symbol])
    if (Number.isFinite(mid)) {
      store(key, mid)
      return mid
    }
  } catch {
    // fall through to exchange ticker
  }

  const price = await fetchCryptoLastPrice(symbol)
  store(key, price)
  return price
}

const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; trading-dashboard/1.0)' }

async function fetchYahooMeta(symbol: string): Promise<{ price: number; currency: string } | null> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`, {
    headers: YAHOO_HEADERS
  })
  if (!res.ok) return null
  const data = await res.json()
  const meta = data?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice
  const currency = meta?.currency
  if (!Number.isFinite(price) || !currency) return null
  return { price, currency }
}

/**
 * Live quote for a stock/ETF via Yahoo Finance's public chart endpoint (no API key required).
 * `symbol` is a plain Yahoo ticker, e.g. "AAPL" or "VWCE.DE" — set per manual position in
 * Settings. Non-USD quotes are converted to USD via Yahoo's FX tickers so equity stays additive.
 */
export async function fetchStockPrice(symbol: string): Promise<number | null> {
  const key = `stock:${symbol.toUpperCase()}`
  const hit = cached(key)
  if (hit !== undefined) return hit

  try {
    const quote = await fetchYahooMeta(symbol)
    if (!quote) {
      store(key, null)
      return null
    }
    if (quote.currency === 'USD') {
      store(key, quote.price)
      return quote.price
    }
    const fx = await fetchYahooMeta(`${quote.currency}USD=X`)
    const price = fx ? quote.price * fx.price : null
    store(key, price)
    return price
  } catch (err) {
    console.error(`stock price lookup failed for ${symbol}`, err)
    store(key, null)
    return null
  }
}
