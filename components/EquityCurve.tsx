interface Point {
  t: number
  cum: number
}

/** Catmull-Rom → cubic Bézier, so the cumulative curve reads as one smooth stroke instead of a jagged polyline. */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

/**
 * Cumulative realized trading PnL as a soft petrol curve with a glowing end point — the small
 * chart inside the net-worth card. Faint vertical guides give it the ruled-paper texture of the
 * rest of the charts without the noise of axes.
 */
export default function EquityCurve({ points, className = '' }: { points: Point[]; className?: string }) {
  if (points.length < 2) {
    return (
      <div className={`flex items-center justify-center text-xs text-ink-400 text-center ${className}`}>
        Noch zu wenige geschlossene Trades
      </div>
    )
  }

  const w = 300
  const h = 120
  const padX = 8
  const padTop = 14
  const padBottom = 10
  const values = points.map((p) => p.cum)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const x = (i: number) => padX + (i / (points.length - 1)) * (w - padX * 2)
  const y = (v: number) => h - padBottom - ((v - min) / range) * (h - padTop - padBottom)
  const coords = points.map((p, i) => [x(i), y(p.cum)] as [number, number])
  const line = smoothPath(coords)
  const area = `${line} L ${coords[coords.length - 1][0].toFixed(2)} ${h} L ${coords[0][0].toFixed(2)} ${h} Z`
  const [endX, endY] = coords[coords.length - 1]
  const down = values[values.length - 1] < values[0]
  const stroke = down ? '#c4463c' : '#1a5366'
  const gradId = down ? 'eq-fill-down' : 'eq-fill-up'

  // The SVG stretches to its box (preserveAspectRatio none), which would squash circles into
  // ellipses — so the end marker is an HTML dot positioned by percentage on top of it.
  return (
    <div className={`relative ${className}`}>
    <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" role="img" aria-label="Kumulierter Trading-PnL">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 7 }, (_, i) => {
        const gx = padX + (i / 6) * (w - padX * 2)
        return <line key={i} x1={gx} y1={0} x2={gx} y2={h} stroke="#dde3e5" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      })}
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
      <span
        aria-hidden="true"
        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${(endX / w) * 100}%`, top: `${(endY / h) * 100}%`, background: stroke, opacity: 0.16 }}
      />
      <span
        aria-hidden="true"
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
        style={{ left: `${(endX / w) * 100}%`, top: `${(endY / h) * 100}%`, background: stroke }}
      />
    </div>
  )
}
