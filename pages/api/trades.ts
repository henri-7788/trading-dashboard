import { NextApiRequest, NextApiResponse } from 'next'
import { Query } from 'node-appwrite'
import { databases, DATABASE_ID, TRADES_COLLECTION_ID, SYNC_STATE_COLLECTION_ID } from '../../lib/appwriteServer'
import { fetchMids } from '../../lib/hyperliquid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS
    const pages: any[] = []
    let cursor: string | undefined

    for (;;) {
      const queries = [Query.orderDesc('openedAt'), Query.limit(100)]
      if (cursor) queries.push(Query.cursorAfter(cursor))
      const result = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: TRADES_COLLECTION_ID,
        queries
      })
      pages.push(...result.documents)
      if (result.documents.length < 100) break
      cursor = result.documents[result.documents.length - 1].$id
    }

    let lastSyncedAt: string | null = null
    if (wallet) {
      try {
        const state = await databases.listDocuments({
          databaseId: DATABASE_ID,
          collectionId: SYNC_STATE_COLLECTION_ID,
          queries: [Query.equal('wallet', wallet), Query.limit(1)]
        })
        lastSyncedAt = state.documents[0]?.lastSyncedAt || null
      } catch {
        lastSyncedAt = null
      }
    }

    const trades = pages.map(mapDoc)

    const openCoins = new Set(trades.filter((t) => t.status === 'open').map((t) => t.coin))
    if (openCoins.size > 0) {
      try {
        const mids = await fetchMids()
        for (const t of trades) {
          if (t.status !== 'open') continue
          const mark = parseFloat(mids[t.coin])
          if (!Number.isFinite(mark)) continue
          const unrealizedPnl = t.side === 'long' ? (mark - t.entryPrice) * t.size : (t.entryPrice - mark) * t.size
          t.markPrice = mark
          t.pnl += unrealizedPnl
        }
      } catch (err) {
        console.error('failed to fetch mark prices', err)
      }
    }

    return res.status(200).json({ trades, lastSyncedAt, wallet: wallet || null })
  } catch (err: any) {
    console.error('trades fetch failed', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}

function mapDoc(d: any) {
  return {
    id: d.$id,
    externalId: d.externalId,
    coin: d.coin,
    side: d.side,
    status: d.status,
    entryPrice: d.entryPrice,
    exitPrice: d.exitPrice,
    markPrice: null as number | null,
    size: d.size,
    notional: d.notional,
    pnl: d.pnl,
    fee: d.fee,
    fillsCount: d.fillsCount,
    openedAt: d.openedAt,
    closedAt: d.closedAt
  }
}
