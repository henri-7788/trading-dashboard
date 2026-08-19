import type { Trade } from '../hyperliquid'

export type ConnectionType = 'hyperliquid' | 'ccxt'

export interface Connection {
  id: string
  type: ConnectionType
  label: string
  exchangeId: string
  walletAddress: string
  apiKeyEnc: string
  apiSecretEnc: string
  passwordEnc: string
  symbols: string
  enabled: boolean
  createdAt: string
}

export interface HoldingSnapshot {
  connectionId: string
  symbol: string
  assetClass: 'crypto' | 'stock' | 'etf' | 'other'
  quantity: number
  avgCost: number | null
}

export interface TransactionRecord {
  source: string
  externalId: string
  symbol: string
  name: string
  assetClass: 'crypto' | 'stock' | 'etf' | 'other'
  side: 'buy' | 'sell'
  quantity: number
  price: number
  fee: number
  executedAt: string
  notes: string
}

export interface ConnectionSyncResult {
  trades: Trade[]
  holdings: HoldingSnapshot[]
  transactions: TransactionRecord[]
  /** Cash-like equity this connection reports directly (e.g. Hyperliquid spot USDC balance). */
  cashEquity: number
  /** Portion of cashEquity that is freely withdrawable right now. */
  cashWithdrawable: number
}
