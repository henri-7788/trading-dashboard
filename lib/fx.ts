/**
 * Historical FX rates into USD, so cost bases recorded in another currency (TradeRepublic exports
 * are in EUR) can be compared with live prices, which `pricing.ts` always returns in USD.
 *
 * Rates come from Yahoo Finance's public chart endpoint (`EURUSD=X` etc.), daily closes. One
 * request per currency covers the whole history and is cached for a few hours — rates for past
 * dates never change, and today's rate moving slightly over a session doesn't matter for a cost basis.
 */

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP'] as const
export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

/** Anything recorded before the currency field existed came from TradeRepublic or a German user: EUR. */
export const DEFAULT_CURRENCY: Currency = 'EUR'

export function normalizeCurrency(value: unknown): Currency {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(upper) ? (upper as Currency) : DEFAULT_CURRENCY
}

const HISTORY_TTL_MS = 6 * 60 * 60 * 1000
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; trading-dashboard/1.0)' }

interface RateHistory {
  /** Daily close by UTC date, `YYYY-MM-DD`. */
  byDay: Map<string, number>
  firstDay: string
  latest: number
  at: number
}

const histories = new Map<Currency, Promise<RateHistory | null>>()
const fetchedAt = new Map<Currency, number>()

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function loadHistory(currency: Currency): Promise<RateHistory | null> {
  // Twenty years back is far more than any manual position needs and still one small response.
  const period1 = Math.floor(Date.now() / 1000) - 20 * 365 * 24 * 3600
  const period2 = Math.floor(Date.now() / 1000) + 24 * 3600
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${currency}USD=X?interval=1d&period1=${period1}&period2=${period2}`
  const res = await fetch(url, { headers: YAHOO_HEADERS })
  if (!res.ok) throw new Error(`FX history ${currency}USD: HTTP ${res.status}`)
  const data = await res.json()
  const result = data?.chart?.result?.[0]
  const stamps: number[] = result?.timestamp || []
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || []
  const byDay = new Map<string, number>()
  stamps.forEach((ts, i) => {
    const close = closes[i]
    if (close != null && Number.isFinite(close) && close > 0) byDay.set(dayKey(new Date(ts * 1000)), close)
  })
  const latest = Number(result?.meta?.regularMarketPrice)
  if (byDay.size === 0) return null
  const days = Array.from(byDay.keys()).sort()
  return {
    byDay,
    firstDay: days[0],
    latest: Number.isFinite(latest) && latest > 0 ? latest : byDay.get(days[days.length - 1])!,
    at: Date.now()
  }
}

function history(currency: Currency) {
  const stale = Date.now() - (fetchedAt.get(currency) ?? 0) > HISTORY_TTL_MS
  if (!histories.has(currency) || stale) {
    fetchedAt.set(currency, Date.now())
    const p = loadHistory(currency).catch((err) => {
      console.error('fx history failed', err)
      // Let the next request retry instead of caching the failure for hours.
      fetchedAt.delete(currency)
      return null
    })
    histories.set(currency, p)
  }
  return histories.get(currency)!
}

/**
 * USD per one unit of `currency` on the given date: that day's close, or the closest earlier
 * trading day (weekends and holidays have no close). Returns null only when no rate is available
 * at all, so callers can decide whether to fall back or leave a value unpriced.
 */
export async function usdRateOn(currency: Currency, date: string | Date): Promise<number | null> {
  if (currency === 'USD') return 1
  const h = await history(currency)
  if (!h) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return h.latest
  const key = dayKey(d)
  if (key < h.firstDay) return h.byDay.get(h.firstDay) ?? h.latest
  for (let back = 0; back < 14; back++) {
    const probe = dayKey(new Date(d.getTime() - back * 24 * 3600 * 1000))
    const rate = h.byDay.get(probe)
    if (rate != null) return rate
  }
  return h.latest
}
