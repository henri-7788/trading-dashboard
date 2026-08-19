import { NextApiRequest, NextApiResponse } from 'next'
import { Query } from 'node-appwrite'
import {
  databases,
  DATABASE_ID,
  TRADES_COLLECTION_ID,
  SYNC_STATE_COLLECTION_ID,
  CONNECTIONS_COLLECTION_ID,
  HOLDINGS_COLLECTION_ID,
  TRANSACTIONS_COLLECTION_ID
} from '../../lib/appwriteServer'
import { upsert, docIdFor, dedupeByExternalId } from '../../lib/upsert'
import { syncHyperliquidConnection } from '../../lib/providers/hyperliquid'
import { syncCcxtConnection } from '../../lib/providers/ccxt'
import type { Connection, ConnectionSyncResult } from '../../lib/providers/types'

function toConnection(d: any): Connection {
  return {
    id: d.$id,
    type: d.type,
    label: d.label,
    exchangeId: d.exchangeId || '',
    walletAddress: d.walletAddress || '',
    apiKeyEnc: d.apiKeyEnc || '',
    apiSecretEnc: d.apiSecretEnc || '',
    passwordEnc: d.passwordEnc || '',
    symbols: d.symbols || '',
    enabled: d.enabled,
    createdAt: d.createdAt
  }
}

async function syncConnectionHoldings(connection: Connection, result: ConnectionSyncResult) {
  const existing = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: HOLDINGS_COLLECTION_ID,
    queries: [Query.equal('connectionId', connection.id), Query.limit(500)]
  })
  const freshSymbols = new Set(result.holdings.map((h) => h.symbol))

  await Promise.all(
    result.holdings.map((h) =>
      upsert(HOLDINGS_COLLECTION_ID, docIdFor(`${connection.id}-${h.symbol}`), {
        connectionId: connection.id,
        symbol: h.symbol,
        assetClass: h.assetClass,
        quantity: h.quantity,
        avgCost: h.avgCost,
        updatedAt: new Date().toISOString()
      })
    )
  )

  const stale = existing.documents.filter((d) => !freshSymbols.has(d.symbol))
  await Promise.all(stale.map((d) => databases.deleteDocument({ databaseId: DATABASE_ID, collectionId: HOLDINGS_COLLECTION_ID, documentId: d.$id })))
}

async function syncOneConnection(connection: Connection) {
  const result =
    connection.type === 'hyperliquid' ? await syncHyperliquidConnection(connection) : await syncCcxtConnection(connection)

  const trades = dedupeByExternalId(result.trades)
  const transactions = dedupeByExternalId(result.transactions)

  await Promise.all([
    ...trades.map((t) => upsert(TRADES_COLLECTION_ID, docIdFor(t.externalId), { ...t, connectionId: connection.id })),
    ...transactions.map((t) => upsert(TRANSACTIONS_COLLECTION_ID, docIdFor(t.externalId), { ...t })),
    syncConnectionHoldings(connection, result)
  ])

  await upsert(SYNC_STATE_COLLECTION_ID, docIdFor(connection.id), {
    connectionId: connection.id,
    wallet: connection.walletAddress || '',
    lastFillTime: 0,
    lastSyncedAt: new Date().toISOString(),
    status: 'ok',
    error: '',
    cashEquity: result.cashEquity,
    cashWithdrawable: result.cashWithdrawable
  })

  return { trades: trades.length, holdings: result.holdings.length, transactions: transactions.length }
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

  try {
    const connectionsResult = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: CONNECTIONS_COLLECTION_ID,
      queries: [Query.equal('enabled', true), Query.limit(100)]
    })
    const connections = connectionsResult.documents.map(toConnection)

    if (connections.length === 0) {
      return res.status(200).json({ success: true, connections: 0, results: [] })
    }

    const results = await Promise.all(
      connections.map(async (connection) => {
        try {
          const summary = await syncOneConnection(connection)
          return { connectionId: connection.id, label: connection.label, ok: true, ...summary }
        } catch (err: any) {
          console.error(`sync failed for connection ${connection.label}`, err)
          try {
            await upsert(SYNC_STATE_COLLECTION_ID, docIdFor(connection.id), {
              connectionId: connection.id,
              wallet: connection.walletAddress || '',
              lastFillTime: 0,
              lastSyncedAt: new Date().toISOString(),
              status: 'error',
              error: String(err.message || err).slice(0, 500)
            })
          } catch (writeErr) {
            console.error(`failed to persist error state for connection ${connection.label}`, writeErr)
          }
          return { connectionId: connection.id, label: connection.label, ok: false, error: err.message || String(err) }
        }
      })
    )

    const anyFailed = results.some((r) => !r.ok)
    return res.status(anyFailed ? 207 : 200).json({ success: !anyFailed, connections: connections.length, results })
  } catch (err: any) {
    console.error('sync failed', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
