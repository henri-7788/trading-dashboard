import { useMemo, useState } from 'react'
import Skeleton from '../Skeleton'
import FlipValue from '../FlipValue'
import { BucketTable, DivergingBars, DrawdownChart, MonthlyBars, TradeDotMatrix } from '../Charts'
import { AlertIcon, AssetIcon, CardHeader, ChevronIcon, EmptyState, PillSelect } from '../ui'
import {
  closedChronological,
  costBreakdown,
  DURATION_BUCKETS,
  durationBucket,
  equityWithDrawdown,
  fmtDate,
  fmtDurationMs,
  fmtPct,
  groupClosed,
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
  WEEKDAYS,
  weekdayOf,
  type Range,
  type SideFilter,
  type StatusFilter,
  type Trade
} from '../../lib/tradeStats'

export interface TradingProps {
  trades: Trade[]
  loading: boolean
  hideValues: boolean
  usd: (n: number) => string
  onSelectTrade: (t: Trade) => void
}

const LIST_LIMIT = 10

/**
 * Trading analysis. One filter bar (period, side, coin) scopes every card; the trade list adds its
 * own status filter on top. All figures are computed client-side from the synced trades.
 */
export default function TradingView({ trades, loading, hideValues, usd, onSelectTrade }: TradingProps) {
  const [range, setRange] = useState<Range>('all')
  const [side, setSide] = useState<SideFilter>('all')
  const [coin, setCoin] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [barMetric, setBarMetric] = useState<'pnl' | 'count'>('pnl')
  const [showAll, setShowAll] = useState(false)

  const coins = useMemo(() => Array.from(new Set(trades.map((t) => t.coin))).sort(), [trades])

  const bySideCoin = useMemo(
    () => trades.filter((t) => (side === 'all' || t.side === side) && (coin === 'all' || t.coin === coin)),
    [trades, side, coin]
  )
  const scoped = useMemo(
    () =>
      bySideCoin.filter((t) => {
        // Open positions are current by definition — a period filter never hides them.
        if (range === 'all' || t.status === 'open') return true
        const ts = new Date(t.closedAt || t.openedAt).getTime()
        return !isNaN(ts) && Date.now() - ts <= RANGE_MS[range]
      }),
    [bySideCoin, range]
  )

  const s = useMemo(() => summarize(scoped), [scoped])
  const eq = useMemo(() => equityWithDrawdown(scoped), [scoped])
  const costs = useMemo(() => costBreakdown(scoped), [scoped])
  const byCoin = useMemo(() => groupClosed(scoped, (t) => t.coin, undefined, true), [scoped])
  const bySide = useMemo(() => groupClosed(scoped, (t) => t.side, [{ key: 'long', label: 'Long' }, { key: 'short', label: 'Short' }], true), [scoped])
  const extremes = useMemo(() => {
    const closed = closedChronological(scoped)
    const sorted = [...closed].sort((a, b) => b.pnl - a.pnl)
    return { best: sorted.filter((t) => t.pnl > 0).slice(0, 3), worst: sorted.filter((t) => t.pnl < 0).reverse().slice(0, 3) }
  }, [scoped])
  const byDuration = useMemo(() => groupClosed(scoped, durationBucket, DURATION_BUCKETS), [scoped])
  const byWeekday = useMemo(() => groupClosed(scoped, weekdayOf, WEEKDAYS), [scoped])
  const dots = useMemo(() => closedChronological(scoped).map((t) => ({ id: t.id, coin: t.coin, pnl: t.pnl, closedAt: t.closedAt! })), [scoped])
  // Monthly bars cover six calendar months by themselves, so they ignore the period filter.
  const monthly = useMemo(() => closedChronological(bySideCoin).map((t) => ({ id: t.id, coin: t.coin, pnl: t.pnl, closedAt: t.closedAt! })), [bySideCoin])

  const list = useMemo(
    () =>
      scoped
        .filter((t) => status === 'all' || t.status === status)
        // Open positions first, then newest first.
        .sort((a, b) =>
          a.status !== b.status
            ? a.status === 'open'
              ? -1
              : 1
            : new Date(b.closedAt || b.openedAt).getTime() - new Date(a.closedAt || a.openedAt).getTime()
        ),
    [scoped, status]
  )
  const visible = showAll ? list : list.slice(0, LIST_LIMIT)
  const openPositions = useMemo(() => scoped.filter((t) => t.status === 'open'), [scoped])

  const pf = s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)
  const payoff = s.payoff === Infinity ? '∞' : s.payoff.toFixed(2)
  const periodLabel = range === 'all' ? 'All-Time' : RANGE_LABEL[range]
  const bucketRows = (rows: typeof byDuration) => rows.map((r) => ({ ...r, pnlDisplay: usd(r.pnl) }))

  return (
    <>
      {/* Filter bar */}
      <div className="card flex flex-wrap items-center gap-2 px-4 py-3 md:px-5">
        <span className="mr-1 text-[13px] text-ink-500">Auswertung für</span>
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
          size="sm"
        />
        <PillSelect
          label="Seite"
          value={side}
          onChange={(v) => setSide(v as SideFilter)}
          options={[
            ['all', 'Long & Short'],
            ['long', 'Nur Long'],
            ['short', 'Nur Short']
          ]}
          size="sm"
        />
        <PillSelect label="Coin" value={coin} onChange={setCoin} options={[['all', 'Alle Coins'], ...coins.map((c) => [c, c] as [string, string])]} size="sm" />
        <span className="ml-auto text-[12px] text-ink-500 tabular">
          {loading ? '…' : `${s.closed} geschlossen · ${s.open} offen`}
        </span>
      </div>

      {/* KPI strip */}
      <div className="mt-3 md:mt-4 grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
        <Kpi
          label={`PnL · ${periodLabel}`}
          loading={loading}
          hint={s.open > 0 ? `offen: ${usd(s.openUnrealized)} unreal. · ${usd(s.openRealized)} Teilgewinne` : `Gebühren ${usd(-s.fees)}`}
        >
          <FlipValue value={usd(s.totalPnl)} size="lg" tone={s.totalPnl >= 0 ? 'up' : 'down'} />
        </Kpi>
        <Kpi label="Trefferquote" loading={loading} hint={`Profit Factor ${pf}`}>
          <FlipValue value={`${s.winRate.toFixed(1)}%`} size="lg" tone="teal" />
        </Kpi>
        <Kpi label="Erwartung pro Trade" loading={loading} hint={`Gewinn/Verlust-Verhältnis ${payoff}`}>
          <FlipValue value={usd(s.expectancy)} size="lg" tone={s.expectancy >= 0 ? 'up' : 'down'} />
        </Kpi>
        <Kpi label="Max. Drawdown" loading={loading} hint={`Serien: ${s.longestWinStreak}× Gewinn, ${s.longestLossStreak}× Verlust`}>
          <FlipValue value={usd(eq.maxDrawdown)} size="lg" tone={eq.maxDrawdown < 0 ? 'down' : 'bone'} />
        </Kpi>
      </div>

      {/* Open positions */}
      <section className="card rise-in mt-3 md:mt-4 p-4 md:p-5">
        <CardHeader
          title="Offene Positionen"
          sub={
            loading
              ? 'Lade…'
              : openPositions.length === 0
                ? 'Gerade keine offenen Positionen'
                : `${openPositions.length} offen · unrealisiert ${usd(s.openUnrealized)} · Teilgewinne ${usd(s.openRealized)}`
          }
        />
        {loading ? (
          <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
        ) : (
          openPositions.length > 0 && (
            <ul className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {openPositions.map((t) => (
                <li key={t.id}>
                  <OpenPositionRow t={t} usd={usd} onSelect={() => onSelectTrade(t)} />
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      {/* Equity + drawdown · costs + long/short */}
      <div className="mt-3 md:mt-4 grid gap-3 md:gap-4 lg:grid-cols-3 lg:items-start">
        <section className="card rise-in p-4 md:p-5 lg:col-span-2">
          <CardHeader title="Equity-Kurve & Drawdown" sub="Kumulierter realisierter PnL und Abstand zum bisherigen Hoch" />
          <div className="mt-5 px-1">{loading ? <Skeleton className="h-72 w-full rounded-2xl" /> : <DrawdownChart points={eq.points} maxDrawdown={eq.maxDrawdown} hideValues={hideValues} />}</div>
        </section>

        <div className="flex flex-col gap-3 md:gap-4">
          <section className="card rise-in p-4 md:p-5">
            <CardHeader title="Kosten" sub="Alles Realisierte inkl. Teilgewinnen: vor und nach Gebühren" />
            {loading ? (
              <Skeleton className="mt-4 h-28 w-full rounded-2xl" />
            ) : (
              <CostWaterfall gross={costs.gross} fees={costs.fees} net={costs.net} openFunding={costs.openFunding} usd={usd} />
            )}
          </section>

          <section className="card rise-in p-4 md:p-5">
            <CardHeader title="Long vs. Short" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {bySide.map((g) => (
                <div key={g.key} className="card-row px-3.5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${g.key === 'long' ? 'bg-up-soft text-up' : 'bg-down-soft text-down'}`}>{g.label}</span>
                  <div className={`mt-2 text-[17px] tracking-[-0.01em] tabular ${g.pnl >= 0 ? 'text-up' : 'text-down'}`}>{loading ? '…' : usd(g.pnl)}</div>
                  <div className="mt-0.5 text-[12px] text-ink-500 tabular">
                    {g.count} Trades · {g.count ? `${g.winRate.toFixed(0)}% Treffer` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Coin · leverage · duration */}
      <div className="mt-3 md:mt-4 grid gap-3 md:gap-4 lg:grid-cols-3 lg:items-start">
        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="PnL nach Coin" sub="Realisiert inkl. Teilgewinnen offener Positionen" />
          <div className="mt-5 px-1">
            {loading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : byCoin.length === 0 ? (
              <EmptyState>Keine geschlossenen Trades im Filter.</EmptyState>
            ) : (
              <DivergingBars rows={byCoin.slice(0, 10).map((g) => ({ key: g.key, label: g.label, value: g.pnl, display: usd(g.pnl), hint: `${g.count}×` }))} labelWidth="5.5rem" />
            )}
          </div>
        </section>
        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="Beste & schlechteste Trades" sub="Die drei größten Ausschläge in jede Richtung" />
          {loading ? (
            <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
          ) : extremes.best.length + extremes.worst.length === 0 ? (
            <EmptyState>Keine geschlossenen Trades im Filter.</EmptyState>
          ) : (
            <ul className="mt-4 flex flex-col gap-1.5">
              {[...extremes.best, ...extremes.worst].map((t, i) => (
                <li key={t.id}>
                  {i === extremes.best.length && extremes.best.length > 0 && <div className="my-1.5 h-px bg-ink-150" />}
                  <button
                    type="button"
                    onClick={() => onSelectTrade(t)}
                    className="card-row flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:border-ink-200 active:bg-ink-50"
                  >
                    <AssetIcon symbol={t.coin} assetClass="crypto" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-900">
                      {t.coin}
                      <span className="ml-1.5 text-[11px] uppercase tracking-[0.06em] text-ink-400">{t.side}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-400 tabular">{t.closedAt ? new Date(t.closedAt).toLocaleDateString('de-DE') : ''}</span>
                    <span className={`w-20 shrink-0 text-right text-[13px] tabular ${t.pnl >= 0 ? 'text-up' : 'text-down'}`}>{usd(t.pnl)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="Nach Haltedauer" sub={`Ø ${fmtDurationMs(s.avgDurationMs)} pro Trade`} />
          <div className="mt-4">{loading ? <Skeleton className="h-40 w-full rounded-2xl" /> : <BucketTable rows={bucketRows(byDuration)} />}</div>
        </section>
      </div>

      {/* Monthly · weekday · per trade */}
      <div className="mt-3 md:mt-4 grid gap-3 md:gap-4 lg:grid-cols-3 lg:items-start">
        <section className="card rise-in p-4 md:p-5">
          <CardHeader
            title="Monatliche Performance"
            sub="Realisiert, letzte sechs Monate"
            action={
              <PillSelect
                label="Kennzahl"
                value={barMetric}
                onChange={(v) => setBarMetric(v as 'pnl' | 'count')}
                options={[
                  ['pnl', 'PnL'],
                  ['count', 'Anzahl']
                ]}
              />
            }
          />
          <div className="mt-5 px-1">{loading ? <Skeleton className="h-52 w-full rounded-2xl" /> : <MonthlyBars trades={monthly} hideValues={hideValues} metric={barMetric} />}</div>
        </section>
        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="Nach Wochentag" sub="Tag, an dem der Trade geschlossen wurde" />
          <div className="mt-5 px-1">
            {loading ? (
              <Skeleton className="h-52 w-full rounded-2xl" />
            ) : (
              <DivergingBars rows={byWeekday.map((g) => ({ key: g.key, label: g.label, value: g.pnl, display: g.count ? usd(g.pnl) : '—', hint: g.count ? `${g.count}×` : undefined }))} labelWidth="3.5rem" />
            )}
          </div>
        </section>
        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="PnL pro Trade" sub="Jede Spalte ein geschlossener Trade" />
          <div className="mt-5 px-1">{loading ? <Skeleton className="h-48 w-full rounded-2xl" /> : <TradeDotMatrix trades={dots} hideValues={hideValues} maxColumns={22} />}</div>
        </section>
      </div>

      {/* Trade list */}
      <section className="card rise-in mt-3 md:mt-4 p-4 md:p-5">
        <CardHeader
          title="Trades"
          sub={loading ? 'Lade Trades…' : `${list.length} ${list.length === 1 ? 'Trade' : 'Trades'} · antippen für Details`}
          action={
            <PillSelect
              label="Status"
              value={status}
              onChange={(v) => setStatus(v as StatusFilter)}
              options={[
                ['all', 'Alle'],
                ['open', 'Offen'],
                ['closed', 'Geschlossen']
              ]}
            />
          }
        />
        <ul className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {loading &&
            [0, 1, 2, 3].map((i) => (
              <li key={i} className="card-row flex items-center gap-3 px-3.5 py-3.5">
                <Skeleton className="h-9 w-9 shrink-0" />
                <Skeleton className="h-3.5 flex-1" />
              </li>
            ))}
          {visible.map((t) => {
            const pct = pnlPct(t)
            const risk = liquidationRisk(t)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelectTrade(t)}
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
                      {hasPartialCloses(t) && (
                        <>
                          {' · Teilgewinne '}
                          <span className={t.realizedPnl! >= 0 ? 'text-up' : 'text-down'}>{usd(t.realizedPnl!)}</span>
                        </>
                      )}
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
        {!loading && list.length === 0 && <EmptyState>{trades.length === 0 ? 'Noch keine Trades synchronisiert.' : 'Keine Trades in diesem Filter.'}</EmptyState>}
        {list.length > LIST_LIMIT && (
          <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="pill mt-3 h-10 w-full text-[13px] text-ink-700">
            {showAll ? 'Weniger anzeigen' : `${list.length - LIST_LIMIT} weitere anzeigen`}
            <ChevronIcon up={showAll} />
          </button>
        )}
      </section>
    </>
  )
}

/**
 * One open position with everything needed to judge it at a glance: side and leverage, entry vs.
 * mark, live PnL and ROE, partial-close profits, and how much of the liquidation buffer is left.
 */
function OpenPositionRow({ t, usd, onSelect }: { t: Trade; usd: (n: number) => string; onSelect: () => void }) {
  const pct = pnlPct(t)
  const risk = liquidationRisk(t)
  const dist = liquidationDistancePct(t)
  // Large prices (BTC) don't need four decimals; small ones (XRP, DOGE) do.
  const price = (n: number | null) => (n != null ? n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1000 ? 1 : Math.abs(n) >= 1 ? 2 : 4 }) : '—')
  return (
    <button
      type="button"
      onClick={onSelect}
      className="card-row w-full px-3.5 py-3 text-left transition-colors hover:border-ink-200 active:bg-ink-50"
    >
      <div className="flex items-center gap-3">
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
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-[15px] tabular ${t.pnl >= 0 ? 'text-up' : 'text-down'}`}>{usd(t.pnl)}</div>
          <div className={`mt-0.5 text-[12px] tabular ${pct == null ? 'text-ink-400' : pct >= 0 ? 'text-up/80' : 'text-down/80'}`}>{pct != null ? `${fmtPct(pct)} ROE` : '—'}</div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ink-100 pt-2.5 text-[12px] sm:grid-cols-4">
        <div>
          <dt className="text-ink-400">Entry → Mark</dt>
          <dd className="truncate text-ink-800 tabular">
            {price(t.entryPrice)} → {price(t.markPrice)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-400">Teilgewinne</dt>
          <dd className={`tabular ${hasPartialCloses(t) ? (t.realizedPnl! >= 0 ? 'text-up' : 'text-down') : 'text-ink-400'}`}>{hasPartialCloses(t) ? usd(t.realizedPnl!) : 'keine'}</dd>
        </div>
        <div>
          <dt className="text-ink-400">Gesamt bisher</dt>
          <dd className={`tabular ${totalPnlOf(t) >= 0 ? 'text-up' : 'text-down'}`}>{usd(totalPnlOf(t))}</dd>
        </div>
        <div>
          <dt className="text-ink-400">Liquidation</dt>
          <dd className={`flex items-center gap-1 tabular ${risk ? LIQUIDATION_RISK_STYLE[risk] : 'text-ink-800'}`}>
            {risk && <AlertIcon size={12} />}
            {dist != null ? `${dist.toFixed(1)} % entfernt` : price(t.liquidationPrice)}
          </dd>
        </div>
      </dl>
    </button>
  )
}

function Kpi({ label, loading, hint, children }: { label: string; loading: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card min-w-0 px-4 py-4 md:px-5">
      <div className="eyebrow-label truncate">{label}</div>
      <div className="mt-1.5">{loading ? <Skeleton className="h-8 w-28 rounded-lg" /> : children}</div>
      {hint && !loading && <div className="mt-1 truncate text-[12px] text-ink-500" title={hint}>{hint}</div>}
    </div>
  )
}

/** Gross → fees → net as three bars on one scale, so the cost share is visible at a glance. */
function CostWaterfall({ gross, fees, net, openFunding, usd }: { gross: number; fees: number; net: number; openFunding: number; usd: (n: number) => string }) {
  const max = Math.max(1e-9, Math.abs(gross), Math.abs(fees), Math.abs(net))
  const rows = [
    { key: 'gross', label: 'Vor Gebühren', value: gross, cls: gross >= 0 ? 'bg-up/70' : 'bg-down/70' },
    { key: 'fees', label: 'Gebühren', value: -fees, cls: 'bg-amber/70' },
    { key: 'net', label: 'Nach Gebühren', value: net, cls: net >= 0 ? 'bg-up' : 'bg-down' }
  ]
  const feeShare = Math.abs(gross) > 0 ? (fees / Math.abs(gross)) * 100 : 0
  return (
    <div className="mt-4 flex flex-col gap-2.5 px-1">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3 text-[13px]">
          <span className="text-ink-700">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-ink-100">
            <span className={`block h-full rounded-full ${r.cls}`} style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }} />
          </span>
          <span className={`text-right tabular ${r.value >= 0 ? 'text-ink-900' : 'text-down'}`}>{usd(r.value)}</span>
        </div>
      ))}
      <p className="mt-1 text-[12px] text-ink-500">
        Gebühren entsprechen {feeShare.toFixed(0)} % des Brutto-Ergebnisses
        {openFunding !== 0 && <> · Funding offener Positionen: {usd(openFunding)}</>}.
      </p>
    </div>
  )
}
