import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import FlipValue from './FlipValue'
import EquityCurve from './EquityCurve'

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
  fee: number
  fillsCount: number
  openedAt: string
  closedAt: string | null
  connectionLabel: string | null
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

type Range = 'all' | '30d' | '7d' | '24h'
type StatusFilter = 'all' | 'open' | 'closed'
type SideFilter = 'all' | 'long' | 'short'

const RANGE_MS: Record<Exclude<Range, 'all'>, number> = {
  '30d': 1000 * 60 * 60 * 24 * 30,
  '7d': 1000 * 60 * 60 * 24 * 7,
  '24h': 1000 * 60 * 60 * 24
}

function fmtUsd(n: number) {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  const [range, setRange] = useState<Range>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [coinFilter, setCoinFilter] = useState<string>('all')

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
    if (!res.ok) return
    const data = await res.json()
    setAccountValue(typeof data.accountValue === 'number' ? data.accountValue : null)
    setWithdrawable(typeof data.withdrawable === 'number' ? data.withdrawable : null)
    setHoldingsValue(typeof data.holdingsValue === 'number' ? data.holdingsValue : null)
    setConnectionLabels((data.connections || []).map((c: { label: string }) => c.label))
  }

  const loadHoldings = async () => {
    const res = await fetch('/api/holdings')
    if (!res.ok) return
    const data = await res.json()
    setHoldings(data.holdings || [])
  }

  useEffect(() => {
    load()
    loadAccount()
    loadHoldings()

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

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="font-mono text-sm text-ink-300 tabular animate-pulse">Lade Trades…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-950 pb-16">
      {/* THESIS: a professional trading terminal, not a themed novelty — the departures-board gimmick is refused in favor of dense, precise instrumentation.
          OWN-WORLD: near-black graphite panels, hairline 1px borders, JetBrains Mono tabular figures, Inter UI labels, one restrained cool-blue accent, functional green/red PNL only, flat elevation (no shadows, gloss, or tiles).
          STORY: owner opens the terminal, scans a shared net-worth overview, then reads Portfolio (holdings) and Trading (perps statistics) as two clearly separated instrument panels.
          FIRST VIEWPORT: control bar, shared Main Statistik row, Portfolio section header.
          FORM: canon direction — professional trading terminal (dYdX / Hyperliquid native app / Bloomberg Terminal register), user-selected standing exit.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8">
        <header className="border border-ink-700 rounded-md px-5 py-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-mono text-sm tracking-[0.15em] text-ink-100 uppercase">Trading Dashboard</h1>
            <p className="text-xs text-ink-400 font-mono mt-1">
              {connectionLabels.length > 0 ? connectionLabels.join(' · ') : 'Keine Verbindung konfiguriert'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-ink-400 font-mono">Zuletzt synced</div>
              <div className="text-xs text-ink-100 font-mono tabular">{lastSyncedAt ? fmtDate(lastSyncedAt) : 'nie'}</div>
            </div>
            <button
              onClick={syncNow}
              disabled={syncing}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded border border-ink-600 bg-ink-900 text-signal hover:bg-ink-800 hover:border-signal/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <Link
              href="/settings"
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded border border-ink-600 bg-ink-900 text-ink-100 hover:bg-ink-800 hover:border-signal/40 transition-colors"
              aria-label="Einstellungen"
            >
              Einstellungen
            </Link>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded border border-down/40 bg-down/10 px-4 py-3 text-sm font-mono text-down">{error}</div>
        )}

        {/* Main Statistik — shared overview across Portfolio (stocks/ETFs/crypto) and Trading */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatModule label="Gesamtvermögen">
            <FlipValue value={accountValue != null ? fmtUsd(accountValue) : '—'} size="lg" tone="bone" />
          </StatModule>
          <StatModule label="Portfolio-Wert">
            <FlipValue value={holdingsValue != null ? fmtUsd(holdingsValue) : '—'} size="lg" tone="bone" />
          </StatModule>
          <StatModule label="Trading PNL (All-Time)">
            <FlipValue value={fmtUsd(allTimeTradingPnl)} size="lg" tone={allTimeTradingPnl >= 0 ? 'up' : 'down'} />
          </StatModule>
          <StatModule label="Verfügbares Cash">
            <FlipValue value={withdrawable != null ? fmtUsd(withdrawable) : '—'} size="lg" tone="bone" />
          </StatModule>
        </div>

        <SectionHeader>Portfolio</SectionHeader>

        {/* Holdings */}
        <div className="border border-ink-700 rounded-md overflow-hidden mb-10">
          {holdings.length === 0 ? (
            <div className="py-12 text-center text-ink-400 font-mono text-sm">
              Keine gehaltenen Positionen. Kryptos werden beim Sync erfasst, Aktien/ETFs unter Einstellungen manuell.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-ink-400 border-b border-ink-700">
                    <th className="py-3 px-4 font-medium">Asset</th>
                    <th className="py-3 px-4 font-medium">Typ</th>
                    <th className="py-3 px-4 font-medium">Quelle</th>
                    <th className="py-3 px-4 font-medium">Menge</th>
                    <th className="py-3 px-4 font-medium">Kurs</th>
                    <th className="py-3 px-4 font-medium">Wert</th>
                    <th className="py-3 px-4 font-medium">Unrealisiert</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => (
                    <tr key={`${h.source}-${h.symbol}-${i}`} className="border-b border-ink-800 last:border-0 hover:bg-ink-900/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-ink-100 font-medium">{h.name && h.name !== h.symbol ? h.name : h.symbol}</div>
                        {h.name && h.name !== h.symbol && <div className="text-ink-400 text-xs mt-0.5">{h.symbol}</div>}
                      </td>
                      <td className="py-3 px-4 text-ink-400">{ASSET_CLASS_LABEL[h.assetClass]}</td>
                      <td className="py-3 px-4 text-ink-400">{h.sourceLabel}</td>
                      <td className="py-3 px-4 tabular text-ink-400">{h.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
                      <td className="py-3 px-4 tabular text-ink-400">{h.price != null ? fmtUsd(h.price) : '—'}</td>
                      <td className="py-3 px-4 tabular text-ink-100 font-medium">{h.value != null ? fmtUsd(h.value) : '—'}</td>
                      <td className={`py-3 px-4 tabular font-medium ${h.unrealizedPnl == null ? 'text-ink-400' : h.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>
                        {h.unrealizedPnl != null ? fmtUsd(h.unrealizedPnl) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <SectionHeader>Trading</SectionHeader>

        {/* Trading-Statistiken — primary tier */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
          <StatModule label={`PNL (${range === 'all' ? 'All-Time' : range})`}>
            <FlipValue value={fmtUsd(stats.totalPnl)} size="lg" tone={stats.totalPnl >= 0 ? 'up' : 'down'} />
          </StatModule>
          <StatModule label="Win Rate">
            <FlipValue value={`${stats.winRate.toFixed(1)}%`} size="lg" tone="amber" />
          </StatModule>
          <StatModule label="Profit Factor">
            <FlipValue value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} size="lg" tone="amber" />
          </StatModule>
          <StatModule label="Offene Positionen">
            <FlipValue value={String(stats.open).padStart(2, '0')} size="lg" tone="bone" />
          </StatModule>
          <StatModule label="Geschlossene Trades">
            <FlipValue value={String(stats.closed).padStart(2, '0')} size="lg" tone="bone" />
          </StatModule>
        </div>

        {/* Trading-Statistiken — secondary tier */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatModule label="Ø Gewinn">
            <FlipValue value={fmtUsd(stats.avgWin)} size="md" tone="up" />
          </StatModule>
          <StatModule label="Ø Verlust">
            <FlipValue value={fmtUsd(-stats.avgLoss)} size="md" tone="down" />
          </StatModule>
          <StatModule label="Bester Trade">
            <FlipValue value={fmtUsd(stats.best)} size="md" tone={stats.best >= 0 ? 'up' : 'down'} />
          </StatModule>
          <StatModule label="Schlechtester Trade">
            <FlipValue value={fmtUsd(stats.worst)} size="md" tone={stats.worst >= 0 ? 'up' : 'down'} />
          </StatModule>
          <StatModule label="Ø Haltedauer">
            <FlipValue value={fmtDurationMs(stats.avgDurationMs)} size="md" tone="bone" />
          </StatModule>
        </div>

        {/* Equity curve */}
        <div className="border border-ink-700 rounded-md p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-ink-400">Equity Curve (kumuliert)</h3>
          </div>
          <EquityCurve points={equityPoints} />
        </div>

        {/* Filters */}
        <div className="border border-ink-700 rounded-md p-4 mb-4 flex flex-wrap gap-3 items-center">
          <FilterSelect label="Zeitraum" value={range} onChange={(v) => setRange(v as Range)} options={[['all', 'All-Time'], ['30d', '30 Tage'], ['7d', '7 Tage'], ['24h', '24h']]} />
          <FilterSelect label="Status" value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={[['all', 'Alle'], ['open', 'Offen'], ['closed', 'Geschlossen']]} />
          <FilterSelect label="Seite" value={sideFilter} onChange={(v) => setSideFilter(v as SideFilter)} options={[['all', 'Alle'], ['long', 'Long'], ['short', 'Short']]} />
          <FilterSelect label="Coin" value={coinFilter} onChange={setCoinFilter} options={[['all', 'Alle'], ...coins.map((c) => [c, c] as [string, string])]} />
          <div className="ml-auto text-xs font-mono text-ink-400 tabular">{filtered.length} Trades</div>
        </div>

        {/* Trade table */}
        <div className="border border-ink-700 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-ink-400 border-b border-ink-700">
                  <th className="py-3 px-4 font-medium">Coin</th>
                  <th className="py-3 px-4 font-medium">Quelle</th>
                  <th className="py-3 px-4 font-medium">Seite</th>
                  <th className="py-3 px-4 font-medium">Entry</th>
                  <th className="py-3 px-4 font-medium">Exit</th>
                  <th className="py-3 px-4 font-medium">Size</th>
                  <th className="py-3 px-4 font-medium">PNL</th>
                  <th className="py-3 px-4 font-medium">Dauer</th>
                  <th className="py-3 px-4 font-medium">Geöffnet</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-900/60 transition-colors">
                    <td className="py-3 px-4 text-ink-100 font-medium">{t.coin}</td>
                    <td className="py-3 px-4 text-ink-400">{t.connectionLabel || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`uppercase text-xs tracking-wide ${t.side === 'long' ? 'text-up' : 'text-down'}`}>{t.side}</span>
                    </td>
                    <td className="py-3 px-4 tabular text-ink-400">{t.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                    <td className="py-3 px-4 tabular text-ink-400">{t.exitPrice != null ? t.exitPrice.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</td>
                    <td className="py-3 px-4 tabular text-ink-400">{t.size.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                    <td className={`py-3 px-4 tabular font-medium ${t.pnl >= 0 ? 'text-up' : 'text-down'}`}>{fmtUsd(t.pnl)}</td>
                    <td className="py-3 px-4 tabular text-ink-400">{fmtDuration(t.openedAt, t.closedAt)}</td>
                    <td className="py-3 px-4 tabular text-ink-400">{fmtDate(t.openedAt)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm ${t.status === 'open' ? 'bg-signal/15 text-signal' : 'bg-ink-700 text-ink-400'}`}>
                        {t.status === 'open' ? 'Offen' : 'Geschlossen'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-ink-400 font-mono text-sm">
              {trades.length === 0 ? 'Noch keine Trades synced. Klicke auf "Sync now".' : 'Keine Trades in diesem Filter.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-ink-100 shrink-0">{children}</h2>
      <div className="h-px flex-1 bg-ink-700" />
    </div>
  )
}

function StatModule({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-ink-700 rounded-md px-4 py-4 flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-ink-400 font-mono">{label}</span>
      {children}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-mono text-ink-400">
      <span className="uppercase tracking-widest">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-ink-900 border border-ink-600 rounded-sm px-2 py-1.5 text-ink-100 focus:outline-none focus:border-signal/60"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}
