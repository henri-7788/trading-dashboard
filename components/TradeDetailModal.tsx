import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AssetIcon, AlertIcon, ChartLoader, CloseIcon } from './ui'
import { loadTradeChart } from '../lib/tradeChartClient'
import {
  fmtDate,
  fmtPct,
  liquidationDistancePct,
  liquidationRisk,
  LIQUIDATION_RISK_LABEL,
  pnlPct,
  totalPnlOf,
  type Trade
} from '../lib/tradeStats'

const TradeCandleChart = dynamic(() => import('./TradeCandleChart'), {
  ssr: false,
  loading: () => (
    <div className="mt-4">
      <div className="px-1 text-[11px] uppercase tracking-[0.12em] text-ink-400">Kursverlauf</div>
      <div className="card-row mt-2 px-1 pt-2">
        <ChartLoader className="h-[240px] md:h-[300px]" />
      </div>
    </div>
  )
})

export default function TradeDetailModal({
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

  // Start loading the candles right away, in parallel with the chart library chunk.
  useEffect(() => {
    loadTradeChart(t.id).catch(() => {})
  }, [t.id])

  // Closing plays the exit animation first; the parent unmounts us on animationend.
  const [closing, setClosing] = useState(false)
  const requestClose = useCallback(() => setClosing(true), [])
  // The parent passes a fresh onClose each render; a ref keeps the fallback timer from restarting.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Fallback in case animationend never arrives (e.g. the tab was hidden mid-animation).
  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(() => onCloseRef.current(), 600)
    return () => window.clearTimeout(id)
  }, [closing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [requestClose])

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
        ...((t.status === 'open'
          ? [
              ['Unrealisiert (live)', signed(t.pnl)],
              ['Teilgewinne realisiert', t.realizedPnl != null ? signed(t.realizedPnl) : '—'],
              ['Gesamt bisher', <span className="font-medium">{signed(totalPnlOf(t))}</span>]
            ]
          : [['PnL (realisiert)', signed(t.pnl)]]) as [string, React.ReactNode][]),
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
      className={`modal-backdrop fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-ink-950/35 backdrop-blur-[3px] ${closing ? 'is-closing' : ''}`}
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Trade-Details ${t.coin}`}
    >
      <div
        className={`card animate-sheet-up ${closing ? 'is-closing' : ''} w-full md:max-w-[640px] max-h-[88dvh] md:max-h-[85vh] overflow-y-auto overscroll-contain rounded-b-none md:rounded-3xl bg-ink-50 px-4 md:px-5 pt-2 md:pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-5`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) onClose()
        }}
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
          <button type="button" onClick={requestClose} aria-label="Schließen" className="pill -mr-1 h-11 w-11 shrink-0 text-ink-600">
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
        <TradeCandleChart trade={t} />
        <div className="md:grid md:grid-cols-2 md:gap-x-4">
        {groups.map((g) => (
          <div key={g.title} className={`mt-4 ${g.title === 'Ergebnis' ? 'md:col-span-2' : ''}`}>
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
    </div>
  )
}
