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

// ── Allocation & ranking charts ─────────────────────────────────────────────────────────────

/** Petrol ramp for categorical shares, darkest = largest. "Nicht zugeordnet" is always grey. */
const RAMP = ['#0d3646', '#1a5366', '#2f7086', '#4a8aa0', '#6fa4b6', '#94bccb', '#b7d2dc', '#d3e4ea', '#e6eff2']

export function rampColor(index: number, key?: string) {
  if (key === 'unbekannt') return '#c4cdd0'
  return RAMP[Math.min(index, RAMP.length - 1)]
}

export interface Share {
  key: string
  label: string
  pct: number
  /** Display string for the absolute amount — already masked by the caller when values are hidden. */
  amount?: string
}

/**
 * Donut with a legend: the hovered (or first) segment is named in the centre. Small slices
 * beyond `maxSlices` are folded into "Weitere" so the ring stays readable.
 */
export function Donut({ items, maxSlices = 7, centerLabel, stacked = false }: { items: Share[]; maxSlices?: number; centerLabel?: string; stacked?: boolean }) {
  const [active, setActive] = useState<number | null>(null)
  const sorted = items.filter((i) => i.pct > 0)
  const shown = sorted.length > maxSlices ? sorted.slice(0, maxSlices - 1) : sorted
  const rest = sorted.length > maxSlices ? sorted.slice(maxSlices - 1) : []
  const slices: Share[] = rest.length ? [...shown, { key: 'weitere', label: `Weitere (${rest.length})`, pct: rest.reduce((s, r) => s + r.pct, 0) }] : shown

  const r = 42
  const c = 2 * Math.PI * r
  const gap = slices.length > 1 ? 1.2 : 0
  let offset = 0
  const focus = active != null ? slices[active] : slices[0]

  return (
    <div className={`flex flex-col items-center gap-5 ${stacked ? '' : 'sm:flex-row sm:items-center'}`}>
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Aufteilung">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#eef1f2" strokeWidth="12" />
          {slices.map((s, i) => {
            const len = Math.max(0, (s.pct / 100) * c - gap)
            const el = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={rampColor(i, s.key)}
                strokeWidth={active === i ? 14 : 12}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                className="cursor-pointer transition-[stroke-width]"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive(i)}
              />
            )
            offset += (s.pct / 100) * c
            return el
          })}
        </svg>
        {focus && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="text-[22px] leading-none tracking-[-0.02em] text-ink-900 tabular">{focus.pct.toFixed(focus.pct < 10 ? 1 : 0)}%</span>
            <span className="mt-1 line-clamp-2 text-[11px] leading-tight text-ink-500">{centerLabel && active == null ? centerLabel : focus.label}</span>
          </div>
        )}
      </div>
      <ul className="grid w-full min-w-0 gap-1.5">
        {slices.map((s, i) => (
          <li
            key={s.key}
            className={`flex items-center gap-2.5 rounded-xl px-2 py-1 text-[13px] transition-colors ${active === i ? 'bg-white' : ''}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: rampColor(i, s.key) }} />
            <span className="min-w-0 flex-1 truncate text-ink-700">{s.label}</span>
            {s.amount && <span className="hidden shrink-0 text-ink-500 tabular sm:inline">{s.amount}</span>}
            <span className="w-12 shrink-0 text-right text-ink-900 tabular">{s.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Ranked list with a proportional bar per row, scaled to the largest row. */
export function RankedBars({ items, limit = 8, leading }: { items: Share[]; limit?: number; leading?: (s: Share) => React.ReactNode }) {
  const rows = items.slice(0, limit)
  const max = Math.max(1e-9, ...rows.map((r) => r.pct))
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((s) => (
        <li key={s.key} className="grid grid-cols-[minmax(0,9rem)_1fr_3.25rem] items-center gap-3 text-[13px]">
          <span className="flex min-w-0 items-center gap-2 text-ink-700">
            {leading?.(s)}
            <span className="truncate">{s.label}</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-ink-100">
            <span
              className={`block h-full rounded-full ${s.key === 'unbekannt' ? 'bg-ink-300' : 'bg-teal-700'}`}
              style={{ width: `${Math.max(2, (s.pct / max) * 100)}%` }}
            />
          </span>
          <span className="text-right text-ink-900 tabular">{s.pct < 10 ? s.pct.toFixed(1) : s.pct.toFixed(0)}%</span>
        </li>
      ))}
    </ul>
  )
}

/** One horizontal bar split into shares, with a wrapping legend underneath. */
export function StackedBar({ items }: { items: Share[] }) {
  const parts = items.filter((i) => i.pct > 0)
  return (
    <div>
      <div className="flex h-3.5 w-full gap-[3px] overflow-hidden rounded-full">
        {parts.map((s, i) => (
          <span key={s.key} title={`${s.label}: ${s.pct.toFixed(1)}%`} style={{ width: `${s.pct}%`, background: rampColor(i, s.key) }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
        {parts.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5 text-ink-600">
            <span className="h-2 w-2 rounded-full" style={{ background: rampColor(i, s.key) }} />
            {s.label}
            <span className="text-ink-900 tabular">{s.pct.toFixed(s.pct < 10 ? 1 : 0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface SignedRow {
  key: string
  label: string
  value: number
  /** Formatted value (masked by the caller when hidden). */
  display: string
  hint?: string
}

/** Bars growing left (red) or right (green) from a centre axis — for anything with a PnL sign. */
export function DivergingBars({ rows, labelWidth = '6.5rem' }: { rows: SignedRow[]; labelWidth?: string }) {
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)))
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const w = (Math.abs(r.value) / max) * 50
        const up = r.value >= 0
        return (
          <li key={r.key} className="grid items-center gap-3 text-[13px]" style={{ gridTemplateColumns: `${labelWidth} 1fr 5.5rem` }}>
            <span className="min-w-0 truncate text-ink-700" title={r.hint ? `${r.label} · ${r.hint}` : r.label}>
              {r.label}
              {r.hint && <span className="ml-1.5 text-[11px] text-ink-400">{r.hint}</span>}
            </span>
            <span className="relative h-5">
              <span className="absolute inset-y-0 left-1/2 w-px bg-ink-200" />
              {r.value !== 0 && (
                <span
                  className={`absolute top-1/2 h-2.5 -translate-y-1/2 ${up ? 'rounded-r-full bg-up/80' : 'rounded-l-full bg-down/80'}`}
                  style={up ? { left: '50%', width: `${Math.max(w, 1)}%` } : { right: '50%', width: `${Math.max(w, 1)}%` }}
                />
              )}
            </span>
            <span className={`text-right tabular ${r.value > 0 ? 'text-up' : r.value < 0 ? 'text-down' : 'text-ink-400'}`}>{r.display}</span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Cumulative PnL (top) over its drawdown from the running peak (bottom), sharing one time axis.
 * The deepest drawdown is marked with a dot and its value.
 */
export function DrawdownChart({
  points,
  maxDrawdown,
  hideValues
}: {
  points: { t: number; cum: number; dd: number }[]
  maxDrawdown: number
  hideValues: boolean
}) {
  if (points.length < 2) {
    return <div className="flex h-56 items-center justify-center text-sm text-ink-400">Noch zu wenige geschlossene Trades</div>
  }
  const w = 600
  const hTop = 150
  const hDd = 70
  const pad = 6
  const cums = points.map((p) => p.cum)
  const minC = Math.min(0, ...cums)
  const maxC = Math.max(0, ...cums)
  const spanC = maxC - minC || 1
  const minDd = Math.min(-1e-9, ...points.map((p) => p.dd))
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2)
  const yTop = (v: number) => pad + ((maxC - v) / spanC) * (hTop - pad * 2)
  const yDd = (v: number) => (v / minDd) * (hDd - pad)
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${yTop(p.cum).toFixed(1)}`).join(' ')
  const ddArea = `M ${x(0)} 0 ` + points.map((p, i) => `L ${x(i).toFixed(1)} ${yDd(p.dd).toFixed(1)}`).join(' ') + ` L ${x(points.length - 1)} 0 Z`
  const worst = points.reduce((best, p, i) => (p.dd < points[best].dd ? i : best), 0)
  const up = cums[cums.length - 1] >= 0
  const stroke = up ? '#1a5366' : '#c4463c'
  const fmt = (v: number) => (hideValues ? '•••••' : `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)

  return (
    <div>
      <div className="relative h-40">
        <svg viewBox={`0 0 ${w} ${hTop}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Kumulierter PnL">
          <line x1={0} x2={w} y1={yTop(0)} y2={yTop(0)} stroke="#dde3e5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <path d={line} fill="none" stroke={stroke} strokeWidth={2.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute left-0 top-0 text-[11px] text-ink-400 tabular">{fmt(maxC)}</span>
        <span className="absolute bottom-0 left-0 text-[11px] text-ink-400 tabular">{fmt(minC)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-ink-400">
        <span>Drawdown vom Hoch</span>
        <span className="normal-case tracking-normal text-down tabular">Max. {fmt(maxDrawdown)}</span>
      </div>
      <div className="relative mt-1.5 h-16">
        <svg viewBox={`0 0 ${w} ${hDd}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Drawdown">
          <path d={ddArea} fill="#c4463c" fillOpacity={0.16} />
          <path d={points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${yDd(p.dd).toFixed(1)}`).join(' ')} fill="none" stroke="#c4463c" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-down ring-2 ring-white"
          style={{ left: `${(x(worst) / w) * 100}%`, top: `${(yDd(points[worst].dd) / hDd) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-400 tabular">
        <span>{new Date(points[0].t).toLocaleDateString('de-DE')}</span>
        <span>{new Date(points[points.length - 1].t).toLocaleDateString('de-DE')}</span>
      </div>
    </div>
  )
}

/** Compact grouped stat rows: label, PnL bar, win rate, count — for buckets like leverage or duration. */
export function BucketTable({ rows }: { rows: { key: string; label: string; pnl: number; pnlDisplay: string; winRate: number; count: number }[] }) {
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.pnl)))
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[5.5rem_1fr_3.5rem_2.5rem] gap-3 px-1 text-[11px] uppercase tracking-[0.08em] text-ink-400">
        <span />
        <span>PnL</span>
        <span className="text-right">Treffer</span>
        <span className="text-right">#</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[5.5rem_1fr_3.5rem_2.5rem] items-center gap-3 rounded-xl px-1 py-1.5 text-[13px]">
          <span className="text-ink-700">{r.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              {r.count > 0 && (
                <span className={`block h-full rounded-full ${r.pnl >= 0 ? 'bg-up/80' : 'bg-down/80'}`} style={{ width: `${Math.max(3, (Math.abs(r.pnl) / max) * 100)}%` }} />
              )}
            </span>
            <span className={`w-16 shrink-0 text-right tabular ${r.count === 0 ? 'text-ink-300' : r.pnl >= 0 ? 'text-up' : 'text-down'}`}>{r.count ? r.pnlDisplay : '—'}</span>
          </span>
          <span className="text-right text-ink-900 tabular">{r.count ? `${r.winRate.toFixed(0)}%` : '—'}</span>
          <span className="text-right text-ink-500 tabular">{r.count}</span>
        </div>
      ))}
    </div>
  )
}
