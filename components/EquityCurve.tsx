interface Point {
  t: number
  cum: number
}

export default function EquityCurve({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink-400">
        Noch nicht genug geschlossene Trades für eine Kurve
      </div>
    )
  }

  const w = 1000
  const h = 220
  const pad = 12
  const values = points.map((p) => p.cum)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1

  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2)
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2)
  const zeroY = y(0)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(p.cum).toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(2)} ${zeroY.toFixed(2)} L ${x(0).toFixed(2)} ${zeroY.toFixed(2)} Z`

  const last = points[points.length - 1].cum
  const stroke = last >= 0 ? '#32d74b' : '#ff453a'
  const glowId = last >= 0 ? 'equity-glow-up' : 'equity-glow-down'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40 md:h-52" preserveAspectRatio="none">
      <defs>
        <linearGradient id={glowId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4 4" />
      <path d={areaPath} fill={`url(#${glowId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
