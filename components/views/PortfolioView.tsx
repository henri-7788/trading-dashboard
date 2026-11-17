import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Skeleton from '../Skeleton'
import FlipValue from '../FlipValue'
import { DivergingBars, Donut, RankedBars, SegmentMeter, StackedBar, type Share } from '../Charts'
import { AssetIcon, CardHeader, ChevronIcon, EmptyState, PillSelect, prettyName } from '../ui'
import { countryLabelDe } from '../../lib/countries'
import { ASSET_CLASS_LABEL, fmtUsd, sortHoldings, type Holding, type HoldingSortKey, type SortDir } from '../../lib/tradeStats'
import type { PortfolioAnalysis, Bucket } from '../../pages/api/portfolio-analysis'

// The map pulls in d3-geo and the world shapes (~100 KB) — only loaded when this view is opened.
const WorldMap = dynamic(() => import('../WorldMap'), {
  ssr: false,
  loading: () => <Skeleton className="aspect-[2/1] w-full rounded-2xl" />
})

export interface PortfolioProps {
  analysis: PortfolioAnalysis | null
  analysisError: string | null
  holdings: Holding[]
  holdingsLoaded: boolean
  hideValues: boolean
  usd: (n: number) => string
  qty: (n: number, digits: number) => string
  onRetry: () => void
}

const SPECIAL_COUNTRY = new Set(['KRYPTO', 'unbekannt'])

function countryShares(buckets: Bucket[], usd: (n: number) => string): Share[] {
  return buckets.map((b) => ({ key: b.key, label: SPECIAL_COUNTRY.has(b.key) ? b.label : countryLabelDe(b.key), pct: b.pct, amount: usd(b.value) }))
}

function flagFor(iso2: string) {
  if (!/^[A-Z]{2}$/.test(iso2)) return null
  return String.fromCodePoint(...iso2.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/**
 * Portfolio analysis: where the money is by country, sector, asset class, and underlying company
 * (ETF look-through), plus concentration and per-position performance.
 */
export default function PortfolioView(p: PortfolioProps) {
  const { analysis: a, usd, qty } = p
  const [excludeCrypto, setExcludeCrypto] = useState(false)
  const [sort, setSort] = useState<{ key: HoldingSortKey; dir: SortDir }>({ key: 'value', dir: 'desc' })
  const [showAll, setShowAll] = useState(false)

  // "Ohne Krypto" re-normalises country/sector shares over the non-crypto part, so the
  // equity side of the portfolio can be read on its own when crypto dominates the total.
  const view = useMemo(() => {
    if (!a) return null
    const scale = (list: Bucket[], dropKey: string) => {
      const kept = excludeCrypto ? list.filter((b) => b.key !== dropKey) : list
      const total = kept.reduce((s, b) => s + b.value, 0)
      return kept.map((b) => ({ ...b, pct: total > 0 ? (b.value / total) * 100 : 0 }))
    }
    return {
      countries: scale(a.countries, 'KRYPTO'),
      regions: scale(a.regions, 'Krypto'),
      sectors: scale(a.sectors, 'krypto')
    }
  }, [a, excludeCrypto])

  const mapShares = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of view?.countries ?? []) if (!SPECIAL_COUNTRY.has(c.key)) out[c.key] = c.pct
    return out
  }, [view])

  const performers = useMemo(() => {
    if (!a) return []
    return a.positions
      .filter((x) => x.unrealizedPct != null)
      .sort((x, y) => (y.unrealizedPct ?? 0) - (x.unrealizedPct ?? 0))
      .map((x) => ({
        key: x.symbol,
        label: x.name,
        value: x.unrealizedPct ?? 0,
        display: `${(x.unrealizedPct ?? 0) >= 0 ? '+' : ''}${(x.unrealizedPct ?? 0).toFixed(1)}%`,
        hint: p.hideValues || x.unrealizedPnl == null ? undefined : usd(x.unrealizedPnl)
      }))
  }, [a, p.hideValues, usd])

  const sortedHoldings = useMemo(() => sortHoldings(p.holdings, sort.key, sort.dir), [p.holdings, sort])
  const holdingsTotal = useMemo(() => p.holdings.reduce((s, h) => s + (h.value ?? 0), 0), [p.holdings])
  const visible = showAll ? sortedHoldings : sortedHoldings.slice(0, 8)

  if (p.analysisError && !a) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-ink-700">{p.analysisError}</p>
        <button type="button" onClick={p.onRetry} className="pill-primary pill mt-4 h-10 px-5 text-sm">
          Erneut versuchen
        </button>
      </div>
    )
  }

  const loading = !a || !view
  const cryptoPct = a?.byAssetClass.find((b) => b.key === 'crypto')?.pct ?? 0

  return (
    <>
      {/* Key figures */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Kpi label="Portfoliowert" loading={loading}>
          <FlipValue value={a ? usd(a.totalValue) : '—'} size="lg" tone="bone" />
        </Kpi>
        <Kpi label="Unrealisierter PnL" loading={loading}>
          <FlipValue value={a ? usd(a.unrealizedPnl) : '—'} size="lg" tone={(a?.unrealizedPnl ?? 0) >= 0 ? 'up' : 'down'} />
        </Kpi>
        <Kpi label="Positionen" loading={loading} hint={a?.concentration.largest ? `größte: ${a.concentration.largest.name} ${a.concentration.largest.pct.toFixed(0)}%` : undefined}>
          <FlipValue value={a ? String(a.positionsCount) : '—'} size="lg" tone="bone" />
        </Kpi>
        <Kpi
          label="Effektive Streuung"
          loading={loading}
          hint={a ? 'wie so viele gleich große Positionen' : undefined}
        >
          <FlipValue value={a ? a.concentration.effectivePositions.toFixed(1).replace('.', ',') : '—'} size="lg" tone="teal" />
        </Kpi>
      </div>

      {/* Countries */}
      <section className="card rise-in mt-3 md:mt-4 p-4 md:p-5">
        <CardHeader
          title="Länder"
          sub="ETFs anteilig nach ihren Bestandteilen, Aktien nach Firmensitz"
          action={
            cryptoPct > 0 ? (
              <PillSelect
                label="Krypto einbeziehen"
                value={excludeCrypto ? 'ohne' : 'mit'}
                onChange={(v) => setExcludeCrypto(v === 'ohne')}
                options={[
                  ['mit', 'Mit Krypto'],
                  ['ohne', 'Ohne Krypto']
                ]}
              />
            ) : undefined
          }
        />
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="card-row p-3">{loading ? <Skeleton className="aspect-[2/1] w-full rounded-2xl" /> : <WorldMap shares={mapShares} />}</div>
          <div className="flex flex-col gap-5 px-1">
            <div>
              <div className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-ink-400">Regionen</div>
              {loading ? <Skeleton className="h-10 w-full rounded-xl" /> : <StackedBar items={view.regions.map((r) => ({ key: r.key, label: r.label, pct: r.pct }))} />}
            </div>
            <div>
              <div className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-ink-400">Top-Länder</div>
              {loading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : (
                <RankedBars
                  items={countryShares(view.countries, usd)}
                  limit={9}
                  leading={(s) => <span className="w-5 text-center text-[14px] leading-none">{flagFor(s.key) ?? '•'}</span>}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sectors · allocation · look-through */}
      <div className="mt-3 md:mt-4 grid gap-3 md:gap-4 lg:grid-cols-3 lg:items-start">
        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="Sektoren" sub={excludeCrypto ? 'ohne Krypto' : 'inklusive Krypto als eigener Sektor'} />
          <div className="mt-5 px-1">
            {loading ? (
              <Skeleton className="h-40 w-full rounded-2xl" />
            ) : (
              <Donut items={view.sectors.map((s) => ({ key: s.key, label: s.label, pct: s.pct, amount: usd(s.value) }))} maxSlices={8} centerLabel="größter Sektor" stacked />
            )}
          </div>
        </section>

        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="Aufteilung" sub="Nach Anlageklasse und Verwahrort" />
          <div className="mt-5 flex flex-col gap-6 px-1">
            <div>
              <div className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-ink-400">Anlageklasse</div>
              {loading ? <Skeleton className="h-10 w-full rounded-xl" /> : <StackedBar items={a.byAssetClass.map((b) => ({ key: b.key, label: b.label, pct: b.pct }))} />}
            </div>
            <div>
              <div className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-ink-400">Verwahrt bei</div>
              {loading ? <Skeleton className="h-10 w-full rounded-xl" /> : <StackedBar items={a.bySource.map((b) => ({ key: b.key, label: b.label, pct: b.pct }))} />}
            </div>
            {a && (
              <ul className="flex flex-col gap-2 text-[13px]">
                <ConcentrationNote
                  ok={(a.concentration.largest?.pct ?? 0) < 20}
                  text={a.concentration.largest ? `Größte Position ${a.concentration.largest.name}: ${a.concentration.largest.pct.toFixed(1)} %` : 'Keine Positionen'}
                />
                <ConcentrationNote ok={a.concentration.top5Pct < 60} text={`Top 5 zusammen: ${a.concentration.top5Pct.toFixed(0)} % des Portfolios`} />
                <ConcentrationNote ok={cryptoPct < 30} text={`Krypto-Anteil: ${cryptoPct.toFixed(0)} %`} />
              </ul>
            )}
          </div>
        </section>

        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="Größte Unternehmen" sub="Direkt gehalten und über ETFs zusammengerechnet" />
          {loading ? (
            <Skeleton className="mt-4 h-72 w-full rounded-2xl" />
          ) : a.lookThroughTop.length === 0 ? (
            <EmptyState>Keine Daten zu ETF-Bestandteilen.</EmptyState>
          ) : (
            <ul className="mt-4 flex flex-col gap-1.5">
              {a.lookThroughTop.slice(0, 10).map((c, i) => (
                <li key={c.key} className="card-row flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[12px] font-medium text-teal-800">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] text-ink-900">{prettyName(c.name)}</div>
                    <div className="text-[11px] text-ink-500">
                      {[c.direct ? 'direkt' : null, c.viaEtfs > 0 ? `in ${c.viaEtfs} ETF${c.viaEtfs === 1 ? '' : 's'}` : null].filter(Boolean).join(' + ')}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[14px] text-ink-900 tabular">{c.pct < 10 ? c.pct.toFixed(2) : c.pct.toFixed(1)}%</div>
                    <div className="text-[11px] text-ink-500 tabular">{usd(c.value)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Performance · all positions */}
      <div className="mt-3 md:mt-4 grid gap-3 md:gap-4 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <section className="card rise-in p-4 md:p-5">
          <CardHeader title="Gewinner & Verlierer" sub="Unrealisiert seit Kauf, nur Positionen mit Einstandspreis" />
          <div className="mt-5 px-1">
            {loading ? (
              <Skeleton className="h-60 w-full rounded-2xl" />
            ) : performers.length === 0 ? (
              <EmptyState>Für keine Position ist ein Einstandspreis bekannt.</EmptyState>
            ) : (
              <DivergingBars rows={performers} labelWidth="8.5rem" />
            )}
          </div>
        </section>

        <section className="card rise-in p-4 md:p-5">
          <CardHeader
            title="Alle Positionen"
            sub={p.holdingsLoaded ? `${usd(holdingsTotal)} in ${p.holdings.length} Positionen` : 'Lade…'}
            action={
              <PillSelect
                label="Sortieren"
                value={`${sort.key}:${sort.dir}`}
                onChange={(v) => {
                  const [key, dir] = v.split(':') as [HoldingSortKey, SortDir]
                  setSort({ key, dir })
                }}
                options={[
                  ['value:desc', 'Größte zuerst'],
                  ['value:asc', 'Kleinste zuerst'],
                  ['unrealizedPnl:desc', 'Bester PnL'],
                  ['unrealizedPnl:asc', 'Schwächster PnL'],
                  ['name:asc', 'Name A–Z'],
                  ['assetClass:asc', 'Typ'],
                  ['source:asc', 'Quelle']
                ]}
              />
            }
          />
          <ul className="mt-4 grid grid-cols-1 gap-2 xl:grid-cols-2">
            {!p.holdingsLoaded &&
              [0, 1, 2, 3].map((i) => (
                <li key={i} className="card-row flex items-center gap-3 px-3.5 py-3.5">
                  <Skeleton className="h-9 w-9 shrink-0" />
                  <Skeleton className="h-3.5 flex-1" />
                </li>
              ))}
            {visible.map((h, i) => {
              const share = holdingsTotal > 0 && h.value != null ? h.value / holdingsTotal : 0
              return (
                <li key={`${h.source}-${h.symbol}-${i}`} className="card-row px-3.5 py-3">
                  <div className="flex items-center gap-3">
                    <AssetIcon symbol={h.symbol} assetClass={h.assetClass} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[14px] text-ink-900">{h.name && h.name !== h.symbol ? h.name : h.symbol}</span>
                        <span className="shrink-0 text-[14px] text-ink-900 tabular">{h.value != null ? usd(h.value) : '—'}</span>
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[12px] text-ink-500">
                        <span className="truncate tabular">
                          {qty(h.quantity, 6)} {h.symbol}
                          {h.price != null && ` à ${fmtUsd(h.price)}`}
                        </span>
                        {h.unrealizedPnl != null && <span className={`shrink-0 tabular ${h.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>{usd(h.unrealizedPnl)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 pl-12">
                    <span className="min-w-0 truncate text-[11px] uppercase tracking-[0.1em] text-ink-400">
                      {ASSET_CLASS_LABEL[h.assetClass]} · {h.sourceLabel}
                    </span>
                    <span className="flex items-center gap-2">
                      <SegmentMeter share={share} segments={10} />
                      <span className="w-8 text-right text-[12px] text-ink-700 tabular">{Math.round(share * 100)}%</span>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          {sortedHoldings.length > 8 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="pill mt-3 h-10 w-full text-[13px] text-ink-700">
              {showAll ? 'Weniger anzeigen' : `${sortedHoldings.length - 8} weitere anzeigen`}
              <ChevronIcon up={showAll} />
            </button>
          )}
        </section>
      </div>

      {a && (
        <p className="mt-4 px-2 text-[12px] leading-relaxed text-ink-500">
          Länder, Sektoren und ETF-Bestandteile: Eulerpool, abgerufen {new Date(a.coverage.asOf).toLocaleDateString('de-DE')}, täglich aktualisiert. Zugeordnet:{' '}
          {a.coverage.pct.toFixed(0)} % des Portfoliowerts
          {a.coverage.unresolved.length > 0 && ` · ohne Daten: ${a.coverage.unresolved.join(', ')}`}
          {!a.coverage.configured && ' · EULERPOOL_API_KEY fehlt, deshalb keine Durchschau.'}
        </p>
      )}
    </>
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

function ConcentrationNote({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-teal-50 text-teal-700' : 'bg-amber-soft text-amber'}`} aria-hidden="true">
        {ok ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L19 7" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 7v6M12 17h.01" />
          </svg>
        )}
      </span>
      <span className="text-ink-700">{text}</span>
      <span className="sr-only">{ok ? 'im Rahmen' : 'auffällig hoch'}</span>
    </li>
  )
}
