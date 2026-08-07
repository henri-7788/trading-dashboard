import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { databases, DATABASE_ID, TRADES_COLLECTION_ID, SYNC_STATE_COLLECTION_ID } from '../../lib/appwriteServer'
import { fetchAllFills, buildTradesFromFills } from '../../lib/hyperliquid'

function docIdFor(externalId: string) {
  return crypto.createHash('sha1').update(externalId).digest('hex').slice(0, 36)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS
  if (!wallet) {
    return res.status(500).json({ error: 'HYPERLIQUID_WALLET_ADDRESS is not configured' })
  }

  try {
    const fills = await fetchAllFills(wallet)
    const trades = buildTradesFromFills(fills, wallet)

    let synced = 0
    for (const trade of trades) {
      const documentId = docIdFor(trade.externalId)
      try {
        await databases.createDocument({
          databaseId: DATABASE_ID,
          collectionId: TRADES_COLLECTION_ID,
          documentId,
          data: trade
        })
      } catch (err: any) {
        if (err.code === 409) {
          await databases.updateDocument({
            databaseId: DATABASE_ID,
            collectionId: TRADES_COLLECTION_ID,
            documentId,
            data: trade
          })
        } else {
          throw err
        }
      }
      synced++
    }

    const syncStateId = crypto.createHash('sha1').update(wallet).digest('hex').slice(0, 36)
    try {
      await databases.createDocument({
        databaseId: DATABASE_ID,
        collectionId: SYNC_STATE_COLLECTION_ID,
        documentId: syncStateId,
        data: { wallet, lastFillTime: fills.length ? fills[fills.length - 1].time : 0, lastSyncedAt: new Date().toISOString() }
      })
    } catch (err: any) {
      if (err.code === 409) {
        await databases.updateDocument({
          databaseId: DATABASE_ID,
          collectionId: SYNC_STATE_COLLECTION_ID,
          documentId: syncStateId,
          data: { wallet, lastFillTime: fills.length ? fills[fills.length - 1].time : 0, lastSyncedAt: new Date().toISOString() }
        })
      } else {
        throw err
      }
    }

    return res.status(200).json({ success: true, fills: fills.length, trades: synced })
  } catch (err: any) {
    console.error('sync failed', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
