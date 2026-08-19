import ccxt, { Exchange } from 'ccxt'
import { decryptSecret } from '../crypto'
import type { Connection, ConnectionSyncResult, HoldingSnapshot, TransactionRecord } from './types'

/** Every exchange id ccxt can talk to — the full "add any exchange" list for Settings. */
export const SUPPORTED_EXCHANGES: string[] = ccxt.exchanges.slice().sort()

export function isSupportedExchange(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ccxt, id)
}

function buildExchange(connection: Connection) {
  const ExchangeClass = (ccxt as unknown as Record<string, new (config: Record<string, unknown>) => Exchange>)[
    connection.exchangeId
  ]
  if (!ExchangeClass) throw new Error(`Unknown exchange "${connection.exchangeId}"`)

  const config: Record<string, unknown> = { enableRateLimit: true }
  if (connection.apiKeyEnc) config.apiKey = decryptSecret(connection.apiKeyEnc)
  if (connection.apiSecretEnc) config.secret = decryptSecret(connection.apiSecretEnc)
  if (connection.passwordEnc) config.password = decryptSecret(connection.passwordEnc)

  return new ExchangeClass(config)
}

/**
 * Syncs a ccxt-backed exchange connection: fetchBalance is the source of truth for current
 * holdings (works uniformly across exchanges), and fetchMyTrades per configured symbol builds
 * the transaction journal where the exchange supports it. Not every exchange supports scanning
 * trade history without a symbol, so symbols to sync are configured per connection.
 */
export async function syncCcxtConnection(connection: Connection): Promise<ConnectionSyncResult> {
  const exchange = buildExchange(connection)

  const balance = await exchange.fetchBalance()
  const totals = (balance.total || {}) as Record<string, number>
  const holdings: HoldingSnapshot[] = Object.entries(totals)
    .filter(([, qty]) => Number.isFinite(qty) && Math.abs(qty) > 1e-8)
    .map(([symbol, qty]) => ({
      connectionId: connection.id,
      symbol,
      assetClass: 'crypto' as const,
      quantity: qty,
      avgCost: null
    }))

  const transactions: TransactionRecord[] = []
  const symbols = connection.symbols
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (symbols.length > 0 && exchange.has['fetchMyTrades']) {
    for (const symbol of symbols) {
      try {
        const trades = await exchange.fetchMyTrades(symbol)
        for (const t of trades) {
          if (!t.id || !t.side || !t.amount || !t.price) continue
          transactions.push({
            source: connection.id,
            externalId: `${connection.id}-${t.id}`,
            symbol,
            name: '',
            assetClass: 'crypto',
            side: t.side === 'sell' ? 'sell' : 'buy',
            quantity: t.amount,
            price: t.price,
            fee: t.fee?.cost || 0,
            executedAt: new Date(t.timestamp || Date.now()).toISOString(),
            notes: ''
          })
        }
      } catch (err) {
        console.error(`fetchMyTrades failed for ${connection.label} ${symbol}`, err)
      }
    }
  }

  return { trades: [], holdings, transactions, cashEquity: 0, cashWithdrawable: 0 }
}

/** Fetches a live last price for a crypto symbol, trying common USD-quoted pairs. */
export async function fetchCryptoLastPrice(symbol: string, exchangeId = 'binance'): Promise<number | null> {
  try {
    const ExchangeClass = (ccxt as unknown as Record<string, new (config: Record<string, unknown>) => Exchange>)[
      exchangeId
    ]
    if (!ExchangeClass) return null
    const exchange = new ExchangeClass({ enableRateLimit: true })
    for (const quote of ['USDT', 'USD', 'USDC']) {
      const pair = `${symbol}/${quote}`
      try {
        const ticker = await exchange.fetchTicker(pair)
        if (typeof ticker.last === 'number') return ticker.last
      } catch {
        continue
      }
    }
    return null
  } catch (err) {
    console.error(`price lookup failed for ${symbol}`, err)
    return null
  }
}
