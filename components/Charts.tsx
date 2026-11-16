import { useMemo, useState } from 'react'

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function compactUsd(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : n > 0 ? '+' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

interface ClosedTrade {
  id: string
  coin: string
  pnl: number
  closedAt: string
}

const DOT_ROWS = 5

/**
 * PnL per closed trade as a dot matrix: one column per trade, oldest left. Wins stack teal dots
 * upward from the centre line, losses stack red dots downward, each column scaled to the largest
 * single result in view. The top dot of each stack is solid; the dots beneath it soften.
 */
export function TradeDotMatrix({ trades, hideValues, maxColumns = 26 }: { trades: ClosedTrade[]; hideValues: boolean; maxColumns?: number }) {
  const cols = trades.slice(-maxColumns)
  const maxAbs = Math.max(1, ...cols.map((t) => Math.abs(t.pnl)))

  if (cols.length === 0) {
    return <div className="flex h-[188px] items-center justify-center text-sm text-ink-400">Noch keine geschlossenen Trades in diesem Zeitraum</div>
  }

  const labelEvery = Math.max(1, Math.ceil(cols.length / 6))
  const axis = hideValues ? ['•••', '0', '•••'] : [compactUsd(maxAbs), '$0', compactUsd(-maxAbs)]

  return (
    <div className="flex gap-3">
      <div className="flex w-10 shrink-0 flex-col justify-between py-0.5 text-[11px] text-ink-400 tabular">
        <span>{axis[0]}</span>
        <span>{axis[1]}</span>
        <span>{axis[2]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="grid gap-x-[3px]" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map((t) => {
            const level = Math.max(1, Math.round((Math.abs(t.pnl) / maxAbs) * DOT_ROWS))
            const win = t.pnl >= 0
            const when = new Date(t.closedAt)
            return (
              <div
                key={t.id}
                className="flex flex-col items-center gap-[5px]"
                title={`${t.coin} · ${when.toLocaleDateString('de-DE')}${hideValues ? '' : ` · ${compactUsd(t.pnl)}`}`}
              >
                {Array.from({ length: DOT_ROWS }, (_, r) => {
                  // r = 0 is the top row; a win of `level` fills the bottom `level` rows of the upper half.
                  const filled = win && DOT_ROWS - r <= level
                  const isCap = filled && DOT_ROWS - r === level
                  return <Dot key={`u${r}`} tone={filled ? (isCap ? 'teal-strong' : 'teal-soft') : 'empty'} />
                })}
                <span className="my-[1px] h-px w-full bg-ink-200" />
                {Array.from({ length: DOT_ROWS }, (_, r) => {
                  const filled = !win && r + 1 <= level
                  const isCap = filled && r + 1 === level
                  return <Dot key={`d${r}`} tone={filled ? (isCap ? 'red-strong' : 'red-soft') : 'empty'} />
                })}
              </div>
            )
          })}
        </div>
        <div className="mt-3 grid gap-x-[3px] text-[11px] text-ink-400" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map((t, i) => {
            // Labels are centred on their column but may be wider than it; skip the last few columns so
            // the final label never runs past the card edge.
            const show = i % labelEvery === 0 && i <= cols.length - Math.ceil(labelEvery / 2) - 1
            return (
              <span key={t.id} className={`whitespace-nowrap ${i === 0 ? 'justify-self-start' : 'justify-self-center'}`}>
                {show ? new Date(t.closedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : ''}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Dot({ tone }: { tone: 'teal-strong' | 'teal-soft' | 'red-strong' | 'red-soft' | 'empty' }) {
  const cls = {
    'teal-strong': 'bg-teal-800',
    'teal-soft': 'bg-teal-300',
    'red-strong': 'bg-down',
    'red-soft': 'bg-down/35',
    empty: 'bg-ink-150'
  }[tone]
  return <span className={`block aspect-square w-full max-w-[9px] rounded-full ${cls}`} />
}

type BarMetric = 'pnl' | 'count'

/**
 * Realized PnL (or number of closed trades) per calendar month for the last six months. Bars rise
 * from or hang below a zero line; the selected month is drawn with a diagonal hatch and a dark
 * label pill, the rest stay pale so the eye lands on one month at a time. Tap or hover selects.
 */
export function MonthlyBars({ trades, hideValues, metric }: { trades: ClosedTrade[]; hideValues: boolean; metric: BarMetric }) {
  const months = useMemo(() => {
    const now = new Date()
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS_DE[d.getMonth()], year: d.getFullYear(), pnl: 0, count: 0 }
    })
    const index = new Map(buckets.map((b, i) => [b.key, i]))
    for (const t of trades) {
      const d = new Date(t.closedAt)
      const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (i == null) continue
      buckets[i].pnl += t.pnl
      buckets[i].count += 1
    }
    return buckets
  }, [trades])

  const lastActive = months.reduce((acc, m, i) => (m.count > 0 ? i : acc), months.length - 1)
  const [selected, setSelected] = useState(lastActive)
  const values = months.map((m) => (metric === 'pnl' ? m.pnl : m.count))
  const maxPos = Math.max(0, ...values)
  const maxNeg = Math.max(0, ...values.map((v) => -v))
  const span = maxPos + maxNeg || 1
  const zeroFromTop = (maxPos / span) * 100

  const fmt = (v: number) => (metric === 'count' ? `${v} Trades` : hideValues ? '•••••' : compactUsd(v))
  const axis =
    metric === 'count'
      ? [String(maxPos), String(Math.round(maxPos / 2)), '0']
      : hideValues
        ? ['•••', '0', '•••']
        : maxNeg > 0 && maxPos > 0
          ? [compactUsd(maxPos), '$0', compactUsd(-maxNeg)]
          : maxNeg > 0
            ? ['$0', compactUsd(-maxNeg / 2), compactUsd(-maxNeg)]
            : [compactUsd(maxPos), compactUsd(maxPos / 2), '$0']

  return (
    <div className="flex gap-3">
      <div className="flex w-10 shrink-0 flex-col justify-between pt-5 pb-11 text-[11px] text-ink-400 tabular">
        {axis.map((a, i) => (
          <span key={i}>{a}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        {/* Plot area sits inside 28px of headroom top and bottom so the label pill always fits. */}
        <div className="relative h-52 py-7">
          <div className="relative h-full">
          <span className="absolute inset-x-0 h-px bg-ink-200" style={{ top: `${zeroFromTop}%` }} />
          <div className="absolute inset-0 grid grid-cols-6 gap-2 md:gap-3">
            {months.map((m, i) => {
              const v = values[i]
              const heightPct = (Math.abs(v) / span) * 100
              const positive = v >= 0
              const active = i === selected
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelected(i)}
                  onMouseEnter={() => setSelected(i)}
                  className="relative h-full"
                  aria-label={`${m.label} ${m.year}: ${fmt(v)}`}
                  aria-pressed={active}
                >
                  {v !== 0 ? (
                    <span
                      className={`absolute inset-x-0 rounded-xl transition-colors ${
                        active ? (positive ? 'bar-hatch' : 'bar-hatch-down') : positive ? 'bg-teal-100' : 'bg-down-soft'
                      }`}
                      style={
                        positive
                          ? { bottom: `${100 - zeroFromTop}%`, height: `max(${heightPct}%, 6px)` }
                          : { top: `${zeroFromTop}%`, height: `max(${heightPct}%, 6px)` }
                      }
                    />
                  ) : (
                    // No trades that month: a short dash on the zero line instead of a fake bar.
                    <span
                      className={`absolute left-1/2 h-[3px] w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ${active ? 'bg-ink-700' : 'bg-ink-300'}`}
                      style={{ top: `${zeroFromTop}%` }}
                    />
                  )}
                  {active && (
                    <span
                      className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-950 px-2 py-1 text-[11px] font-medium text-white shadow-float tabular"
                      style={positive ? { bottom: `calc(${100 - zeroFromTop + heightPct}% + 8px)` } : { top: `calc(${zeroFromTop + heightPct}% + 8px)` }}
                    >
                      {m.label}: {fmt(v)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-2 md:gap-3 text-center text-[11px] text-ink-400">
          {months.map((m, i) => (
            <span key={m.key} className={i === selected ? 'font-medium text-ink-900' : ''}>
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Segmented share meter: `segments` slim bars, the first `share` fraction of them filled. */
export function SegmentMeter({ share, segments = 14 }: { share: number; segments?: number }) {
  const filled = Math.round(Math.min(1, Math.max(0, share)) * segments)
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={`h-4 w-[5px] rounded-full ${i < filled ? 'bg-teal-800' : 'bg-ink-150'}`} />
      ))}
    </span>
  )
}
