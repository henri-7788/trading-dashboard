import { NextApiRequest, NextApiResponse } from 'next'
import { Query } from 'node-appwrite'
import { databases, DATABASE_ID, TRADES_COLLECTION_ID, SYNC_STATE_COLLECTION_ID, CONNECTIONS_COLLECTION_ID } from '../../lib/appwriteServer'
import { fetchAllDexMids, fetchAllDexPositions } from '../../lib/hyperliquid'

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

    const [connectionsResult, syncStatesResult] = await Promise.all([
      databases.listDocuments({ databaseId: DATABASE_ID, collectionId: CONNECTIONS_COLLECTION_ID, queries: [Query.limit(100)] }),
      databases.listDocuments({ databaseId: DATABASE_ID, collectionId: SYNC_STATE_COLLECTION_ID, queries: [Query.limit(100)] })
    ])
    const labelById = new Map(connectionsResult.documents.map((c) => [c.$id, c.label as string]))
    const walletByConnectionId = new Map(
      connectionsResult.documents.filter((c) => c.walletAddress).map((c) => [c.$id, c.walletAddress as string])
    )

    const lastSyncedAt =
      syncStatesResult.documents
        .map((s) => s.lastSyncedAt as string | null)
        .filter((d): d is string => Boolean(d))
        .sort()
        .pop() || null

    const trades = pages.map((d) => mapDoc(d, labelById))

    const openTrades = trades.filter((t) => t.status === 'open')
    if (openTrades.length > 0) {
      // Mark price for display purposes (independent of wallet).
      try {
        const mids = await fetchAllDexMids()
        for (const t of openTrades) {
          const mark = parseFloat(mids[t.coin])
          if (Number.isFinite(mark)) t.markPrice = mark
        }
      } catch (err) {
        console.error('failed to fetch mark prices', err)
      }

      // PnL, ROE, margin, liquidation price and funding all move continuously (funding accrues
      // every hour, margin/leverage can be adjusted any time), so the values persisted at last sync
      // can be stale or even wrong-signed by the time this loads. Pull them fresh from Hyperliquid's
      // clearinghouseState per wallet, straight from the same fields the Hyperliquid UI itself reads
      // (unrealizedPnl, returnOnEquity, marginUsed, liquidationPx, cumFunding.sinceOpen) so the
      // numbers match exactly instead of being independently recomputed.
      const walletsToQuery = new Set(
        openTrades.map((t) => (t.connectionId ? walletByConnectionId.get(t.connectionId) : undefined)).filter((w): w is string => Boolean(w))
      )
      const positionsByWallet = new Map<string, Awaited<ReturnType<typeof fetchAllDexPositions>>>()
      await Promise.all(
        Array.from(walletsToQuery).map(async (wallet) => {
          try {
            positionsByWallet.set(wallet, await fetchAllDexPositions(wallet))
          } catch (err) {
            console.error(`failed to fetch live positions for wallet ${wallet}`, err)
          }
        })
      )

      for (const t of openTrades) {
        const wallet = t.connectionId ? walletByConnectionId.get(t.connectionId) : undefined
        const info = wallet ? positionsByWallet.get(wallet)?.get(t.coin) : undefined
        if (!info) continue
        t.realizedPnl = t.pnl
        if (info.unrealizedPnl != null) t.pnl = info.unrealizedPnl
        t.roe = info.roePct
        t.leverage = info.leverage
        t.liquidationPrice = info.liquidationPrice
        t.margin = info.margin
        t.fundingFee = info.fundingFee
      }
    }

    return res.status(200).json({ trades, lastSyncedAt })
  } catch (err: any) {
    console.error('trades fetch failed', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}

function mapDoc(d: any, labelById: Map<string, string>) {
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
    realizedPnl: null as number | null,
    roe: null as number | null,
    fee: d.fee,
    fillsCount: d.fillsCount,
    openedAt: d.openedAt,
    closedAt: d.closedAt,
    leverage: d.leverage ?? null,
    liquidationPrice: d.liquidationPrice ?? null,
    margin: d.margin ?? null,
    fundingFee: d.fundingFee ?? null,
    connectionId: d.connectionId || null,
    connectionLabel: d.connectionId ? labelById.get(d.connectionId) || d.connectionId : null
  }
}
