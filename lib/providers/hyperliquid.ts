import {
  fetchAllFills,
  buildTradesFromFills,
  fetchClearinghouseState,
  fetchSpotClearinghouseState
} from '../hyperliquid'
import type { Connection, ConnectionSyncResult, HoldingSnapshot } from './types'

/**
 * Syncs a Hyperliquid connection: perp fills reconstructed into round-trip trades,
 * every non-USDC spot balance captured as a holding (USDC is cash, not a holding —
 * "gelagerte Kryptos" like ETH/BTC sitting in the spot wallet were previously invisible),
 * and cash equity reported the same way the dashboard always computed it: the spot USDC
 * balance. Hyperliquid mirrors USDC locked as perps margin into the spot "hold" amount, so
 * perps accountValue and spot USDC total already represent the same money — summing both
 * would double-count it.
 */
export async function syncHyperliquidConnection(connection: Connection): Promise<ConnectionSyncResult> {
  const wallet = connection.walletAddress
  if (!wallet) throw new Error(`Connection "${connection.label}" has no wallet address configured`)

  const [fills, perps, spot] = await Promise.all([
    fetchAllFills(wallet),
    fetchClearinghouseState(wallet),
    fetchSpotClearinghouseState(wallet)
  ])

  const trades = buildTradesFromFills(fills, wallet).map((t) => ({
    ...t,
    externalId: `${connection.id}-${t.externalId}`
  }))

  const spotUsdc = spot.balances.find((b) => b.coin === 'USDC')
  const spotUsdcTotal = spotUsdc ? parseFloat(spotUsdc.total) : 0
  const spotUsdcHold = spotUsdc ? parseFloat(spotUsdc.hold) : 0
  const perpWithdrawable = parseFloat(perps.withdrawable) || 0

  const holdings: HoldingSnapshot[] = spot.balances
    .filter((b) => b.coin !== 'USDC')
    .map((b) => ({ symbol: b.coin, quantity: parseFloat(b.total) }))
    .filter((b) => Number.isFinite(b.quantity) && Math.abs(b.quantity) > 1e-8)
    .map((b) => ({
      connectionId: connection.id,
      symbol: b.symbol,
      assetClass: 'crypto' as const,
      quantity: b.quantity,
      avgCost: null
    }))

  return {
    trades,
    holdings,
    transactions: [],
    cashEquity: spotUsdcTotal,
    cashWithdrawable: spotUsdcTotal - spotUsdcHold + perpWithdrawable
  }
}
