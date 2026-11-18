import { useMemo, useState } from 'react'
import FlipValue from '../FlipValue'
import EquityCurve from '../EquityCurve'
import Skeleton from '../Skeleton'
import { Donut, SegmentMeter, TradeDotMatrix } from '../Charts'
import { AlertIcon, AssetIcon, CardHeader, ChevronIcon, IconChip, MiniFigure, PillSelect, SparkIcon, TrendIcon, WalletIcon, EmptyState } from '../ui'
import {
  ASSET_CLASS_LABEL,
  closedChronological,
  fmtDate,
  fmtPct,
  fmtUsd,
  hasPartialCloses,
  liquidationDistancePct,
  liquidationRisk,
  LIQUIDATION_RISK_LABEL,
  LIQUIDATION_RISK_STYLE,
  pnlPct,
  RANGE_LABEL,
  RANGE_MS,
  summarize,
  totalPnlOf,
  type Holding,
  type Range,
  type Trade
} from '../../lib/tradeStats'
import type { View } from '../Dashboard'

export interface OverviewProps {
  trades: Trade[]
  holdings: Holding[]
  loading: boolean
  accountLoaded: boolean
  holdingsLoaded: boolean
  accountValue: number | null
  holdingsValue: number | null
  withdrawable: number | null
  hideValues: boolean
  usd: (n: number) => string
  qty: (n: number, digits: number) => string
  onSelectTrade: (t: Trade) => void
  onNavigate: (v: View) => void
}

/** The daily glance: net worth, one sentence of interpretation, open positions, and what the money is in. */
export default function OverviewView(p: OverviewProps) {
  const { trades, holdings, loading, hideValues, usd, qty } = p
  const [range, setRange] = useState<Range>('all')

  const inRange = useMemo(
    () =>
      trades.filter((t) => {
        if (range === 'all' || t.status === 'open') return true
        const ts = new Date(t.closedAt || t.openedAt).getTime()
        return !isNaN(ts) && Date.now() - ts <= RANGE_MS[range]
      }),
    [trades, range]
  )
  const stats = useMemo(() => summarize(inRange), [inRange])
  const allStats = useMemo(() => summarize(trades), [trades])
  const allTimePnl = useMemo(() => trades.reduce((s, t) => s + totalPnlOf(t), 0), [trades])
  const closedRange = useMemo(() => closedChronological(inRange).map((t) => ({ id: t.id, coin: t.coin, pnl: t.pnl, closedAt: t.closedAt! })), [inRange])
  const equityPoints = useMemo(() => {
    let cum = 0
    return closedChronological(trades).map((t) => ({ t: new Date(t.closedAt!).getTime(), cum: (cum += t.pnl) }))
  }, [trades])

  const openTrades = useMemo(() => trades.filter((t) => t.status === 'open'), [trades])
  const holdingsTotal = useMemo(() => holdings.reduce((s, h) => s + (h.value ?? 0), 0), [holdings])
  const topHoldings = useMemo(() => [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 6), [holdings])
  const byClass = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of holdings) m.set(h.assetClass, (m.get(h.assetClass) || 0) + (h.value ?? 0))
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, label: ASSET_CLASS_LABEL[key] || key, pct: holdingsTotal > 0 ? (v / holdingsTotal) * 100 : 0, amount: usd(v) }))
      .sort((a, b) => b.pct - a.pct)
  }, [holdings, holdingsTotal, usd])

  const insight = useMemo(() => {
    const order = { critical: 0, warning: 1, caution: 2 } as const
    const risky = openTrades
      .map((t) => ({ t, risk: liquidationRisk(t) }))
      .filter((x): x is { t: Trade; risk: 'critical' | 'warning' } => x.risk === 'critical' || x.risk === 'warning')
      .sort((a, b) => order[a.risk] - order[b.risk])[0]
    if (risky) {
      const dist = liquidationDistancePct(risky.t)
      return {
        warning: true,
        title: `${risky.t.coin} ${risky.t.side === 'long' ? 'Long' : 'Short'} nähert sich der Liquidation.`,
        body: `Der Mark-Preis liegt nur noch ${dist != null ? `${dist.toFixed(1).replace('.', ',')} %` : 'wenig'} vom Liquidationspreis entfernt. Prüfe Margin oder Stop, bevor der Puffer aufgebraucht ist.`,
        action: 'Position öffnen',
        onAction: () => p.onSelectTrade(risky.t)
      }
    }
    if (allStats.closed === 0) {
      return {
        warning: false,
        title: 'Noch keine abgeschlossenen Trades.',
        body: 'Sobald Positionen geschlossen sind, steht hier, wie sich Trefferquote und Profit Factor entwickeln.',
        action: 'Zur Trading-Analyse',
        onAction: () => p.onNavigate('trading')
      }
    }
    const wr = `${allStats.winRate.toFixed(1).replace('.', ',')} %`
    const pf = allStats.profitFactor === Infinity ? '∞' : allStats.profitFactor.toFixed(2).replace('.', ',')
    const profitable = allStats.profitFactor >= 1
    return {
      warning: false,
      title: profitable ? 'Deine Gewinner tragen das Trading.' : 'Verluste überwiegen gerade.',
      body: profitable
        ? `Trefferquote ${wr}, Profit Factor ${pf}. Ein Ø Gewinn von ${usd(allStats.avgWin)} steht einem Ø Verlust von ${usd(allStats.avgLoss)} gegenüber.`
        : `Trefferquote ${wr}, Profit Factor ${pf}. Ein Ø Verlust von ${usd(allStats.avgLoss)} wiegt schwerer als ein Ø Gewinn von ${usd(allStats.avgWin)}.`,
      action: 'Zur Trading-Analyse',
      onAction: () => p.onNavigate('trading')
    }
  }, [openTrades, allStats, usd, p])

  return (
    <>
      {/* Row 1: net worth · PnL per trade · insight */}
      <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
        <div className="card rise-in p-5 md:p-6 flex flex-col min-h-[248px]" style={{ ['--i' as string]: 0 }}>
          <div className="flex items-center gap-3">
            <IconChip>
              <WalletIcon />
            </IconChip>
            <span className="text-[15px] text-ink-800">Gesamtvermögen</span>
          </div>
          <div className="mt-auto flex items-end gap-4 pt-6">
            <div className="min-w-0 shrink-0">
              {!p.accountLoaded ? (
                <Skeleton className="h-10 w-40 rounded-xl" />
              ) : (
                <FlipValue value={p.accountValue != null ? usd(p.accountValue) : '—'} size="xl" tone="bone" />
              )}
              <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-ink-500">
                <TrendIcon down={allTimePnl < 0} />
                {loading ? <Skeleton className="h-3 w-20" /> : <span className={allTimePnl >= 0 ? 'text-up' : 'text-down'}>{usd(allTimePnl)}</span>}
                <span>Trading-PnL</span>
              </div>
            </div>
            <EquityCurve points={equityPoints.slice(-40)} className="h-24 min-w-0 flex-1" />
          </div>
          <div className="mt-5 grid grid-cols-2 divide-x divide-ink-150 rounded-2xl bg-white px-1 py-3 border border-ink-100">
            <MiniFigure label="Portfolio" loading={!p.accountLoaded} value={p.holdingsValue != null ? usd(p.holdingsValue) : '—'} />
            <MiniFigure label="Verfügbares Cash" loading={!p.accountLoaded} value={p.withdrawable != null ? usd(p.withdrawable) : '—'} />
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
            {loading ? <Skeleton className="h-[188px] w-full rounded-2xl" /> : <TradeDotMatrix trades={closedRange} hideValues={hideValues} />}
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

      {/* Row 2: open positions + allocation stacked · largest holdings across two columns, so the row ends flush */}
      <div className="mt-3 md:mt-4 grid gap-3 md:gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 md:gap-4">
          <section className="card rise-in p-4 md:p-5" style={{ ['--i' as string]: 3 }}>
            <CardHeader
              title="Offene Positionen"
              sub={
                loading
                  ? 'Lade…'
                  : `${openTrades.length} offen · unrealisiert ${usd(allStats.openUnrealized)}${
                      openTrades.some(hasPartialCloses) ? ` · Teilgewinne ${usd(allStats.openRealized)}` : ''
                    }`
              }
            />
            {loading ? (
              <ul className="mt-4 flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <li key={i} className="card-row flex items-center gap-3 px-3.5 py-3.5">
                    <Skeleton className="h-9 w-9 shrink-0" />
                    <Skeleton className="h-3.5 flex-1" />
                  </li>
                ))}
              </ul>
            ) : openTrades.length === 0 ? (
              <EmptyState>Gerade keine offenen Positionen.</EmptyState>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {openTrades.map((t) => {
                  const pct = pnlPct(t)
                  const risk = liquidationRisk(t)
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => p.onSelectTrade(t)}
                        className="card-row flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:border-ink-200 active:bg-ink-50"
                      >
                        <AssetIcon symbol={t.coin} assetClass="crypto" size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] text-ink-900">{t.coin}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${t.side === 'long' ? 'bg-up-soft text-up' : 'bg-down-soft text-down'}`}>
                              {t.side}
                              {t.leverage != null && ` ${t.leverage}x`}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[12px] text-ink-500 tabular">
                            {t.connectionLabel ? `${t.connectionLabel} · ` : ''}seit {fmtDate(t.openedAt)}
                          </div>
                          {hasPartialCloses(t) && (
                            <div className="mt-0.5 text-[12px] text-ink-500 tabular">
                              Teilgewinne realisiert: <span className={t.realizedPnl! >= 0 ? 'text-up' : 'text-down'}>{usd(t.realizedPnl!)}</span>
                            </div>
                          )}
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
            )}
          </section>
          <section className="card rise-in flex flex-1 flex-col p-4 md:p-5" style={{ ['--i' as string]: 5 }}>
            <CardHeader title="Anlageklassen" sub="Anteil am Portfoliowert" />
            <div className="mt-5 flex flex-1 flex-col justify-center px-1">
              {!p.holdingsLoaded ? <Skeleton className="h-40 w-full rounded-2xl" /> : byClass.length === 0 ? <EmptyState>Noch keine Positionen.</EmptyState> : <Donut items={byClass} centerLabel="größte Klasse" />}
            </div>
          </section>
        </div>

        <section className="card rise-in flex flex-col p-4 md:p-5 lg:col-span-2" style={{ ['--i' as string]: 4 }}>
          <CardHeader title="Größte Positionen" sub={p.holdingsLoaded ? `${usd(holdingsTotal)} in ${holdings.length} Positionen` : 'Lade…'} />
          {!p.holdingsLoaded ? (
            <ul className="mt-4 flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="card-row flex items-center gap-3 px-3.5 py-3.5">
                  <Skeleton className="h-9 w-9 shrink-0" />
                  <Skeleton className="h-3.5 flex-1" />
                </li>
              ))}
            </ul>
          ) : holdings.length === 0 ? (
            <EmptyState>Keine gehaltenen Positionen.</EmptyState>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {topHoldings.map((h, i) => {
                const share = holdingsTotal > 0 && h.value != null ? h.value / holdingsTotal : 0
                return (
                  <li key={`${h.source}-${h.symbol}-${i}`} className="card-row flex items-center gap-3 px-3.5 py-3">
                    <AssetIcon symbol={h.symbol} assetClass={h.assetClass} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[15px] text-ink-900">{h.name && h.name !== h.symbol ? h.name : h.symbol}</span>
                        <span className="shrink-0 text-[15px] text-ink-900 tabular">{h.value != null ? usd(h.value) : '—'}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span className="truncate text-[12px] text-ink-500 tabular">
                          {qty(h.quantity, 6)} {h.symbol}
                          {h.price != null && ` à ${fmtUsd(h.price)}`}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <SegmentMeter share={share} segments={10} />
                          <span className="w-8 text-right text-[12px] text-ink-700 tabular">{Math.round(share * 100)}%</span>
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="h-3 shrink-0" aria-hidden="true" />
          <button type="button" onClick={() => p.onNavigate('portfolio')} className="pill mt-auto h-10 w-full text-[13px] text-ink-700">
            Zur Portfolio-Analyse
            <span className="-rotate-90">
              <ChevronIcon up={false} />
            </span>
          </button>
        </section>
      </div>
    </>
  )
}
