import { Query } from 'node-appwrite'
import {
  databases,
  DATABASE_ID,
  CONNECTIONS_COLLECTION_ID,
  HOLDINGS_COLLECTION_ID,
  TRANSACTIONS_COLLECTION_ID,
  SYNC_STATE_COLLECTION_ID
} from './appwriteServer'
import { fetchCryptoPrice, fetchStockPrice } from './pricing'
import type { AssetClass } from './transactions'

export interface HoldingView {
  source: string
  sourceLabel: string
  symbol: string
  name: string
  assetClass: AssetClass
  quantity: number
  avgCost: number | null
  price: number | null
  value: number | null
  unrealizedPnl: number | null
}

export interface EquitySummary {
  totalEquity: number
  cashTotal: number
  cashWithdrawable: number
  holdingsValue: number
  holdings: HoldingView[]
  connections: { id: string; label: string; type: string; cashEquity: number; cashWithdrawable: number }[]
}

async function listAll(collectionId: string, queries: string[] = []) {
  const docs: any[] = []
  let cursor: string | undefined
  for (;;) {
    const q = [...queries, Query.limit(100)]
    if (cursor) q.push(Query.cursorAfter(cursor))
    const result = await databases.listDocuments({ databaseId: DATABASE_ID, collectionId, queries: q })
    docs.push(...result.documents)
    if (result.documents.length < 100) break
    cursor = result.documents[result.documents.length - 1].$id
  }
  return docs
}

/** Aggregates manual transactions into net positions per symbol using weighted-average cost. */
function aggregateManualHoldings(transactions: any[]): HoldingView[] {
  const manual = transactions.filter((t) => t.source === 'manual')
  const bySymbol = new Map<string, { symbol: string; name: string; assetClass: AssetClass; qty: number; cost: number }>()

  for (const t of manual) {
    const key = t.symbol
    let pos = bySymbol.get(key)
    if (!pos) {
      pos = { symbol: t.symbol, name: t.name || t.symbol, assetClass: t.assetClass, qty: 0, cost: 0 }
      bySymbol.set(key, pos)
    }
    if (t.side === 'buy') {
      pos.qty += t.quantity
      pos.cost += t.quantity * t.price + t.fee
    } else {
      // Selling reduces quantity and cost basis proportionally, realized P/L isn't tracked here —
      // this view only shows the current position, not the trade journal's realized history.
      const avg = pos.qty > 0 ? pos.cost / pos.qty : 0
      pos.qty -= t.quantity
      pos.cost -= avg * t.quantity
    }
  }

  const views: HoldingView[] = []
  for (const pos of bySymbol.values()) {
    if (Math.abs(pos.qty) < 1e-8) continue
    views.push({
      source: 'manual',
      sourceLabel: 'Manuell',
      symbol: pos.symbol,
      name: pos.name,
      assetClass: pos.assetClass,
      quantity: pos.qty,
      avgCost: pos.qty > 0 ? pos.cost / pos.qty : null,
      price: null,
      value: null,
      unrealizedPnl: null
    })
  }
  return views
}

async function priceFor(h: HoldingView): Promise<number | null> {
  if (h.assetClass === 'crypto') return fetchCryptoPrice(h.symbol)
  if (h.assetClass === 'stock' || h.assetClass === 'etf') return fetchStockPrice(h.symbol)
  return null
}

/** Computes total equity across every connection's cash balance plus every priced holding. */
export async function computeEquity(): Promise<EquitySummary> {
  const [connections, syncStates, holdingDocs, transactionDocs] = await Promise.all([
    listAll(CONNECTIONS_COLLECTION_ID),
    listAll(SYNC_STATE_COLLECTION_ID),
    listAll(HOLDINGS_COLLECTION_ID),
    listAll(TRANSACTIONS_COLLECTION_ID)
  ])

  const labelById = new Map(connections.map((c) => [c.$id, c.label as string]))
  const typeById = new Map(connections.map((c) => [c.$id, c.type as string]))

  const connectionSummaries = syncStates.map((s) => ({
    id: s.connectionId,
    label: labelById.get(s.connectionId) || s.connectionId,
    type: typeById.get(s.connectionId) || 'unknown',
    cashEquity: s.cashEquity || 0,
    cashWithdrawable: s.cashWithdrawable || 0
  }))

  const cashTotal = connectionSummaries.reduce((sum, c) => sum + c.cashEquity, 0)
  const cashWithdrawable = connectionSummaries.reduce((sum, c) => sum + c.cashWithdrawable, 0)

  const syncedHoldings: HoldingView[] = holdingDocs.map((h) => ({
    source: h.connectionId,
    sourceLabel: labelById.get(h.connectionId) || h.connectionId,
    symbol: h.symbol,
    name: h.symbol,
    assetClass: h.assetClass,
    quantity: h.quantity,
    avgCost: h.avgCost ?? null,
    price: null,
    value: null,
    unrealizedPnl: null
  }))

  const manualHoldings = aggregateManualHoldings(transactionDocs)
  const holdings = [...syncedHoldings, ...manualHoldings]

  await Promise.all(
    holdings.map(async (h) => {
      const price = await priceFor(h)
      h.price = price
      if (price != null) {
        h.value = price * h.quantity
        h.unrealizedPnl = h.avgCost != null ? (price - h.avgCost) * h.quantity : null
      }
    })
  )

  const holdingsValue = holdings.reduce((sum, h) => sum + (h.value || 0), 0)

  return {
    totalEquity: cashTotal + holdingsValue,
    cashTotal,
    cashWithdrawable,
    holdingsValue,
    holdings: holdings.sort((a, b) => (b.value || 0) - (a.value || 0)),
    connections: connectionSummaries
  }
}
