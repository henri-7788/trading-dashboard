import { useEffect, useMemo, useState } from 'react'
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
  const start = new Date(openedAt).getTime()
  const end = new Date(closedAt).getTime()
  let diff = Math.max(0, end - start)
  const days = Math.floor(diff / 86400000)
  diff -= days * 86400000
  const hours = Math.floor(diff / 3600000)
  diff -= hours * 3600000
  const minutes = Math.floor(diff / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function truncateWallet(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-4)}`
}

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [wallet, setWallet] = useState<string | null>(null)
  const [accountValue, setAccountValue] = useState<number | null>(null)
  const [withdrawable, setWithdrawable] = useState<number | null>(null)

  const [range, setRange] = useState<Range>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
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
    setWallet(data.wallet)
    setLoading(false)
  }

  const loadAccount = async () => {
    const res = await fetch('/api/account')
    if (!res.ok) return
    const data = await res.json()
    setAccountValue(typeof data.accountValue === 'number' ? data.accountValue : null)
    setWithdrawable(typeof data.withdrawable === 'number' ? data.withdrawable : null)
  }

  useEffect(() => {
    load()
    loadAccount()

    const pricesInterval = setInterval(() => {
      load()
      loadAccount()
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

  const filtered = useMemo(() => {
    return trades
      .filter(inRange)
      .filter((t) => (statusFilter === 'all' ? true : t.status === statusFilter))
      .filter((t) => (sideFilter === 'all' ? true : t.side === sideFilter))
      .filter((t) => (coinFilter === 'all' ? true : t.coin === coinFilter))
  }, [trades, range, statusFilter, sideFilter, coinFilter])

  const stats = useMemo(() => {
    const totalPnl = filtered.reduce((s, t) => s + t.pnl, 0)
    const open = filtered.filter((t) => t.status === 'open').length
    const closed = filtered.filter((t) => t.status === 'closed')
    const wins = closed.filter((t) => t.pnl > 0).length
    const winRate = closed.length ? (wins / closed.length) * 100 : 0
    return { totalPnl, open, closed: closed.length, winRate }
  }, [filtered])

  const equityPoints = useMemo(() => {
    const closed = filtered
      .filter((t) => t.status === 'closed' && t.closedAt)
      .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())
    let cum = 0
    return closed.map((t) => {
      cum += t.pnl
      return { t: new Date(t.closedAt!).getTime(), cum }
    })
  }, [filtered])

  if (loading) {
    return (
      <div className="min-h-screen bg-board-950 flex items-center justify-center">
        <div className="font-mono text-flap-amber tabular animate-pulse">Lade Trades…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-board-950 pb-16">
      {/* THESIS: performance-first split-flap board — figures flip like an airport departures board when synced.
          OWN-WORLD: near-black ground, amber/bone monospace tabular figures, functional green/red pnl only.
          STORY: owner opens the board, reads today's PNL/win-rate at a glance, syncs, watches figures flip live.
          FIRST VIEWPORT: header control plate, four flap stat modules, equity trace panel below.
          FORM: candidate 3 of grounded list (split-flap departures board), seed key deae4a53.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8">
        <header className="flap-panel rounded-lg px-5 py-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <span className="rivet" />
              <span className="rivet" />
            </div>
            <div>
              <h1 className="font-mono text-sm tracking-[0.3em] text-flap-amber uppercase">Trading Dashboard</h1>
              <p className="text-xs text-board-400 font-mono mt-1">
                {wallet ? `Wallet ${truncateWallet(wallet)} · Hyperliquid` : 'Kein Wallet konfiguriert'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-board-400 font-mono">Zuletzt synced</div>
              <div className="text-xs text-flap-bone font-mono tabular">{lastSyncedAt ? fmtDate(lastSyncedAt) : 'nie'}</div>
            </div>
            <button
              onClick={syncNow}
              disabled={syncing}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded border border-board-600 bg-board-800 text-flap-amber hover:bg-board-700 hover:border-flap-amber/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded border border-down/40 bg-down/10 px-4 py-3 text-sm font-mono text-down">{error}</div>
        )}

        {/* Account board */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatModule label="Equity (Account)">
            <FlipValue value={accountValue != null ? fmtUsd(accountValue) : '—'} size="lg" tone="bone" />
          </StatModule>
          <StatModule label="Verfügbares Cash">
            <FlipValue value={withdrawable != null ? fmtUsd(withdrawable) : '—'} size="lg" tone="bone" />
          </StatModule>
        </div>

        {/* Stat board */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatModule label={`PNL (${range === 'all' ? 'All-Time' : range})`}>
            <FlipValue value={fmtUsd(stats.totalPnl)} size="lg" tone={stats.totalPnl >= 0 ? 'up' : 'down'} />
          </StatModule>
          <StatModule label="Win Rate">
            <FlipValue value={`${stats.winRate.toFixed(1)}%`} size="lg" tone="amber" />
          </StatModule>
          <StatModule label="Offene Positionen">
            <FlipValue value={String(stats.open).padStart(2, '0')} size="lg" tone="bone" />
          </StatModule>
          <StatModule label="Geschlossene Trades">
            <FlipValue value={String(stats.closed).padStart(2, '0')} size="lg" tone="bone" />
          </StatModule>
        </div>

        {/* Equity curve */}
        <div className="flap-panel rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs uppercase tracking-widest text-board-400">Equity Curve (kumuliert)</h2>
          </div>
          <EquityCurve points={equityPoints} />
        </div>

        {/* Filters */}
        <div className="flap-panel rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center">
          <FilterSelect label="Zeitraum" value={range} onChange={(v) => setRange(v as Range)} options={[['all', 'All-Time'], ['30d', '30 Tage'], ['7d', '7 Tage'], ['24h', '24h']]} />
          <FilterSelect label="Status" value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={[['all', 'Alle'], ['open', 'Offen'], ['closed', 'Geschlossen']]} />
          <FilterSelect label="Seite" value={sideFilter} onChange={(v) => setSideFilter(v as SideFilter)} options={[['all', 'Alle'], ['long', 'Long'], ['short', 'Short']]} />
          <FilterSelect label="Coin" value={coinFilter} onChange={setCoinFilter} options={[['all', 'Alle'], ...coins.map((c) => [c, c] as [string, string])]} />
          <div className="ml-auto text-xs font-mono text-board-400">{filtered.length} Trades</div>
        </div>

        {/* Trade board */}
        <div className="flap-panel rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-board-400 border-b border-board-700">
                  <th className="py-3 px-4">Coin</th>
                  <th className="py-3 px-4">Seite</th>
                  <th className="py-3 px-4">Entry</th>
                  <th className="py-3 px-4">Exit</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">PNL</th>
                  <th className="py-3 px-4">Dauer</th>
                  <th className="py-3 px-4">Geöffnet</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-board-800 last:border-0 hover:bg-board-800/60 transition-colors">
                    <td className="py-3 px-4 text-flap-bone font-medium">{t.coin}</td>
                    <td className="py-3 px-4">
                      <span className={`uppercase text-xs tracking-wide ${t.side === 'long' ? 'text-up' : 'text-down'}`}>{t.side}</span>
                    </td>
                    <td className="py-3 px-4 tabular text-board-400">{t.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                    <td className="py-3 px-4 tabular text-board-400">{t.exitPrice != null ? t.exitPrice.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</td>
                    <td className="py-3 px-4 tabular text-board-400">{t.size.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                    <td className={`py-3 px-4 tabular font-medium ${t.pnl >= 0 ? 'text-up' : 'text-down'}`}>{fmtUsd(t.pnl)}</td>
                    <td className="py-3 px-4 tabular text-board-400">{fmtDuration(t.openedAt, t.closedAt)}</td>
                    <td className="py-3 px-4 tabular text-board-400">{fmtDate(t.openedAt)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${t.status === 'open' ? 'bg-flap-amber/15 text-flap-amber' : 'bg-board-700 text-board-400'}`}>
                        {t.status === 'open' ? 'Offen' : 'Geschlossen'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-board-400 font-mono text-sm">
              {trades.length === 0 ? 'Noch keine Trades synced. Klicke auf "Sync now".' : 'Keine Trades in diesem Filter.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatModule({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flap-panel rounded-lg px-4 py-4 flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-board-400 font-mono">{label}</span>
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
    <label className="flex items-center gap-2 text-xs font-mono text-board-400">
      <span className="uppercase tracking-widest">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-board-800 border border-board-600 rounded px-2 py-1.5 text-flap-bone focus:outline-none focus:border-flap-amber/50"
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
