import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type SeriesMarker,
  type Time,
  type UTCTimestamp
} from 'lightweight-charts'
import type { TradeChartData } from '../pages/api/trade-chart'
import type { Trade } from '../lib/tradeStats'
import { loadTradeChart } from '../lib/tradeChartClient'
import { ChartLoader } from './ui'

const UP = '#1d8556'
const DOWN = '#c4463c'
const PETROL = '#134456'
const AXIS = '#94a2a7'
const GRID = '#eef1f2'

const INTERVAL_LABEL: Record<string, string> = {
  '1m': '1-Minuten',
  '3m': '3-Minuten',
  '5m': '5-Minuten',
  '15m': '15-Minuten',
  '30m': '30-Minuten',
  '1h': '1-Stunden',
  '2h': '2-Stunden',
  '4h': '4-Stunden',
  '8h': '8-Stunden',
  '12h': '12-Stunden',
  '1d': 'Tages',
  '3d': '3-Tages',
  '1w': 'Wochen'
}

function priceFormat(p: number) {
  if (p >= 1000) return { type: 'price' as const, precision: 1, minMove: 0.1 }
  if (p >= 1) return { type: 'price' as const, precision: 3, minMove: 0.001 }
  return { type: 'price' as const, precision: 5, minMove: 0.00001 }
}

/** Start time (s) of the candle that contains `ms`, so markers land on an existing bar. */
function snap(candleStarts: number[], ms: number): UTCTimestamp {
  let lo = 0
  let hi = candleStarts.length - 1
  let best = candleStarts[0]
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (candleStarts[mid] <= ms) {
      best = candleStarts[mid]
      lo = mid + 1
    } else hi = mid - 1
  }
  return Math.floor(best / 1000) as UTCTimestamp
}

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: TradeChartData }

/**
 * Candlestick chart of the traded coin around a trade, with every execution marked:
 * openings as petrol arrows, (partial) closes as dots coloured by their realized PnL.
 */
export default function TradeCandleChart({ trade: t }: { trade: Trade }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const el = useRef<HTMLDivElement>(null)

  const load = useCallback(async (force = false) => {
    setState({ status: 'loading' })
    try {
      setState({ status: 'ready', data: await loadTradeChart(t.id, force) })
    } catch (err: any) {
      setState({ status: 'error', message: err?.message || 'Kursdaten konnten nicht geladen werden.' })
    }
  }, [t.id])

  useEffect(() => {
    load()
  }, [load])
  const retry = () => load(true)

  const data = state.status === 'ready' ? state.data : null

  useEffect(() => {
    if (!data || !el.current || data.candles.length === 0) return
    const chart = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: AXIS,
        fontSize: 11,
        fontFamily: getComputedStyle(el.current).fontFamily,
        attributionLogo: true
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderVisible: false, timeVisible: data.intervalMs < 86_400_000, secondsVisible: false },
      crosshair: {
        vertLine: { color: '#c4cdd0', labelBackgroundColor: PETROL },
        horzLine: { color: '#c4cdd0', labelBackgroundColor: PETROL }
      },
      // Vertical swipes keep scrolling the sheet on phones; horizontal drags pan the chart.
      handleScroll: { vertTouchDrag: false },
      localization: { locale: 'de-DE' }
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
      priceFormat: priceFormat(t.entryPrice),
      priceLineVisible: t.status === 'open',
      priceLineColor: '#4c5c62',
      priceLineStyle: LineStyle.Dotted
    })
    series.setData(
      data.candles.map((c) => ({ time: (c.t / 1000) as UTCTimestamp, open: c.o, high: c.h, low: c.l, close: c.c }))
    )

    const starts = data.candles.map((c) => c.t)
    const markers: SeriesMarker<Time>[] = []
    if (data.fills.length > 0) {
      let openIdx = -1
      data.fills.forEach((f, i) => {
        const isOpen = f.dir.startsWith('Open')
        if (isOpen) openIdx += 1
        const isFinal = t.status === 'closed' && i === data.fills.length - 1
        markers.push(
          isOpen
            ? {
                time: snap(starts, f.t),
                position: t.side === 'long' ? 'belowBar' : 'aboveBar',
                shape: t.side === 'long' ? 'arrowUp' : 'arrowDown',
                color: PETROL,
                text: openIdx === 0 ? (t.side === 'long' ? 'Long' : 'Short') : ''
              }
            : {
                time: snap(starts, f.t),
                position: 'atPriceMiddle',
                price: f.px,
                shape: 'circle',
                color: f.closedPnl >= 0 ? UP : DOWN,
                text: isFinal ? 'Exit' : ''
              }
        )
      })
    } else {
      // No wallet history: fall back to the stored open/close of the trade.
      markers.push({
        time: snap(starts, new Date(t.openedAt).getTime()),
        position: t.side === 'long' ? 'belowBar' : 'aboveBar',
        shape: t.side === 'long' ? 'arrowUp' : 'arrowDown',
        color: PETROL,
        text: t.side === 'long' ? 'Long' : 'Short'
      })
      if (t.status === 'closed' && t.closedAt && t.exitPrice != null) {
        markers.push({
          time: snap(starts, new Date(t.closedAt).getTime()),
          position: 'atPriceMiddle',
          price: t.exitPrice,
          shape: 'circle',
          color: t.pnl >= 0 ? UP : DOWN,
          text: 'Exit'
        })
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number))
    createSeriesMarkers(series, markers)

    series.createPriceLine({
      price: t.entryPrice,
      color: PETROL,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Ø Entry'
    })
    if (t.status === 'closed' && t.exitPrice != null) {
      series.createPriceLine({
        price: t.exitPrice,
        color: t.pnl >= 0 ? UP : DOWN,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Exit'
      })
    }
    if (t.status === 'open' && t.liquidationPrice != null) {
      series.createPriceLine({
        price: t.liquidationPrice,
        color: DOWN,
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: 'Liq.'
      })
    }

    chart.timeScale().fitContent()
    return () => chart.remove()
    // The dashboard refreshes trades every 15 s; only rebuild when chart-relevant fields change,
    // so the user's zoom/pan isn't reset on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, t.id, t.status, t.side, t.entryPrice, t.exitPrice, t.liquidationPrice])

  const shorterThanCandle =
    data != null && t.status === 'closed' && t.closedAt != null && new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime() < data.intervalMs
  const partials = data ? data.fills.filter((f) => !f.dir.startsWith('Open')).length - (t.status === 'closed' ? 1 : 0) : 0

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <div className="text-[11px] uppercase tracking-[0.12em] text-ink-400">Kursverlauf</div>
        {data && data.candles.length > 0 && (
          <div className="text-[11px] text-ink-400">{INTERVAL_LABEL[data.interval] ?? data.interval}-Kerzen</div>
        )}
      </div>
      <div className="card-row mt-2 overflow-hidden px-1 pt-2">
        {state.status === 'loading' && <ChartLoader className="h-[240px] md:h-[300px]" />}
        {state.status === 'error' && (
          <div className="flex h-[220px] md:h-[280px] flex-col items-center justify-center gap-3 px-6 text-center text-[13px] text-ink-500">
            {state.message}
            <button type="button" className="pill h-11 px-4 text-[13px]" onClick={retry}>
              Erneut versuchen
            </button>
          </div>
        )}
        {data && data.candles.length === 0 && (
          <div className="flex h-[220px] md:h-[280px] items-center justify-center px-6 text-center text-[13px] text-ink-500">
            Für {t.coin} liefert Hyperliquid für diesen Zeitraum keine Kerzen.
          </div>
        )}
        {data && data.candles.length > 0 && <div ref={el} className="h-[240px] md:h-[300px] w-full touch-pan-y" />}
      </div>
      {data && data.candles.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="text-teal-800">{t.side === 'long' ? '▲' : '▼'}</span>Eröffnung / Nachkauf
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-up" />
            <span className="-ml-1 h-2 w-2 rounded-full bg-down" />
            {partials > 0 ? `Teilverkauf (${partials})` : 'Teilverkauf'}
            {t.status === 'closed' ? ' / Exit' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-teal-800" />Ø Entry
          </span>
          {shorterThanCandle && <span className="text-ink-400">Trade kürzer als eine Kerze</span>}
        </div>
      )}
    </div>
  )
}
