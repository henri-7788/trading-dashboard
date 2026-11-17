import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import TradeDetailModal from './TradeDetailModal'
import OverviewView from './views/OverviewView'
import PortfolioView from './views/PortfolioView'
import TradingView from './views/TradingView'
import { BrandMark, EyeIcon, GearIcon, OverviewIcon, PieIcon, PulseIcon, SyncIcon } from './ui'
import { fmtDate, fmtUsd, HIDE_VALUES_KEY, MASK, type Holding, type Trade } from '../lib/tradeStats'
import type { PortfolioAnalysis } from '../pages/api/portfolio-analysis'

export type View = 'uebersicht' | 'portfolio' | 'trading'

const VIEWS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: 'uebersicht', label: 'Übersicht', icon: <OverviewIcon /> },
  { key: 'portfolio', label: 'Portfolio', icon: <PieIcon /> },
  { key: 'trading', label: 'Trading', icon: <PulseIcon /> }
]

function isView(v: unknown): v is View {
  return v === 'uebersicht' || v === 'portfolio' || v === 'trading'
}

export default function Dashboard() {
  const router = useRouter()
  const view: View = isView(router.query.view) ? router.query.view : 'uebersicht'

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
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const analysisRequested = useRef(false)
  const initialSyncStarted = useRef(false)

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


  // The portfolio analysis is the expensive call (look-through data per ETF), so it is fetched the
  // first time the Portfolio tab opens and then kept for the session.
  const loadAnalysis = useCallback(async () => {
    setAnalysisError(null)
    try {
      const res = await fetch('/api/portfolio-analysis')
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error()
      setAnalysis(await res.json())
    } catch {
      setAnalysisError('Die Portfolio-Analyse konnte nicht geladen werden.')
    }
  }, [])

  useEffect(() => {
    if (view === 'portfolio' && !analysisRequested.current) {
      analysisRequested.current = true
      loadAnalysis()
    }
  }, [view, loadAnalysis])

  const navigate = (next: View) => {
    const query = { ...router.query }
    if (next === 'uebersicht') delete query.view
    else query.view = next
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'
  const intro: Record<View, string> = {
    uebersicht: accountLoaded
      ? connectionLabels.length > 0
        ? `Vermögen, offene Positionen und Trading-Performance aus ${connectionLabels.join(', ')} auf einen Blick.`
        : 'Noch keine Verbindung eingerichtet. Füge in den Einstellungen eine Börse oder Wallet hinzu.'
      : 'Vermögen, offene Positionen und Trading-Performance auf einen Blick.',
    portfolio: 'Wo dein Geld steckt: nach Ländern, Sektoren und Anlageklassen, inklusive der Unternehmen in deinen ETFs.',
    trading: 'Was deine Trades auszeichnet: Equity-Kurve, Drawdown, Kosten und wo du gewinnst oder verlierst.'
  }
  const heading: Record<View, string> = { uebersicht: `${greeting}.`, portfolio: 'Portfolio-Analyse', trading: 'Trading-Analyse' }

  return (
    <div className="min-h-screen pb-16">
      {/* THESIS: one petrol band carries the greeting, the three views, and the day's actions; everything below is calm near-white cards on cool grey, so the only saturated surfaces are the band, the insight card, and the data marks.
          OWN-WORLD: deep petrol (#0d3646 → #5e97a9) band with a fine dot screen, #edf0f0 ground, soft white cards with white inset rows, capsule pills, Geist at regular weight with tight tracking for figures, petrol charts (dot matrix, segment meters, donut, ranked bars, world map), green and brick red only for PnL direction.
          STORY: Übersicht answers "how am I doing"; Portfolio answers "where is my money" (countries, sectors, look-through); Trading answers "what makes my trades win or lose".
          FIRST VIEWPORT: band with brand, view tabs, title and Sync; below it the active view's first row of cards.
          FORM: user-supplied reference (petrol fintech dashboard), adapted to trading; three views via ?view= since 2026-11-16.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. */}
      <div className="mx-auto max-w-[1240px] px-3 sm:px-5 md:px-8 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-5">
        <nav className="flex h-14 items-center justify-between gap-3" aria-label="Hauptnavigation">
          <button type="button" onClick={() => navigate('uebersicht')} className="flex items-center gap-2.5 text-white">
            <BrandMark />
            <span className="text-[17px] md:text-[19px] font-medium tracking-[-0.015em]">Trading Dashboard</span>
          </button>
          <div className="hidden lg:block">
            <ViewTabs view={view} onChange={navigate} />
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

        <section className="pt-6 md:pt-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="text-white">
            <h1 className="text-[2rem] md:text-[2.75rem] font-normal leading-[1.05] tracking-[-0.035em]" suppressHydrationWarning>
              {heading[view]}
            </h1>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-white/75">{intro[view]}</p>
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
            <button type="button" onClick={toggleHideValues} className="pill-on-dark h-11 px-5 text-sm hidden sm:inline-flex" aria-pressed={!hideValues}>
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
          <div className="sm:hidden -mt-2 text-[12px] text-white/70 tabular">Zuletzt synced: {loading ? '…' : lastSyncedAt ? fmtDate(lastSyncedAt) : 'nie'}</div>
        </section>

        {/* Phones and tablets: the view switch sits under the title, full width. */}
        <div className="mt-5 lg:hidden">
          <ViewTabs view={view} onChange={navigate} stretch />
        </div>

        {error && <div className="card-tight mt-5 px-4 py-3 text-sm text-down">{error}</div>}

        <main className="mt-6 md:mt-10" id={`view-${view}`} role="tabpanel" aria-label={VIEWS.find((v) => v.key === view)?.label}>
          {view === 'uebersicht' && (
            <OverviewView
              trades={trades}
              holdings={holdings}
              loading={loading}
              accountLoaded={accountLoaded}
              holdingsLoaded={holdingsLoaded}
              accountValue={accountValue}
              holdingsValue={holdingsValue}
              withdrawable={withdrawable}
              hideValues={hideValues}
              usd={usd}
              qty={qty}
              onSelectTrade={setSelectedTrade}
              onNavigate={navigate}
            />
          )}
          {view === 'portfolio' && (
            <PortfolioView
              analysis={analysis}
              analysisError={analysisError}
              holdings={holdings}
              holdingsLoaded={holdingsLoaded}
              hideValues={hideValues}
              usd={usd}
              qty={qty}
              onRetry={loadAnalysis}
            />
          )}
          {view === 'trading' && <TradingView trades={trades} loading={loading} hideValues={hideValues} usd={usd} onSelectTrade={setSelectedTrade} />}
        </main>
      </div>

      {selectedTrade && <TradeDetailModal trade={selectedTrade} usd={usd} qty={qty} onClose={() => setSelectedTrade(null)} />}
    </div>
  )
}

/** Segmented view switch: on the band at desktop width, full-width under the title on phones. */
function ViewTabs({ view, onChange, stretch = false }: { view: View; onChange: (v: View) => void; stretch?: boolean }) {
  return (
    <div role="tablist" aria-label="Ansicht" className={`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] p-1 backdrop-blur-md ${stretch ? 'w-full' : ''}`}>
      {VIEWS.map((v) => {
        const active = v.key === view
        return (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`view-${v.key}`}
            onClick={() => onChange(v.key)}
            className={`flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] transition-colors ${stretch ? 'flex-1' : ''} ${
              active ? 'bg-white text-teal-900 shadow-card' : 'text-white/75 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            {v.icon}
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
