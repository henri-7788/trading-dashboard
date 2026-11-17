import { useMemo, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import world from 'world-atlas/countries-110m.json'
import { countryLabelDe, normalizeCountry } from '../lib/countries'

const W = 960
const H = 470

/** Petrol steps from faint to deep; exposure is bucketed on a log-ish scale so 0.3 % still shows. */
const STEPS = ['#dceaee', '#bcd6de', '#8fb9c6', '#5e97a9', '#3b7b90', '#1a5366', '#0d3646']
function stepFor(pct: number, maxPct: number) {
  if (pct <= 0) return null
  const t = Math.log1p(pct) / Math.log1p(Math.max(maxPct, 1))
  return STEPS[Math.min(STEPS.length - 1, Math.max(0, Math.round(t * (STEPS.length - 1))))]
}

interface CountryShape {
  iso2: string | null
  name: string
  d: string
}

/**
 * Choropleth of look-through country exposure. Countries the portfolio doesn't touch stay a pale
 * grey; touched ones step through the petrol ramp. Hover or tap names the country and its share.
 */
export default function WorldMap({ shares }: { shares: Record<string, number> }) {
  const [hover, setHover] = useState<{ iso2: string | null; name: string } | null>(null)

  const shapes = useMemo<CountryShape[]>(() => {
    const topo = world as any
    const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>
    const features = fc.features.filter((f) => f.properties?.name !== 'Antarctica')
    const projection = geoNaturalEarth1().fitExtent(
      [
        [4, 4],
        [W - 4, H - 4]
      ],
      { type: 'FeatureCollection', features } as FeatureCollection
    )
    const path = geoPath(projection)
    return features.map((f: Feature<Geometry, { name: string }>) => ({
      iso2: normalizeCountry(f.properties?.name),
      name: f.properties?.name || '',
      d: path(f) || ''
    }))
  }, [])

  const maxPct = Math.max(0, ...Object.values(shares))
  const hoverPct = hover?.iso2 ? shares[hover.iso2] ?? 0 : 0

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Länderverteilung auf der Weltkarte">
        {shapes.map((s, i) => {
          const pct = s.iso2 ? shares[s.iso2] ?? 0 : 0
          const fill = stepFor(pct, maxPct) ?? '#e6eaeb'
          const active = hover?.name === s.name
          return (
            <path
              key={`${s.name}-${i}`}
              d={s.d}
              fill={fill}
              stroke={active ? '#08161c' : '#ffffff'}
              strokeWidth={active ? 1.2 : 0.5}
              className="cursor-pointer transition-[fill]"
              onMouseEnter={() => setHover({ iso2: s.iso2, name: s.name })}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover({ iso2: s.iso2, name: s.name })}
            />
          )
        })}
      </svg>
      <div className="pointer-events-none absolute left-2 top-2 min-h-[44px] rounded-xl bg-white/90 px-3 py-2 text-[12px] shadow-card backdrop-blur-sm">
        {hover ? (
          <>
            <div className="text-ink-900">{hover.iso2 ? countryLabelDe(hover.iso2) : hover.name}</div>
            <div className="text-ink-500 tabular">{hoverPct > 0 ? `${hoverPct < 10 ? hoverPct.toFixed(2) : hoverPct.toFixed(1)} % des Portfolios` : 'Kein Anteil'}</div>
          </>
        ) : (
          <div className="text-ink-500">Land antippen für Details</div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-ink-400">
        <span>wenig</span>
        <span className="flex gap-[2px]">
          {STEPS.map((c) => (
            <span key={c} className="h-2 w-5 first:rounded-l-full last:rounded-r-full" style={{ background: c }} />
          ))}
        </span>
        <span>viel</span>
      </div>
    </div>
  )
}
