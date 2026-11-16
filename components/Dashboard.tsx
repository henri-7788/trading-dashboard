import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import FlipValue from './FlipValue'
import EquityCurve from './EquityCurve'
import Skeleton from './Skeleton'
import { MonthlyBars, SegmentMeter, TradeDotMatrix } from './Charts'

interface Trade {
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

interface Holding {
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

const ASSET_CLASS_LABEL: Record<string, string> = {
  crypto: 'Krypto',
  stock: 'Aktie',
  etf: 'ETF',
  other: 'Sonstiges'
}

type HoldingSortKey = 'name' | 'assetClass' | 'source' | 'quantity' | 'price' | 'value' | 'unrealizedPnl'
type SortDir = 'asc' | 'desc'

const HOLDING_COLUMNS: { key: HoldingSortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Asset', numeric: false },
  { key: 'assetClass', label: 'Typ', numeric: false },
  { key: 'source', label: 'Quelle', numeric: false },
  { key: 'quantity', label: 'Menge', numeric: true },
  { key: 'price', label: 'Kurs', numeric: true },
  { key: 'value', label: 'Wert', numeric: true },
  { key: 'unrealizedPnl', label: 'Unrealisiert', numeric: true }
]

/** Rows visible while the holdings table is collapsed. */
const HOLDINGS_COLLAPSED_COUNT = 4

function holdingSortValue(h: Holding, key: HoldingSortKey): string | number | null {
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
function sortHoldings(holdings: Holding[], key: HoldingSortKey, dir: SortDir): Holding[] {
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

type Range = 'all' | '30d' | '7d' | '24h'
type StatusFilter = 'all' | 'open' | 'closed'
type SideFilter = 'all' | 'long' | 'short'

const RANGE_MS: Record<Exclude<Range, 'all'>, number> = {
  '30d': 1000 * 60 * 60 * 24 * 30,
  '7d': 1000 * 60 * 60 * 24 * 7,
  '24h': 1000 * 60 * 60 * 24
}

// Tries each icon source in order (falls back on load error), then a plain letter avatar.
function iconSourcesFor(symbol: string, assetClass: 'crypto' | 'stock' | 'etf' | 'other'): string[] {
  if (assetClass === 'crypto') {
    const sym = symbol.toLowerCase()
    return [
      `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@0.18.1/32/color/${sym}.png`,
      `https://assets.coincap.io/assets/icons/${sym}@2x.png`
    ]
  }
  if (assetClass === 'stock' || assetClass === 'etf') {
    return [`https://financialmodelingprep.com/image-stock/${symbol.toUpperCase()}.png`]
  }
  return []
}

function AssetIcon({
  symbol,
  assetClass,
  size = 'sm'
}: {
  symbol: string
  assetClass: 'crypto' | 'stock' | 'etf' | 'other'
  /** sm for dense desktop tables, lg for the phone list rows. */
  size?: 'sm' | 'lg'
}) {
  const sources = iconSourcesFor(symbol, assetClass)
  const [srcIndex, setSrcIndex] = useState(0)
  const box = size === 'lg' ? 'h-9 w-9' : 'h-5 w-5'

  if (srcIndex >= sources.length) {
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-ink-150 ${size === 'lg' ? 'text-xs' : 'text-[9px]'} font-semibold text-ink-600`}>
        {symbol.slice(0, 1)}
      </span>
    )
  }

  return (
    <img
      key={sources[srcIndex]}
      src={sources[srcIndex]}
      alt=""
      className={`${box} shrink-0 rounded-full`}
      loading="lazy"
      onError={() => setSrcIndex((i) => i + 1)}
    />
  )
}

const MASK = '•••••'
const HIDE_VALUES_KEY = 'trading-dashboard:hide-values'

function fmtUsd(n: number) {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** PnL relative to margin, i.e. ROI on the capital actually at risk. Prefers Hyperliquid's own live returnOnEquity so it matches the exchange exactly; falls back to margin/notional-based estimates for closed trades or when live data is unavailable. */
function pnlPct(t: Trade): number | null {
  if (t.roe != null) return t.roe
  const margin = t.margin ?? (t.leverage ? t.notional / t.leverage : t.notional)
  if (!margin) return null
  return (t.pnl / margin) * 100
}

function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : '-'
  return `${sign}${Math.abs(n).toFixed(1)}%`
}

/** How close the trade's mark price is to its liquidation price, as a fraction of the mark price (0 = at liquidation). Only meaningful for open trades. */
function liquidationDistancePct(t: Trade): number | null {
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
function liquidationBufferRatio(t: Trade): number | null {
  if (t.status !== 'open' || t.liquidationPrice == null || t.markPrice == null) return null
  const bufferAtEntry = Math.abs(t.entryPrice - t.liquidationPrice)
  if (bufferAtEntry === 0) return null
  const bufferNow = Math.abs(t.markPrice - t.liquidationPrice)
  return bufferNow / bufferAtEntry
}

/** Liquidation risk tier for a trade, independent of PnL sign — based on how much of the entry buffer to liquidation is left, not raw price distance. */
function liquidationRisk(t: Trade): 'critical' | 'warning' | 'caution' | null {
  const ratio = liquidationBufferRatio(t)
  if (ratio == null) return null
  if (ratio <= 0.15) return 'critical'
  if (ratio <= 0.35) return 'warning'
  if (ratio <= 0.6) return 'caution'
  return null
}

const LIQUIDATION_RISK_STYLE: Record<'critical' | 'warning' | 'caution', string> = {
  critical: 'text-down animate-pulse',
  warning: 'text-down',
  caution: 'text-amber'
}

const LIQUIDATION_RISK_LABEL: Record<'critical' | 'warning' | 'caution', string> = {
  critical: 'Sehr nah am Liquidationslevel',
  warning: 'Nah am Liquidationslevel',
  caution: 'Nähert sich dem Liquidationslevel'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDuration(openedAt: string, closedAt: string | null) {
  if (!closedAt) return '—'
  return fmtDurationMs(new Date(closedAt).getTime() - new Date(openedAt).getTime())
}

function fmtDurationMs(ms: number) {
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

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [connectionLabels, setConnectionLabels] = useState<string[]>([])
  const [accountValue, setAccountValue] = useState<number | null>(null)
  const [withdrawable, setWithdrawable] = useState<number | null>(null)
  const [holdingsValue, setHoldingsValue] = useState<number | null>(null)
  const [accountLoaded, setAccountLoaded] = useState(false)
  const [holdingsLoaded, setHoldingsLoaded] = useState(false)
  const initialSyncStarted = useRef(false)

  const [range, setRange] = useState<Range>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [coinFilter, setCoinFilter] = useState<string>('all')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [holdingSort, setHoldingSort] = useState<{ key: HoldingSortKey; dir: SortDir }>({ key: 'value', dir: 'desc' })
  const [holdingsExpanded, setHoldingsExpanded] = useState(false)
  // Money values start censored; the eye toggle reveals them and the choice persists per device.
  const [hideValues, setHideValues] = useState(true)

  useEffect(() => {
    if (localStorage.getItem(HIDE_VALUES_KEY) === '0') setHideValues(false)
  }, [])

  const toggleHideValues = () => {
    setHideValues((v) => {
      localStorage.setItem(HIDE_VALUES_KEY, v ? '0' : '1')
      return !v
    })
  }

  const usd = (n: number) => (hideValues ? MASK : fmtUsd(n))
  const qty = (n: number, digits: number) => (hideValues ? MASK : n.toLocaleString('en-US', { maximumFractionDigits: digits }))

  const load = async () => {
    setError(null)
    const res = await fetch('/api/trades')
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) {
      setError('Trades konnten nicht geladen werden.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setTrades(data.trades || [])
    setLastSyncedAt(data.lastSyncedAt)
    setLoading(false)
  }

  const loadAccount = async () => {
    const res = await fetch('/api/account')
    setAccountLoaded(true)
    if (!res.ok) return
    const data = await res.json()
    setAccountValue(typeof data.accountValue === 'number' ? data.accountValue : null)
    setWithdrawable(typeof data.withdrawable === 'number' ? data.withdrawable : null)
    setHoldingsValue(typeof data.holdingsValue === 'number' ? data.holdingsValue : null)
    setConnectionLabels((data.connections || []).map((c: { label: string }) => c.label))
  }

  const loadHoldings = async () => {
    const res = await fetch('/api/holdings')
    setHoldingsLoaded(true)
    if (!res.ok) return
    const data = await res.json()
    setHoldings(data.holdings || [])
  }

  useEffect(() => {
    load()
    loadAccount()
    loadHoldings()

    // Every visit pulls fresh data from the exchanges; the cached data above renders meanwhile.
    // The ref guards against React StrictMode's double-mount firing two syncs in dev.
    if (!initialSyncStarted.current) {
      initialSyncStarted.current = true
      syncNow()
    }

    const pricesInterval = setInterval(() => {
      load()
      loadAccount()
      loadHoldings()
    }, 15000)
    const autoSyncInterval = setInterval(() => {
      fetch('/api/sync', { method: 'POST' })
        .then((res) => (res.ok ? load() : null))
        .catch(() => {})
    }, 60000)

    return () => {
      clearInterval(pricesInterval)
      clearInterval(autoSyncInterval)
    }
  }, [])

  const syncNow = async () => {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Sync fehlgeschlagen.')
        return
      }
      await load()
      await loadAccount()
      await loadHoldings()
    } finally {
      setSyncing(false)
    }
  }

  const sortedHoldings = useMemo(() => sortHoldings(holdings, holdingSort.key, holdingSort.dir), [holdings, holdingSort])
  const visibleHoldings = holdingsExpanded ? sortedHoldings : sortedHoldings.slice(0, HOLDINGS_COLLAPSED_COUNT)
  const hiddenHoldingsCount = sortedHoldings.length - HOLDINGS_COLLAPSED_COUNT

  // Clicking the active column flips direction; a new column starts highest-first for numbers, A–Z for text.
  const toggleHoldingSort = (key: HoldingSortKey, numeric: boolean) => {
    setHoldingSort((cur) =>
      cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: numeric ? 'desc' : 'asc' }
    )
  }

  const coins = useMemo(() => Array.from(new Set(trades.map((t) => t.coin))).sort(), [trades])

  const inRange = (t: Trade) => {
    if (range === 'all') return true
    const ts = new Date(t.closedAt || t.openedAt).getTime()
    if (isNaN(ts)) return false
    return Date.now() - ts <= RANGE_MS[range]
  }

  // Range/side/coin scope both the table and the statistics; status only scopes the table —
  // defaulting it to "Offen" shouldn't zero out win rate, profit factor, or the equity curve.
  const statsScoped = useMemo(() => {
    return trades
      .filter(inRange)
      .filter((t) => (sideFilter === 'all' ? true : t.side === sideFilter))
      .filter((t) => (coinFilter === 'all' ? true : t.coin === coinFilter))
  }, [trades, range, sideFilter, coinFilter])

  const filtered = useMemo(() => {
    return statsScoped.filter((t) => (statusFilter === 'all' ? true : t.status === statusFilter))
  }, [statsScoped, statusFilter])

  const allTimeTradingPnl = useMemo(() => trades.reduce((s, t) => s + t.pnl, 0), [trades])

  const stats = useMemo(() => {
    const totalPnl = statsScoped.reduce((s, t) => s + t.pnl, 0)
    const open = statsScoped.filter((t) => t.status === 'open').length
    const closed = statsScoped.filter((t) => t.status === 'closed')
    const wins = closed.filter((t) => t.pnl > 0)
    const losses = closed.filter((t) => t.pnl < 0)
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
    const avgWin = wins.length ? grossProfit / wins.length : 0
    const avgLoss = losses.length ? grossLoss / losses.length : 0
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
    const best = closed.length ? Math.max(...closed.map((t) => t.pnl)) : 0
    const worst = closed.length ? Math.min(...closed.map((t) => t.pnl)) : 0
    const durations = closed.filter((t) => t.closedAt).map((t) => new Date(t.closedAt!).getTime() - new Date(t.openedAt).getTime())
    const avgDurationMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    return { totalPnl, open, closed: closed.length, winRate, avgWin, avgLoss, profitFactor, best, worst, avgDurationMs }
  }, [statsScoped])

  const equityPoints = useMemo(() => {
    const closed = statsScoped
      .filter((t) => t.status === 'closed' && t.closedAt)
      .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())
    let cum = 0
    return closed.map((t) => {
      cum += t.pnl
      return { t: new Date(t.closedAt!).getTime(), cum }
    })
  }, [statsScoped])

  const closedSorted = useMemo(
    () =>
      statsScoped
        .filter((t) => t.status === 'closed' && t.closedAt)
        .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())
        .map((t) => ({ id: t.id, coin: t.coin, pnl: t.pnl, closedAt: t.closedAt! })),
    [statsScoped]
  )

  // Monthly bars always look at the full history (not the range filter), since they show six months.
  const allClosed = useMemo(
    () =>
      trades
        .filter((t) => t.status === 'closed' && t.closedAt)
        .filter((t) => (sideFilter === 'all' ? true : t.side === sideFilter))
        .filter((t) => (coinFilter === 'all' ? true : t.coin === coinFilter))
        .map((t) => ({ id: t.id, coin: t.coin, pnl: t.pnl, closedAt: t.closedAt! })),
    [trades, sideFilter, coinFilter]
  )

  const holdingsTotal = useMemo(() => holdings.reduce((s, h) => s + (h.value ?? 0), 0), [holdings])
  const [barMetric, setBarMetric] = useState<'pnl' | 'count'>('pnl')
  const [activeSection, setActiveSection] = useState<'uebersicht' | 'portfolio' | 'trading'>('uebersicht')

  // Scroll spy for the hero nav pills.
  useEffect(() => {
    const ids = ['uebersicht', 'portfolio', 'trading'] as const
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveSection(visible[0].target.id as (typeof ids)[number])
      },
      { rootMargin: '-35% 0px -55% 0px' }
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const openTrades = useMemo(() => trades.filter((t) => t.status === 'open'), [trades])
  const riskiest = useMemo(() => {
    const order = { critical: 0, warning: 1, caution: 2 } as const
    return openTrades
      .map((t) => ({ t, risk: liquidationRisk(t) }))
      .filter((x): x is { t: Trade; risk: 'critical' | 'warning' | 'caution' } => x.risk != null && x.risk !== 'caution')
      .sort((a, b) => order[a.risk] - order[b.risk])[0]
  }, [openTrades])

  const insight = useMemo(() => {
    if (riskiest) {
      const dist = liquidationDistancePct(riskiest.t)
      return {
        warning: true,
        title: `${riskiest.t.coin} ${riskiest.t.side === 'long' ? 'Long' : 'Short'} nähert sich der Liquidation.`,
        body: `Der Mark-Preis liegt nur noch ${dist != null ? `${dist.toFixed(1).replace('.', ',')} %` : 'wenig'} vom Liquidationspreis entfernt. Prüfe Margin oder Stop, bevor der Puffer aufgebraucht ist.`,
        action: 'Position öffnen',
        onAction: () => setSelectedTrade(riskiest.t)
      }
    }
    if (stats.closed === 0) {
      return {
        warning: false,
        title: 'Noch keine abgeschlossenen Trades.',
        body: 'Sobald Positionen geschlossen sind, steht hier, wie sich Trefferquote und Profit Factor entwickeln.',
        action: 'Trades ansehen',
        onAction: () => document.getElementById('trading')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    const wr = `${stats.winRate.toFixed(1).replace('.', ',')} %`
    const pf = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2).replace('.', ',')
    const profitable = stats.profitFactor >= 1
    return {
      warning: false,
      title: profitable ? 'Deine Gewinner tragen das Trading.' : 'Verluste überwiegen gerade.',
      body: profitable
        ? `Trefferquote ${wr}, Profit Factor ${pf}. Ein Ø Gewinn von ${usd(stats.avgWin)} steht einem Ø Verlust von ${usd(stats.avgLoss)} gegenüber.`
        : `Trefferquote ${wr}, Profit Factor ${pf}. Ein Ø Verlust von ${usd(stats.avgLoss)} wiegt schwerer als ein Ø Gewinn von ${usd(stats.avgWin)}.`,
      action: openTrades.length > 0 ? `${openTrades.length} offene Position${openTrades.length === 1 ? '' : 'en'}` : 'Trades ansehen',
      onAction: () => {
        if (openTrades.length > 0) setStatusFilter('open')
        document.getElementById('trading')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [riskiest, stats, openTrades, hideValues])

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div className="min-h-screen pb-16">
      {/* THESIS: one petrol band carries the greeting and the day's actions; everything below is calm near-white cards on cool grey, so the only saturated surfaces are the band, the insight card, and the data marks.
          OWN-WORLD: deep petrol (#0d3646 → #5e97a9) band with a fine dot screen, #edf0f0 ground, soft white cards with white inset rows, capsule pills, Geist at regular weight with tight tracking for figures, petrol dot-matrix / segment-bar / hatched-bar charts, green and brick red only for PnL direction.
          STORY: owner opens the dashboard, reads net worth and trading PnL at a glance, gets one sentence of interpretation (or a liquidation warning), then scans allocation, trades, and monthly results.
          FIRST VIEWPORT: band with brand, section pills, greeting and Sync; below it three cards — net worth with equity curve, PnL per trade dot matrix, insight card.
          FORM: user-supplied reference (petrol fintech dashboard), adapted to trading; replaces Liquid Glass by request on 2026-11-16.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. */}
      <div className="mx-auto max-w-[1240px] px-3 sm:px-5 md:px-8 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-5">
        {/* Top bar on the petrol band */}
        <nav className="flex h-14 items-center justify-between gap-3" aria-label="Hauptnavigation">
          <a href="#uebersicht" onClick={(e) => scrollToSection(e, '#uebersicht')} className="flex items-center gap-2.5 text-white">
            <BrandMark />
            <span className="text-[17px] md:text-[19px] font-medium tracking-[-0.015em]">Trading Dashboard</span>
          </a>
          <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
            <NavPill href="#uebersicht" active={activeSection === 'uebersicht'} icon={<OverviewIcon />}>
              Übersicht
            </NavPill>
            <NavPill href="#portfolio" active={activeSection === 'portfolio'} icon={<PieIcon />}>
              Portfolio
            </NavPill>
            <NavPill href="#trading" active={activeSection === 'trading'} icon={<PulseIcon />}>
              Trading
            </NavPill>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleHideValues}
              className="pill-on-dark h-11 w-11"
              aria-label={hideValues ? 'Geldwerte anzeigen' : 'Geldwerte verbergen'}
              aria-pressed={!hideValues}
              title={hideValues ? 'Geldwerte anzeigen' : 'Geldwerte verbergen'}
            >
              <EyeIcon open={!hideValues} />
            </button>
            <Link href="/settings" className="pill-on-dark h-11 w-11" aria-label="Einstellungen" title="Einstellungen">
              <GearIcon />
            </Link>
          </div>
        </nav>

        {/* Greeting + primary actions */}
        <section id="uebersicht" className="scroll-mt-6 pt-7 md:pt-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="text-white">
            <h1 className="text-[2rem] md:text-[2.75rem] font-normal leading-[1.05] tracking-[-0.035em]" suppressHydrationWarning>
              {greeting}.
            </h1>
            <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-white/75">
              {accountLoaded
                ? connectionLabels.length > 0
                  ? `Vermögen, offene Positionen und Trading-Performance aus ${connectionLabels.join(', ')} auf einen Blick.`
                  : 'Noch keine Verbindung eingerichtet. Füge in den Einstellungen eine Börse oder Wallet hinzu.'
                : 'Vermögen, offene Positionen und Trading-Performance auf einen Blick.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="mr-1 text-right text-white/70 hidden sm:block">
              <div className="text-[11px] uppercase tracking-[0.12em]">Zuletzt synced</div>
              {loading ? (
                <span className="skeleton skeleton-on-dark mt-1 ml-auto block h-3 w-24" />
              ) : (
                <div className="text-[13px] text-white tabular">{lastSyncedAt ? fmtDate(lastSyncedAt) : 'nie'}</div>
              )}
            </div>
            <button
              type="button"
              onClick={toggleHideValues}
              className="pill-on-dark h-11 px-5 text-sm hidden sm:inline-flex"
              aria-pressed={!hideValues}
            >
              {hideValues ? 'Werte anzeigen' : 'Werte verbergen'}
            </button>
            <button
              onClick={syncNow}
              disabled={syncing}
              className="pill-on-dark-solid h-11 flex-1 sm:flex-none px-5 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <SyncIcon spinning={syncing} />
              {syncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
            </button>
          </div>
          <div className="sm:hidden -mt-2 text-[12px] text-white/70 tabular">
            Zuletzt synced: {loading ? '…' : lastSyncedAt ? fmtDate(lastSyncedAt) : 'nie'}
          </div>
        </section>

        {error && <div className="card-tight mt-5 px-4 py-3 text-sm text-down">{error}</div>}

        {/* First row: net worth · PnL per trade · insight */}
        <div className="mt-7 md:mt-10 grid gap-3 md:gap-4 lg:grid-cols-3">
          <div className="card rise-in p-5 md:p-6 flex flex-col min-h-[248px]" style={{ ['--i' as string]: 0 }}>
            <div className="flex items-center gap-3">
              <IconChip>
                <WalletIcon />
              </IconChip>
              <span className="text-[15px] text-ink-800">Gesamtvermögen</span>
            </div>
            <div className="mt-auto flex items-end gap-4 pt-6">
              <div className="min-w-0 shrink-0">
                {!accountLoaded ? (
                  <Skeleton className="h-10 w-40 rounded-xl" />
                ) : (
                  <FlipValue value={accountValue != null ? usd(accountValue) : '—'} size="xl" tone="bone" />
                )}
                <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-ink-500">
                  <TrendIcon down={allTimeTradingPnl < 0} />
                  {loading ? (
                    <Skeleton className="h-3 w-20" />
                  ) : (
                    <span className={allTimeTradingPnl >= 0 ? 'text-up' : 'text-down'}>{usd(allTimeTradingPnl)}</span>
                  )}
                  <span>Trading-PnL</span>
                </div>
              </div>
              <EquityCurve points={equityPoints.slice(-40)} className="h-24 min-w-0 flex-1" />
            </div>
            <div className="mt-5 grid grid-cols-2 divide-x divide-ink-150 rounded-2xl bg-white px-1 py-3 border border-ink-100">
              <MiniFigure label="Portfolio" loading={!accountLoaded} value={holdingsValue != null ? usd(holdingsValue) : '—'} />
              <MiniFigure label="Verfügbares Cash" loading={!accountLoaded} value={withdrawable != null ? usd(withdrawable) : '—'} />
            </div>
          </div>

          <div className="card rise-in p-5 md:p-6 flex flex-col min-h-[248px]" style={{ ['--i' as string]: 1 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="eyebrow-label">PnL pro Trade · {range === 'all' ? 'All-Time' : RANGE_LABEL[range]}</div>
                {loading ? (
                  <Skeleton className="mt-2 h-8 w-32 rounded-lg" />
                ) : (
                  <FlipValue value={usd(stats.totalPnl)} size="lg" tone={stats.totalPnl >= 0 ? 'up' : 'down'} />
                )}
              </div>
              <PillSelect
                label="Zeitraum"
                value={range}
                onChange={(v) => setRange(v as Range)}
                options={[
                  ['all', 'All-Time'],
                  ['30d', '30 Tage'],
                  ['7d', '7 Tage'],
                  ['24h', '24 Std.']
                ]}
              />
            </div>
            <div className="mt-5 flex-1">
              {loading ? <Skeleton className="h-[188px] w-full rounded-2xl" /> : <TradeDotMatrix trades={closedSorted} hideValues={hideValues} />}
            </div>
          </div>

          <div
            className={`insight-surface ${insight.warning ? 'is-warning' : ''} rise-in relative overflow-hidden rounded-3xl p-6 md:p-7 flex flex-col min-h-[248px] text-white shadow-float`}
            style={{ ['--i' as string]: 2 }}
          >
            <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-white/70">
              {insight.warning ? <AlertIcon /> : <SparkIcon />}
              {insight.warning ? 'Achtung' : 'Einordnung'}
            </div>
            {loading ? (
              <div className="mt-4 flex flex-col gap-2.5">
                <span className="skeleton skeleton-on-dark block h-6 w-4/5" />
                <span className="skeleton skeleton-on-dark block h-4 w-full" />
                <span className="skeleton skeleton-on-dark block h-4 w-3/5" />
              </div>
            ) : (
              <>
                <h2 className="mt-3 text-[1.5rem] md:text-[1.625rem] font-normal leading-[1.15] tracking-[-0.025em] text-balance">{insight.title}</h2>
                <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-white/80">{insight.body}</p>
              </>
            )}
            <div className="mt-auto pt-6">
              <button type="button" onClick={insight.onAction} className="pill-on-dark-solid h-11 px-5 text-sm font-medium">
                {insight.action}
              </button>
            </div>
          </div>
        </div>

        {/* Second row: allocation · trades · monthly + key figures */}
        <div className="mt-3 md:mt-4 grid gap-3 md:gap-4 lg:grid-cols-3 lg:items-start">
          {/* Portfolio allocation */}
          <section id="portfolio" className="card rise-in scroll-mt-6 p-4 md:p-5" style={{ ['--i' as string]: 3 }}>
            <div className="flex items-start justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="text-[15px] font-medium text-ink-900">Wo dein Geld liegt</h2>
                <p className="mt-0.5 text-[12px] text-ink-500 tabular">
                  {holdingsLoaded ? `${usd(holdingsTotal)} in ${holdings.length} Positionen` : 'Lade Positionen…'}
                </p>
              </div>
              <PillSelect
                label="Sortieren"
                value={`${holdingSort.key}:${holdingSort.dir}`}
                onChange={(v) => {
                  const [key, dir] = v.split(':') as [HoldingSortKey, SortDir]
                  setHoldingSort({ key, dir })
                }}
                options={[
                  ['value:desc', 'Größte zuerst'],
                  ['value:asc', 'Kleinste zuerst'],
                  ['unrealizedPnl:desc', 'Bester PnL'],
                  ['unrealizedPnl:asc', 'Schwächster PnL'],
                  ['name:asc', 'Name A–Z'],
                  ['assetClass:asc', 'Typ'],
                  ['source:asc', 'Quelle']
                ]}
              />
            </div>

            {holdingsLoaded && holdings.length === 0 ? (
              <div className="card-row mt-4 px-4 py-10 text-center text-sm text-ink-500">
                Keine gehaltenen Positionen. Kryptos werden beim Sync erfasst, Aktien und ETFs trägst du unter Einstellungen ein.
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {!holdingsLoaded &&
                  Array.from({ length: 4 }, (_, i) => (
                    <li key={i} className="card-row flex items-center gap-3 px-3.5 py-3.5">
                      <Skeleton className="h-9 w-9 shrink-0" />
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                      <Skeleton className="h-4 w-24" />
                    </li>
                  ))}
                {visibleHoldings.map((h, i) => {
                  const share = holdingsTotal > 0 && h.value != null ? h.value / holdingsTotal : 0
                  return (
                    <li key={`${h.source}-${h.symbol}-${i}`} className="card-row px-3.5 py-3">
                      <div className="flex items-center gap-3">
                        <AssetIcon symbol={h.symbol} assetClass={h.assetClass} size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[15px] text-ink-900">{h.name && h.name !== h.symbol ? h.name : h.symbol}</span>
                            <span className="shrink-0 text-[15px] text-ink-900 tabular">{h.value != null ? usd(h.value) : '—'}</span>
                          </div>
                          <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[12px] text-ink-500">
                            <span className="truncate tabular">
                              {qty(h.quantity, 6)} {h.symbol}
                              {h.price != null && ` à ${fmtUsd(h.price)}`} · {h.sourceLabel}
                            </span>
                            {h.unrealizedPnl != null && (
                              <span className={`shrink-0 tabular ${h.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>{usd(h.unrealizedPnl)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-3 pl-12">
                        <span className="text-[11px] uppercase tracking-[0.1em] text-ink-400">{ASSET_CLASS_LABEL[h.assetClass]}</span>
                        <span className="flex items-center gap-2.5">
                          <SegmentMeter share={share} />
                          <span className="w-9 text-right text-[12px] text-ink-700 tabular">{Math.round(share * 100)}%</span>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {hiddenHoldingsCount > 0 && (
              <button
                type="button"
                onClick={() => setHoldingsExpanded((v) => !v)}
                aria-expanded={holdingsExpanded}
                className="pill mt-3 h-10 w-full text-[13px] text-ink-700"
              >
                {holdingsExpanded ? 'Weniger anzeigen' : `${hiddenHoldingsCount} weitere anzeigen`}
                <ChevronIcon up={holdingsExpanded} />
              </button>
            )}
          </section>

          {/* Trades */}
          <section id="trading" className="card rise-in scroll-mt-6 p-4 md:p-5" style={{ ['--i' as string]: 4 }}>
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <h2 className="text-[15px] font-medium text-ink-900">Trades</h2>
                <p className="mt-0.5 text-[12px] text-ink-500 tabular">
                  {loading ? 'Lade Trades…' : `${filtered.length} ${filtered.length === 1 ? 'Trade' : 'Trades'} im Filter`}
                </p>
              </div>
              <PillSelect
                label="Status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                options={[
                  ['open', 'Offen'],
                  ['closed', 'Geschlossen'],
                  ['all', 'Alle']
                ]}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 px-1">
              <PillSelect
                label="Seite"
                value={sideFilter}
                onChange={(v) => setSideFilter(v as SideFilter)}
                options={[
                  ['all', 'Long & Short'],
                  ['long', 'Nur Long'],
                  ['short', 'Nur Short']
                ]}
                size="sm"
              />
              <PillSelect
                label="Coin"
                value={coinFilter}
                onChange={setCoinFilter}
                options={[['all', 'Alle Coins'], ...coins.map((c) => [c, c] as [string, string])]}
                size="sm"
              />
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {loading &&
                Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="card-row flex items-center gap-3 px-3.5 py-3.5">
                    <Skeleton className="h-9 w-9 shrink-0" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </li>
                ))}
              {filtered.map((t) => {
                const pct = pnlPct(t)
                const risk = liquidationRisk(t)
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTrade(t)}
                      className="card-row group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:border-ink-200 active:bg-ink-50"
                    >
                      <AssetIcon symbol={t.coin} assetClass="crypto" size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] text-ink-900">{t.coin}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
                              t.side === 'long' ? 'bg-up-soft text-up' : 'bg-down-soft text-down'
                            }`}
                          >
                            {t.side}
                            {t.leverage != null && ` ${t.leverage}x`}
                          </span>
                          {t.status === 'open' && (
                            <span className="flex items-center gap-1 text-[11px] text-teal-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                              Offen
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-ink-500 tabular">
                          {t.connectionLabel ? `${t.connectionLabel} · ` : ''}
                          {fmtDate(t.closedAt || t.openedAt)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-[15px] tabular ${t.pnl >= 0 ? 'text-up' : 'text-down'}`}>{usd(t.pnl)}</div>
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[12px] tabular">
                          {risk && (
                            <span className={`${LIQUIDATION_RISK_STYLE[risk]} flex`} title={LIQUIDATION_RISK_LABEL[risk]} aria-label={LIQUIDATION_RISK_LABEL[risk]}>
                              <AlertIcon size={13} />
                            </span>
                          )}
                          <span className={pct == null ? 'text-ink-400' : pct >= 0 ? 'text-up/80' : 'text-down/80'}>{pct != null ? fmtPct(pct) : '—'}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
            {!loading && filtered.length === 0 && (
              <div className="card-row mt-4 px-4 py-10 text-center text-sm text-ink-500">
                {trades.length === 0 ? 'Noch keine Trades synchronisiert. Tippe oben auf „Jetzt synchronisieren“.' : 'Keine Trades in diesem Filter.'}
              </div>
            )}
          </section>

          {/* Monthly performance + key figures */}
          <div className="flex flex-col gap-3 md:gap-4">
            <section className="card rise-in p-4 md:p-5" style={{ ['--i' as string]: 5 }}>
              <div className="flex items-start justify-between gap-3 px-1">
                <div>
                  <h2 className="text-[15px] font-medium text-ink-900">Monatliche Performance</h2>
                  <p className="mt-0.5 text-[12px] text-ink-500">Realisierter PnL der letzten sechs Monate</p>
                </div>
                <PillSelect
                  label="Kennzahl"
                  value={barMetric}
                  onChange={(v) => setBarMetric(v as 'pnl' | 'count')}
                  options={[
                    ['pnl', 'PnL'],
                    ['count', 'Anzahl']
                  ]}
                />
              </div>
              <div className="mt-5 px-1">
                {loading ? <Skeleton className="h-52 w-full rounded-2xl" /> : <MonthlyBars trades={allClosed} hideValues={hideValues} metric={barMetric} />}
              </div>
            </section>

            <section className="card rise-in p-4 md:p-5" style={{ ['--i' as string]: 6 }}>
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 className="text-[15px] font-medium text-ink-900">Kennzahlen</h2>
                <span className="text-[12px] text-ink-500">{range === 'all' ? 'All-Time' : RANGE_LABEL[range]}</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                <KeyFigure label="Win Rate" loading={loading} value={`${stats.winRate.toFixed(1)}%`} tone="teal" />
                <KeyFigure label="Profit Factor" loading={loading} value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} tone="teal" />
                <KeyFigure label="Ø Haltedauer" loading={loading} value={fmtDurationMs(stats.avgDurationMs)} />
                <KeyFigure label="Ø Gewinn" loading={loading} value={usd(stats.avgWin)} tone="up" />
                <KeyFigure label="Ø Verlust" loading={loading} value={usd(-stats.avgLoss)} tone="down" />
                <KeyFigure label="Offen / Zu" loading={loading} value={`${stats.open} / ${stats.closed}`} />
                <KeyFigure label="Bester Trade" loading={loading} value={usd(stats.best)} tone={stats.best >= 0 ? 'up' : 'down'} />
                <KeyFigure label="Schlechtester" loading={loading} value={usd(stats.worst)} tone={stats.worst >= 0 ? 'up' : 'down'} />
                <KeyFigure label="Gebühren" loading={loading} value={usd(-statsScoped.reduce((s, t) => s + t.fee, 0))} />
              </dl>
            </section>
          </div>
        </div>
      </div>

      {selectedTrade && <TradeDetailModal trade={selectedTrade} usd={usd} qty={qty} onClose={() => setSelectedTrade(null)} />}
    </div>
  )
}

const RANGE_LABEL: Record<Exclude<Range, 'all'>, string> = {
  '30d': '30 Tage',
  '7d': '7 Tage',
  '24h': '24 Stunden'
}

function TradeDetailModal({
  trade: t,
  usd,
  qty,
  onClose
}: {
  trade: Trade
  usd: (n: number) => string
  qty: (n: number, digits: number) => string
  onClose: () => void
}) {
  const roe = pnlPct(t)
  const risk = liquidationRisk(t)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const price = (n: number | null) => (n != null ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—')
  const signed = (n: number) => <span className={n >= 0 ? 'text-up' : 'text-down'}>{usd(n)}</span>
  const groups: { title: string; rows: [string, React.ReactNode][] }[] = [
    {
      title: 'Position',
      rows: [
        ['Quelle', t.connectionLabel || '—'],
        ['Status', t.status === 'open' ? 'Offen' : 'Geschlossen'],
        ['Leverage', t.leverage != null ? `${t.leverage}x` : '—'],
        ['Size', qty(t.size, 6)],
        ['Notional', usd(t.notional)],
        ['Margin (Isolated)', t.margin != null ? usd(t.margin) : '—']
      ]
    },
    {
      title: 'Preise',
      rows: [
        ['Entry', price(t.entryPrice)],
        ['Exit', price(t.exitPrice)],
        ['Mark', price(t.markPrice)],
        ['Liquidation', price(t.liquidationPrice)]
      ]
    },
    {
      title: 'Ergebnis',
      rows: [
        ['PnL (live/unrealisiert)', signed(t.pnl)],
        ...(t.realizedPnl != null ? ([['Bereits realisiert', signed(t.realizedPnl)]] as [string, React.ReactNode][]) : []),
        ['ROE', roe != null ? <span className={roe >= 0 ? 'text-up' : 'text-down'}>{fmtPct(roe)}</span> : '—'],
        ['Funding', t.fundingFee != null ? usd(t.fundingFee) : '—'],
        ['Gebühren', usd(t.fee)],
        ['Fills', String(t.fillsCount)],
        ['Geöffnet', fmtDate(t.openedAt)],
        ['Geschlossen', fmtDate(t.closedAt)]
      ]
    }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-ink-950/35 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Trade-Details ${t.coin}`}
    >
      <div
        className="card animate-sheet-up w-full md:max-w-[440px] max-h-[88dvh] md:max-h-[85vh] overflow-y-auto overscroll-contain rounded-b-none md:rounded-3xl bg-ink-50 px-4 md:px-5 pt-2 md:pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-ink-200" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="flex items-center gap-3 min-w-0">
            <AssetIcon symbol={t.coin} assetClass="crypto" size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] text-ink-900">{t.coin}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
                    t.side === 'long' ? 'bg-up-soft text-up' : 'bg-down-soft text-down'
                  }`}
                >
                  {t.side}
                  {t.leverage != null && ` ${t.leverage}x`}
                </span>
              </div>
              <div className={`mt-0.5 text-[22px] tracking-[-0.02em] tabular ${t.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                {usd(t.pnl)}
                {roe != null && <span className="ml-2 text-[13px] opacity-75">{fmtPct(roe)}</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="pill -mr-1 h-11 w-11 shrink-0 text-ink-600">
            <CloseIcon />
          </button>
        </div>
        {risk && (
          <div className={`mt-4 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] ${risk === 'caution' ? 'bg-amber-soft text-amber' : 'bg-down-soft text-down'}`}>
            <AlertIcon size={15} />
            {LIQUIDATION_RISK_LABEL[risk]}
            {liquidationDistancePct(t) != null && ` · ${liquidationDistancePct(t)!.toFixed(1)}% Abstand`}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.title} className="mt-4">
            <div className="px-1 text-[11px] uppercase tracking-[0.12em] text-ink-400">{g.title}</div>
            <dl className="card-row mt-2 divide-y divide-ink-100 px-3.5 text-[14px]">
              {g.rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="text-right text-ink-900 tabular">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Glides to an in-page section instead of the browser's instant hash jump. The hash is still
 * written to the URL (without a second jump) so the link stays shareable and Back works.
 * Users who ask for reduced motion get the instant jump.
 */
function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  const target = document.querySelector(href)
  if (!target) return
  e.preventDefault()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  history.replaceState(null, '', href)
}

function NavPill({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => scrollToSection(e, href)}
      aria-current={active ? 'true' : undefined}
      className={`flex h-10 items-center gap-2 rounded-full px-4 text-[13px] transition-colors ${
        active ? 'bg-white/[0.16] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]' : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      {icon}
      {children}
    </a>
  )
}

/** A native <select> dressed as a capsule, so phones still get their own picker. */
function PillSelect({
  label,
  value,
  onChange,
  options,
  size = 'md'
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  size?: 'md' | 'sm'
}) {
  return (
    <label className={`pill relative shrink-0 cursor-pointer ${size === 'sm' ? 'h-9 pl-3.5 pr-8 text-[12px]' : 'h-10 pl-4 pr-9 text-[13px]'}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
        aria-label={label}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <span className="pointer-events-none whitespace-nowrap text-ink-800">{options.find(([v]) => v === value)?.[1] ?? value}</span>
      <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-500 ${size === 'sm' ? 'right-2.5' : 'right-3'}`}>
        <ChevronIcon up={false} />
      </span>
    </label>
  )
}

function IconChip({ children }: { children: React.ReactNode }) {
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ink-100 bg-white text-teal-800 shadow-card">{children}</span>
}

function MiniFigure({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="min-w-0 px-3.5">
      <div className="text-[11px] text-ink-500">{label}</div>
      {loading ? <Skeleton className="mt-1.5 h-4 w-20" /> : <div className="mt-0.5 truncate text-[15px] text-ink-900 tabular">{value}</div>}
    </div>
  )
}

function KeyFigure({ label, value, loading, tone = 'bone' }: { label: string; value: string; loading: boolean; tone?: 'bone' | 'teal' | 'up' | 'down' }) {
  return (
    <div className="card-row min-w-0 px-3 py-2.5">
      <dt className="truncate text-[11px] text-ink-500">{label}</dt>
      <dd className="mt-1 min-w-0 truncate">
        {loading ? <Skeleton className="h-4 w-14" /> : <FlipValue value={value} size="sm" tone={tone} />}
      </dd>
    </div>
  )
}

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

/** Brand mark: two candlesticks, one up one down, drawn as open strokes. */
function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M9 4v4M9 20v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="5.5" y="8" width="7" height="12" rx="2.5" fill="currentColor" />
      <path d="M19 3v6M19 17v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
      <rect x="15.5" y="9" width="7" height="8" rx="2.5" stroke="currentColor" strokeWidth="2" opacity="0.65" />
    </svg>
  )
}

function OverviewIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  )
}

function PieIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
    </svg>
  )
}

function PulseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg {...ICON_PROPS} width={18} height={18}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a1 1 0 0 1 1 1v2" />
      <path d="M4 7.5v9A2.5 2.5 0 0 0 6.5 19H19a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z" />
      <circle cx="16" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TrendIcon({ down }: { down: boolean }) {
  return (
    <svg {...ICON_PROPS} width={14} height={14} className={down ? 'text-down' : 'text-up'}>
      {down ? (
        <>
          <path d="M3 7l6 6 4-4 8 8" />
          <path d="M15 17h6v-6" />
        </>
      ) : (
        <>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </>
      )}
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg {...ICON_PROPS} width={14} height={14}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  )
}

function AlertIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg {...ICON_PROPS} width={18} height={18}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg {...ICON_PROPS} width={15} height={15} className={spinning ? 'animate-spin' : ''}>
      <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
      <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg {...ICON_PROPS} width={14} height={14} className={`transition-transform ${up ? 'rotate-180' : ''}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg {...ICON_PROPS} width={18} height={18}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg {...ICON_PROPS} width={18} height={18}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}
