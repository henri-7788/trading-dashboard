/**
 * Trade and holding types, formatting, and the pure analytics behind the Trading view.
 * Client-safe: no server imports. Everything here works on the trades the dashboard already loaded.
 */

export interface Trade {
  id: string
  externalId: string
  coin: string
  side: 'long' | 'short'
  status: 'open' | 'closed'
  entryPrice: number
  exitPrice: number | null
  size: number
  notional: number
  pnl: number
  /** Realized PnL banked from partial closes on this position before the current live snapshot; only set for open trades. */
  realizedPnl: number | null
  /** Return on equity in %, pulled directly from Hyperliquid's own returnOnEquity field; only set for open trades. */
  roe: number | null
  fee: number
  fillsCount: number
  openedAt: string
  closedAt: string | null
  connectionLabel: string | null
  leverage: number | null
  liquidationPrice: number | null
  margin: number | null
  fundingFee: number | null
  markPrice: number | null
}

export interface Holding {
  source: string
  sourceLabel: string
  symbol: string
  name: string
  assetClass: 'crypto' | 'stock' | 'etf' | 'other'
  quantity: number
  avgCost: number | null
  price: number | null
  value: number | null
  unrealizedPnl: number | null
}

export const ASSET_CLASS_LABEL: Record<string, string> = {
  crypto: 'Krypto',
  stock: 'Aktie',
  etf: 'ETF',
  other: 'Sonstiges'
}

export type HoldingSortKey = 'name' | 'assetClass' | 'source' | 'quantity' | 'price' | 'value' | 'unrealizedPnl'

export type SortDir = 'asc' | 'desc'

export const HOLDING_COLUMNS: { key: HoldingSortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Asset', numeric: false },
  { key: 'assetClass', label: 'Typ', numeric: false },
  { key: 'source', label: 'Quelle', numeric: false },
  { key: 'quantity', label: 'Menge', numeric: true },
  { key: 'price', label: 'Kurs', numeric: true },
  { key: 'value', label: 'Wert', numeric: true },
  { key: 'unrealizedPnl', label: 'Unrealisiert', numeric: true }
]

/** Rows visible while the holdings table is collapsed. */
export const HOLDINGS_COLLAPSED_COUNT = 4

export function holdingSortValue(h: Holding, key: HoldingSortKey): string | number | null {
  switch (key) {
    case 'name':
      return (h.name && h.name !== h.symbol ? h.name : h.symbol).toLowerCase()
    case 'assetClass':
      return ASSET_CLASS_LABEL[h.assetClass]
    case 'source':
      return h.sourceLabel.toLowerCase()
    default:
      return h[key]
  }
}

/** Sorts holdings by the given column; missing values always sink to the bottom regardless of direction. */
export function sortHoldings(holdings: Holding[], key: HoldingSortKey, dir: SortDir): Holding[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...holdings].sort((a, b) => {
    const va = holdingSortValue(a, key)
    const vb = holdingSortValue(b, key)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
    return String(va).localeCompare(String(vb), 'de') * factor
  })
}

export type Range = 'all' | '30d' | '7d' | '24h'

export type StatusFilter = 'all' | 'open' | 'closed'

export type SideFilter = 'all' | 'long' | 'short'

export const RANGE_MS: Record<Exclude<Range, 'all'>, number> = {
  '30d': 1000 * 60 * 60 * 24 * 30,
  '7d': 1000 * 60 * 60 * 24 * 7,
  '24h': 1000 * 60 * 60 * 24
}

export const RANGE_LABEL: Record<Exclude<Range, 'all'>, string> = {
  '30d': '30 Tage',
  '7d': '7 Tage',
  '24h': '24 Stunden'
}

export const MASK = '•••••'

export const HIDE_VALUES_KEY = 'trading-dashboard:hide-values'

export function fmtUsd(n: number) {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** PnL relative to margin, i.e. ROI on the capital actually at risk. Prefers Hyperliquid's own live returnOnEquity so it matches the exchange exactly; falls back to margin/notional-based estimates for closed trades or when live data is unavailable. */
export function pnlPct(t: Trade): number | null {
  if (t.roe != null) return t.roe
  const margin = t.margin ?? (t.leverage ? t.notional / t.leverage : t.notional)
  if (!margin) return null
  return (t.pnl / margin) * 100
}

export function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : '-'
  return `${sign}${Math.abs(n).toFixed(1)}%`
}

/** How close the trade's mark price is to its liquidation price, as a fraction of the mark price (0 = at liquidation). Only meaningful for open trades. */
export function liquidationDistancePct(t: Trade): number | null {
  if (t.status !== 'open' || t.liquidationPrice == null || t.markPrice == null || t.markPrice === 0) return null
  return (Math.abs(t.markPrice - t.liquidationPrice) / t.markPrice) * 100
}

/**
 * Fraction of the original entry-to-liquidation price buffer that's still left, using the current
 * mark price. 1.0 = same distance as at entry, >1 = price has moved favorably and the buffer grew,
 * <1 = price has moved against the position and eaten into the buffer, 0 = at liquidation.
 * Raw price-distance-to-liquidation isn't leverage-aware — at 15x, liquidation sits only ~6-7% from
 * entry by construction, so a plain "% away from liquidation" threshold flags every high-leverage
 * trade as risky even when it's deep in profit. Comparing against the buffer at entry fixes that.
 */
export function liquidationBufferRatio(t: Trade): number | null {
  if (t.status !== 'open' || t.liquidationPrice == null || t.markPrice == null) return null
  const bufferAtEntry = Math.abs(t.entryPrice - t.liquidationPrice)
  if (bufferAtEntry === 0) return null
  const bufferNow = Math.abs(t.markPrice - t.liquidationPrice)
  return bufferNow / bufferAtEntry
}

/** Liquidation risk tier for a trade, independent of PnL sign — based on how much of the entry buffer to liquidation is left, not raw price distance. */
export function liquidationRisk(t: Trade): 'critical' | 'warning' | 'caution' | null {
  const ratio = liquidationBufferRatio(t)
  if (ratio == null) return null
  if (ratio <= 0.15) return 'critical'
  if (ratio <= 0.35) return 'warning'
  if (ratio <= 0.6) return 'caution'
  return null
}

export const LIQUIDATION_RISK_STYLE: Record<'critical' | 'warning' | 'caution', string> = {
  critical: 'text-down animate-pulse',
  warning: 'text-down',
  caution: 'text-amber'
}

export const LIQUIDATION_RISK_LABEL: Record<'critical' | 'warning' | 'caution', string> = {
  critical: 'Sehr nah am Liquidationslevel',
  warning: 'Nah am Liquidationslevel',
  caution: 'Nähert sich dem Liquidationslevel'
}

export function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtDuration(openedAt: string, closedAt: string | null) {
  if (!closedAt) return '—'
  return fmtDurationMs(new Date(closedAt).getTime() - new Date(openedAt).getTime())
}

export function fmtDurationMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const days = Math.floor(ms / 86400000)
  ms -= days * 86400000
  const hours = Math.floor(ms / 3600000)
  ms -= hours * 3600000
  const minutes = Math.floor(ms / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// ── PnL parts ──────────────────────────────────────────────────────────────────────────────
//
// A closed trade's `pnl` is its realized result (net of fees). For an open position, /api/trades
// replaces `pnl` with Hyperliquid's live unrealized PnL and moves what was already banked from
// partial closes (net of all fees so far) into `realizedPnl`. Totals must count both parts.

/** Realized result: the whole PnL of a closed trade, or the partial-close profit of an open one. */
export function realizedOf(t: Trade) {
  return t.status === 'closed' ? t.pnl : t.realizedPnl ?? 0
}

/** Live unrealized PnL of an open position; 0 for closed trades. */
export function unrealizedOf(t: Trade) {
  return t.status === 'open' ? t.pnl : 0
}

/** Everything the trade has earned so far: realized plus still-open. */
export function totalPnlOf(t: Trade) {
  return realizedOf(t) + unrealizedOf(t)
}

/** True when an open position has had partial closes (realized PnL beyond just paying fees). */
export function hasPartialCloses(t: Trade) {
  return t.status === 'open' && t.realizedPnl != null && Math.abs(t.realizedPnl + (t.fee || 0)) > 1e-6
}

// ── Analytics ───────────────────────────────────────────────────────────────────────────────

export interface TradeSummary {
  /** Realized (closed + partial closes) plus unrealized of open positions. */
  totalPnl: number
  /** Banked from partial closes of positions that are still open. */
  openRealized: number
  /** Live unrealized PnL of open positions. */
  openUnrealized: number
  open: number
  closed: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  best: number
  worst: number
  avgDurationMs: number
  /** Average result per closed trade: winRate × avgWin − lossRate × avgLoss. */
  expectancy: number
  /** avgWin / avgLoss. */
  payoff: number
  longestWinStreak: number
  longestLossStreak: number
  fees: number
}

export function closedChronological(trades: Trade[]) {
  return trades
    .filter((t) => t.status === 'closed' && t.closedAt)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())
}

export function summarize(trades: Trade[]): TradeSummary {
  const totalPnl = trades.reduce((s, t) => s + totalPnlOf(t), 0)
  const openTrades = trades.filter((t) => t.status === 'open')
  const open = openTrades.length
  const closed = closedChronological(trades)
  const wins = closed.filter((t) => t.pnl > 0)
  const losses = closed.filter((t) => t.pnl < 0)
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const durations = closed.map((t) => new Date(t.closedAt!).getTime() - new Date(t.openedAt).getTime()).filter((d) => d > 0)

  let streakWin = 0
  let streakLoss = 0
  let longestWinStreak = 0
  let longestLossStreak = 0
  for (const t of closed) {
    if (t.pnl > 0) {
      streakWin += 1
      streakLoss = 0
    } else if (t.pnl < 0) {
      streakLoss += 1
      streakWin = 0
    }
    longestWinStreak = Math.max(longestWinStreak, streakWin)
    longestLossStreak = Math.max(longestLossStreak, streakLoss)
  }

  const lossRate = closed.length ? losses.length / closed.length : 0
  return {
    totalPnl,
    openRealized: openTrades.reduce((s, t) => s + realizedOf(t), 0),
    openUnrealized: openTrades.reduce((s, t) => s + unrealizedOf(t), 0),
    open,
    closed: closed.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    best: closed.length ? Math.max(...closed.map((t) => t.pnl)) : 0,
    worst: closed.length ? Math.min(...closed.map((t) => t.pnl)) : 0,
    avgDurationMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    expectancy: (winRate / 100) * avgWin - lossRate * avgLoss,
    payoff: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
    longestWinStreak,
    longestLossStreak,
    fees: trades.reduce((s, t) => s + (t.fee || 0), 0)
  }
}

export interface EquityPoint {
  t: number
  cum: number
  /** Distance below the running peak (≤ 0). */
  dd: number
}

/** Cumulative realized PnL per closed trade, with the drawdown from the running peak. */
export function equityWithDrawdown(trades: Trade[]): { points: EquityPoint[]; maxDrawdown: number; maxDrawdownAt: number | null } {
  let cum = 0
  let peak = 0
  let maxDrawdown = 0
  let maxDrawdownAt: number | null = null
  const points = closedChronological(trades).map((t) => {
    cum += t.pnl
    peak = Math.max(peak, cum)
    const dd = cum - peak
    const at = new Date(t.closedAt!).getTime()
    if (dd < maxDrawdown) {
      maxDrawdown = dd
      maxDrawdownAt = at
    }
    return { t: at, cum, dd }
  })
  return { points, maxDrawdown, maxDrawdownAt }
}

export interface GroupStat {
  key: string
  label: string
  pnl: number
  count: number
  winRate: number
}

/**
 * Closed trades grouped by `keyOf`; `order` fixes bucket order (and keeps empty buckets) when given.
 * With `includePartial`, profits already banked from partial closes of open positions are added to
 * their group's PnL too (without counting the position as a trade or towards the win rate).
 */
export function groupClosed(
  trades: Trade[],
  keyOf: (t: Trade) => string | null,
  order?: { key: string; label: string }[],
  includePartial = false
): GroupStat[] {
  const map = new Map<string, { pnl: number; count: number; wins: number }>()
  if (includePartial) {
    for (const t of trades) {
      if (t.status !== 'open' || !t.realizedPnl) continue
      const key = keyOf(t)
      if (key == null) continue
      const g = map.get(key) || { pnl: 0, count: 0, wins: 0 }
      g.pnl += t.realizedPnl
      map.set(key, g)
    }
  }
  for (const t of closedChronological(trades)) {
    const key = keyOf(t)
    if (key == null) continue
    const g = map.get(key) || { pnl: 0, count: 0, wins: 0 }
    g.pnl += t.pnl
    g.count += 1
    if (t.pnl > 0) g.wins += 1
    map.set(key, g)
  }
  const rows = (order ?? Array.from(map.keys()).map((k) => ({ key: k, label: k }))).map(({ key, label }) => {
    const g = map.get(key) || { pnl: 0, count: 0, wins: 0 }
    return { key, label, pnl: g.pnl, count: g.count, winRate: g.count ? (g.wins / g.count) * 100 : 0 }
  })
  return order ? rows : rows.sort((a, b) => b.pnl - a.pnl)
}

export const LEVERAGE_BUCKETS = [
  { key: 'l1', label: '≤ 5x' },
  { key: 'l2', label: '6–10x' },
  { key: 'l3', label: '11–20x' },
  { key: 'l4', label: '> 20x' }
]

export function leverageBucket(t: Trade) {
  if (t.leverage == null) return null
  if (t.leverage <= 5) return 'l1'
  if (t.leverage <= 10) return 'l2'
  if (t.leverage <= 20) return 'l3'
  return 'l4'
}

export const DURATION_BUCKETS = [
  { key: 'd1', label: '< 1 Std.' },
  { key: 'd2', label: '1–24 Std.' },
  { key: 'd3', label: '1–7 Tage' },
  { key: 'd4', label: '> 7 Tage' }
]

export function durationBucket(t: Trade) {
  if (!t.closedAt) return null
  const h = (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()) / 3_600_000
  if (!Number.isFinite(h) || h < 0) return null
  if (h < 1) return 'd1'
  if (h < 24) return 'd2'
  if (h < 24 * 7) return 'd3'
  return 'd4'
}

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((label, i) => ({ key: String(i), label }))

/** Weekday of the close, Monday = 0. */
export function weekdayOf(t: Trade) {
  if (!t.closedAt) return null
  return String((new Date(t.closedAt).getDay() + 6) % 7)
}

/**
 * Cost breakdown of everything realized so far — closed trades plus partial closes of open
 * positions. Realized PnL is already net of trading fees (closedPnl − fee in lib/hyperliquid.ts),
 * so gross = net + fees. Funding is only reported live for open positions.
 */
export function costBreakdown(trades: Trade[]) {
  const realized = trades.filter((t) => t.status === 'closed' || t.realizedPnl != null)
  const fees = realized.reduce((s, t) => s + (t.fee || 0), 0)
  const net = realized.reduce((s, t) => s + realizedOf(t), 0)
  const openFunding = trades.filter((t) => t.status === 'open').reduce((s, t) => s + (t.fundingFee ?? 0), 0)
  return { gross: net + fees, fees, net, openFunding }
}

/**
 * Portfolio share in German notation with precision that never rounds a real share down to zero:
 * 12 % · 1,3 % · 0,04 % · < 0,01 %.
 */
export function fmtShare(pct: number) {
  if (!(pct > 0)) return '0\u00a0%'
  if (pct < 0.01) return '<\u00a00,01\u00a0%'
  const digits = pct >= 10 ? 0 : pct >= 0.1 ? 1 : 2
  return `${pct.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })}\u00a0%`
}
