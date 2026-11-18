/** Shared building blocks for the dashboard views: icons, pills, small figures, card headers. */
import { useState } from 'react'
import FlipValue from './FlipValue'
import Skeleton from './Skeleton'

// Tries each icon source in order (falls back on load error), then a plain letter avatar.
export function iconSourcesFor(symbol: string, assetClass: 'crypto' | 'stock' | 'etf' | 'other'): string[] {
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

export function AssetIcon({
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

/** A native <select> dressed as a capsule, so phones still get their own picker. */
export function PillSelect({
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

export function IconChip({ children }: { children: React.ReactNode }) {
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ink-100 bg-white text-teal-800 shadow-card">{children}</span>
}

export function MiniFigure({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="min-w-0 px-3.5">
      <div className="text-[11px] text-ink-500">{label}</div>
      {loading ? <Skeleton className="mt-1.5 h-4 w-20" /> : <div className="mt-0.5 truncate text-[15px] text-ink-900 tabular">{value}</div>}
    </div>
  )
}

export function KeyFigure({ label, value, loading, tone = 'bone' }: { label: string; value: string; loading: boolean; tone?: 'bone' | 'teal' | 'up' | 'down' }) {
  return (
    <div className="card-row min-w-0 px-3 py-2.5">
      <dt className="truncate text-[11px] text-ink-500">{label}</dt>
      <dd className="mt-1 min-w-0 truncate">
        {loading ? <Skeleton className="h-4 w-14" /> : <FlipValue value={value} size="sm" tone={tone} />}
      </dd>
    </div>
  )
}

export const ICON_PROPS = {
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
export function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M9 4v4M9 20v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="5.5" y="8" width="7" height="12" rx="2.5" fill="currentColor" />
      <path d="M19 3v6M19 17v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
      <rect x="15.5" y="9" width="7" height="8" rx="2.5" stroke="currentColor" strokeWidth="2" opacity="0.65" />
    </svg>
  )
}

export function OverviewIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  )
}

export function PieIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
    </svg>
  )
}

export function PulseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
    </svg>
  )
}

export function WalletIcon() {
  return (
    <svg {...ICON_PROPS} width={18} height={18}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a1 1 0 0 1 1 1v2" />
      <path d="M4 7.5v9A2.5 2.5 0 0 0 6.5 19H19a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z" />
      <circle cx="16" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TrendIcon({ down }: { down: boolean }) {
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

export function SparkIcon() {
  return (
    <svg {...ICON_PROPS} width={14} height={14}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  )
}

export function AlertIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg {...ICON_PROPS} width={18} height={18}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg {...ICON_PROPS} width={15} height={15} className={spinning ? 'animate-spin' : ''}>
      <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
      <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

export function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg {...ICON_PROPS} width={14} height={14} className={`transition-transform ${up ? 'rotate-180' : ''}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg {...ICON_PROPS} width={18} height={18}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg {...ICON_PROPS} width={18} height={18}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}

/** Card title row: heading + one-line description on the left, an optional control on the right. */
export function CardHeader({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-1">
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium text-ink-900">{title}</h3>
        {sub && <p className="mt-0.5 text-[12px] text-ink-500">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/** Chapter marker between groups of cards: petrol dot, small caps label, hairline to the edge. */
export function SectionHeading({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-3 px-1 md:mt-10">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
      <h2 className="shrink-0 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-500">{title}</h2>
      <span className="h-px min-w-0 flex-1 bg-ink-200" aria-hidden="true" />
      {meta && <span className="shrink-0 text-[12px] text-ink-500 tabular">{meta}</span>}
    </div>
  )
}

/** Shown in a chart's place when there is nothing to plot yet. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card-row mt-4 px-4 py-8 text-center text-sm text-ink-500">{children}</div>
}

/** Turns all-caps fund-holding names ("APPLE INC") into readable ones ("Apple Inc"). */
export function prettyName(name: string) {
  if (name !== name.toUpperCase()) return name
  return name.toLowerCase().replace(/(^|[\s\-/.&(])([a-zà-ÿ])/g, (_, p, c) => p + c.toUpperCase())
}

const LOADER_CANDLES = [
  { h: 34, up: true },
  { h: 52, up: true },
  { h: 28, up: false },
  { h: 46, up: true },
  { h: 64, up: true },
  { h: 38, up: false },
  { h: 56, up: true }
]

/** Animated candle row shown while a price chart (library or data) is loading. */
export function ChartLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`} role="status" aria-live="polite">
      <div className="candle-loader flex h-16 items-center gap-2" aria-hidden="true">
        {LOADER_CANDLES.map((c, i) => (
          <span
            key={i}
            className={`block w-2.5 rounded-[3px] ${c.up ? 'bg-teal-700' : 'bg-teal-300'}`}
            style={{ height: c.h, animationDelay: `${i * 110}ms` }}
          />
        ))}
      </div>
      <div className="text-[13px] text-ink-500">Kursdaten werden geladen …</div>
    </div>
  )
}
