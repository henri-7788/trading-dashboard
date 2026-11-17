import { NextApiRequest, NextApiResponse } from 'next'
import { databases, DATABASE_ID, TRADES_COLLECTION_ID, CONNECTIONS_COLLECTION_ID } from '../../lib/appwriteServer'
import { fetchCandles, fetchFillsBetween, pickInterval, type Candle } from '../../lib/hyperliquid'

export interface TradeChartFill {
  t: number
  px: number
  sz: number
  dir: string
  closedPnl: number
}

export interface TradeChartData {
  interval: string
  intervalMs: number
  candles: Candle[]
  /** Executions of this position; empty when the wallet is unknown. */
  fills: TradeChartFill[]
}

const OPEN_TTL_MS = 30_000
const cache = new Map<string, { at: number; closed: boolean; data: TradeChartData }>()

async function build(id: string, bars: number): Promise<{ data: TradeChartData; final: boolean }> {
  const doc: any = await databases.getDocument({ databaseId: DATABASE_ID, collectionId: TRADES_COLLECTION_ID, documentId: id })
  const now = Date.now()
  const opened = new Date(doc.openedAt).getTime()
  const closed = doc.status === 'closed' && doc.closedAt ? new Date(doc.closedAt).getTime() : now

  // Show some context before the entry and after the exit; open trades end at "now".
  const duration = Math.max(closed - opened, 60_000)
  const pad = duration * 0.25
  const start = opened - pad
  const end = doc.status === 'closed' ? Math.min(closed + pad, now) : now
  const { interval, ms } = pickInterval(end - start, now - start + 30 * 60_000, bars)
  // At least ~30 candles so very short trades still have a readable chart.
  const minSpan = ms * Math.min(30, bars)
  const span = end - start
  const windowStart = span < minSpan ? start - (minSpan - span) / 2 : start
  const windowEnd = span < minSpan ? Math.min(end + (minSpan - span) / 2, now) : end

  let wallet: string | null = null
  if (doc.connectionId) {
    try {
      const conn: any = await databases.getDocument({ databaseId: DATABASE_ID, collectionId: CONNECTIONS_COLLECTION_ID, documentId: doc.connectionId })
      wallet = conn.walletAddress || null
    } catch {
      wallet = null
    }
  }

  const [candles, rawFills] = await Promise.all([
    fetchCandles(doc.coin, interval, Math.floor(windowStart), Math.ceil(windowEnd)),
    wallet ? fetchFillsBetween(wallet, opened - 1000, closed + 1000).catch(() => []) : Promise.resolve([])
  ])

  const fills = rawFills
    .filter((f) => f.coin === doc.coin)
    .map((f) => ({ t: f.time, px: +f.px, sz: +f.sz, dir: f.dir, closedPnl: +f.closedPnl || 0 }))

  // A closed trade whose padded window lies fully in the past never changes again.
  const final = doc.status === 'closed' && windowEnd < now - ms
  return { data: { interval, intervalMs: ms, candles, fills }, final }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.cookies?.trading_auth !== '1') return res.status(401).json({ error: 'unauthorized' })
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }
  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!id) return res.status(400).json({ error: 'id fehlt' })

  // The client asks for as many candles as fit its width (phones fewer, so candles stay readable).
  const bars = Math.min(150, Math.max(20, Number(req.query.bars) || 90))
  const key = `v2:${id}:${bars}`
  const hit = cache.get(key)
  if (hit && (hit.closed || Date.now() - hit.at < OPEN_TTL_MS)) return res.status(200).json(hit.data)

  try {
    const { data, final } = await build(id, bars)
    cache.set(key, { at: Date.now(), closed: final, data })
    return res.status(200).json(data)
  } catch (err: any) {
    const msg = String(err?.message || err)
    console.error('trade-chart failed:', msg.slice(0, 200))
    if (hit) return res.status(200).json(hit.data)
    return res.status(502).json({ error: msg.includes('429') ? 'Hyperliquid limitiert gerade Anfragen – bitte gleich erneut versuchen.' : 'Kursdaten konnten nicht geladen werden.' })
  }
}
