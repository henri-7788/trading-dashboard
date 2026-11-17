import type { TradeChartData } from '../pages/api/trade-chart'

const TTL_MS = 30_000
const cache = new Map<string, { at: number; promise: Promise<TradeChartData> }>()

/**
 * Fetches chart data for a trade, sharing one in-flight request per trade. The detail modal
 * starts this as soon as it opens, so the data loads in parallel with the chart library chunk.
 */
/** Candles that fit the sheet at a readable width: the chart is ~330px wide on phones, ~580px on desktop. */
function targetBars() {
  return typeof window !== 'undefined' && window.innerWidth >= 768 ? 80 : 45
}

export function loadTradeChart(id: string, force = false): Promise<TradeChartData> {
  const bars = targetBars()
  const key = `${id}:${bars}`
  const hit = cache.get(key)
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.promise
  const promise = fetch(`/api/trade-chart?id=${encodeURIComponent(id)}&bars=${bars}`).then(async (res) => {
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.error || 'Kursdaten konnten nicht geladen werden.')
    return body as TradeChartData
  })
  promise.catch(() => cache.delete(key))
  cache.set(key, { at: Date.now(), promise })
  return promise
}
