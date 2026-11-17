import { NextApiRequest, NextApiResponse } from 'next'
import { computeEquity, type HoldingView } from '../../lib/equity'
import { exposureConfigured, getEquityProfile, getEtfExposure, SECTOR_LABEL } from '../../lib/exposure'
import { countryFromIsin, regionOf } from '../../lib/countries'

/** Value-weighted bucket in USD plus its share of the analysed portfolio. */
export interface Bucket {
  key: string
  label: string
  value: number
  pct: number
}

export interface LookThroughCompany {
  key: string
  name: string
  value: number
  pct: number
  /** Number of ETFs in the portfolio that hold this company. */
  viaEtfs: number
  direct: boolean
}

export interface PositionView {
  symbol: string
  name: string
  assetClass: HoldingView['assetClass']
  sourceLabel: string
  value: number
  pct: number
  unrealizedPnl: number | null
  unrealizedPct: number | null
}

/** One position's contribution to a country's exposure. */
export interface CountryAsset {
  symbol: string
  name: string
  assetClass: HoldingView['assetClass']
  value: number
  via: 'etf' | 'direct' | 'crypto' | 'unresolved'
  /** Share of the position that lands in this country (ETF country weight; 100 for direct holdings). */
  exposurePct: number
}

export interface CountryCompany {
  name: string
  value: number
  etfs: number
  direct: boolean
}

export interface PortfolioAnalysis {
  totalValue: number
  unrealizedPnl: number
  positionsCount: number
  byAssetClass: Bucket[]
  bySource: Bucket[]
  countries: Bucket[]
  /** Per country key: which positions make up its exposure, largest first. */
  countryAssets: Record<string, CountryAsset[]>
  /** Per ISO2: largest look-through companies (country from ISIN prefix for ETF constituents). */
  countryCompanies: Record<string, CountryCompany[]>
  regions: Bucket[]
  sectors: Bucket[]
  lookThroughTop: LookThroughCompany[]
  concentration: { largest: { name: string; pct: number } | null; top5Pct: number; effectivePositions: number }
  positions: PositionView[]
  coverage: { pct: number; unresolved: string[]; source: 'eulerpool'; configured: boolean; asOf: string }
}

const ASSET_CLASS_LABEL: Record<string, string> = { crypto: 'Krypto', stock: 'Aktien', etf: 'ETFs', other: 'Sonstiges' }

/** Special country keys next to ISO2 codes. */
const NO_COUNTRY = 'KRYPTO'
const UNKNOWN = 'unbekannt'

function add(map: Map<string, number>, key: string, value: number) {
  if (value > 0) map.set(key, (map.get(key) || 0) + value)
}

function toBuckets(map: Map<string, number>, total: number, label: (k: string) => string): Bucket[] {
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, label: label(key), value, pct: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => {
      // "Nicht zugeordnet" always last so the ranked lists read top-down by real exposure.
      if (a.key === UNKNOWN) return 1
      if (b.key === UNKNOWN) return -1
      return b.value - a.value
    })
}

function companyKey(isin: string | null, name: string) {
  return isin || name.trim().toUpperCase().replace(/\s+(INC|CORP|CORPORATION|AG|SE|PLC|LTD|CO|N\.V\.|SA|NV|HOLDINGS?)\.?$/g, '')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const equity = await computeEquity()
    const holdings = equity.holdings.filter((h) => (h.value ?? 0) > 0)
    const total = holdings.reduce((s, h) => s + (h.value ?? 0), 0)

    const byAssetClass = new Map<string, number>()
    const bySource = new Map<string, number>()
    const countries = new Map<string, number>()
    const sectors = new Map<string, number>()
    const companies = new Map<string, { name: string; value: number; etfs: Set<string>; direct: boolean; country: string | null }>()
    const countryAssets = new Map<string, CountryAsset[]>()
    const addAsset = (country: string, h: HoldingView, value: number, via: CountryAsset['via'], exposurePct: number) => {
      if (value <= 0) return
      const list = countryAssets.get(country) || []
      list.push({ symbol: h.symbol, name: h.name && h.name !== h.symbol ? h.name : h.symbol, assetClass: h.assetClass, value, via, exposurePct })
      countryAssets.set(country, list)
    }
    const unresolved: string[] = []
    let resolvedValue = 0

    await Promise.all(
      holdings.map(async (h) => {
        const value = h.value ?? 0
        add(byAssetClass, h.assetClass, value)
        add(bySource, h.sourceLabel, value)

        if (h.assetClass === 'crypto') {
          add(sectors, 'krypto', value)
          add(countries, NO_COUNTRY, value)
          addAsset(NO_COUNTRY, h, value, 'crypto', 100)
          resolvedValue += value
          return
        }

        if (h.assetClass === 'etf' && h.isin) {
          try {
            const exp = await getEtfExposure(h.isin)
            for (const s of exp.sectors) add(sectors, s.key, (value * s.pct) / 100)
            for (const c of exp.countries) {
              add(countries, c.key, (value * c.pct) / 100)
              addAsset(c.key, h, (value * c.pct) / 100, 'etf', c.pct)
            }
            for (const c of exp.holdings) {
              const key = companyKey(c.isin, c.name)
              const entry = companies.get(key) || { name: c.name, value: 0, etfs: new Set<string>(), direct: false, country: countryFromIsin(c.isin) }
              entry.value += (value * c.pct) / 100
              entry.etfs.add(h.symbol)
              companies.set(key, entry)
            }
            resolvedValue += value
            return
          } catch {
            // falls through to "unresolved"
          }
        }

        if (h.assetClass === 'stock') {
          const identifier = h.isin || h.symbol.split('.')[0]
          let sector: string | null = null
          let country: string | null = countryFromIsin(h.isin)
          let name = h.name
          try {
            const p = await getEquityProfile(identifier)
            sector = p.sector
            country = p.country || country
            name = p.name || name
          } catch {
            // keep the ISIN-derived country; sector stays unknown
          }
          add(sectors, sector || UNKNOWN, value)
          add(countries, country || UNKNOWN, value)
          addAsset(country || UNKNOWN, h, value, country ? 'direct' : 'unresolved', 100)
          const key = companyKey(h.isin ?? null, name)
          const entry = companies.get(key) || { name, value: 0, etfs: new Set<string>(), direct: false, country: null }
          entry.value += value
          entry.direct = true
          // The equity profile's domicile beats the ISIN prefix.
          entry.country = country || entry.country
          companies.set(key, entry)
          if (sector && country) resolvedValue += value
          else unresolved.push(h.symbol)
          return
        }

        add(sectors, UNKNOWN, value)
        add(countries, UNKNOWN, value)
        addAsset(UNKNOWN, h, value, 'unresolved', 100)
        unresolved.push(h.symbol)
      })
    )

    const regions = new Map<string, number>()
    for (const [key, value] of countries) {
      add(regions, key === NO_COUNTRY ? 'Krypto' : key === UNKNOWN ? UNKNOWN : regionOf(key), value)
    }

    const weights = holdings.map((h) => (total > 0 ? (h.value ?? 0) / total : 0))
    const hhi = weights.reduce((s, w) => s + w * w, 0)
    const ranked = holdings
      .map((h) => ({ h, value: h.value ?? 0 }))
      .sort((a, b) => b.value - a.value)

    const analysis: PortfolioAnalysis = {
      totalValue: total,
      unrealizedPnl: holdings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0),
      positionsCount: holdings.length,
      byAssetClass: toBuckets(byAssetClass, total, (k) => ASSET_CLASS_LABEL[k] || k),
      bySource: toBuckets(bySource, total, (k) => k),
      // Country labels are localised on the client (Intl.DisplayNames 'de'); keys stay ISO2.
      countries: toBuckets(countries, total, (k) => (k === NO_COUNTRY ? 'Krypto (ohne Land)' : k === UNKNOWN ? 'Nicht zugeordnet' : k)),
      countryAssets: Object.fromEntries(Array.from(countryAssets, ([k, list]) => [k, list.sort((x, y) => y.value - x.value)])),
      countryCompanies: (() => {
        const byCountry: Record<string, CountryCompany[]> = {}
        for (const c of companies.values()) {
          if (!c.country) continue
          ;(byCountry[c.country] ||= []).push({ name: c.name, value: c.value, etfs: c.etfs.size, direct: c.direct })
        }
        for (const k of Object.keys(byCountry)) byCountry[k] = byCountry[k].sort((x, y) => y.value - x.value).slice(0, 5)
        return byCountry
      })(),
      regions: toBuckets(regions, total, (k) => (k === UNKNOWN ? 'Nicht zugeordnet' : k)),
      sectors: toBuckets(sectors, total, (k) => SECTOR_LABEL[k] || k),
      lookThroughTop: Array.from(companies.entries())
        .map(([key, c]) => ({ key, name: c.name, value: c.value, pct: total > 0 ? (c.value / total) * 100 : 0, viaEtfs: c.etfs.size, direct: c.direct }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12),
      concentration: {
        largest: ranked[0] ? { name: ranked[0].h.name || ranked[0].h.symbol, pct: total > 0 ? (ranked[0].value / total) * 100 : 0 } : null,
        top5Pct: total > 0 ? (ranked.slice(0, 5).reduce((s, r) => s + r.value, 0) / total) * 100 : 0,
        effectivePositions: hhi > 0 ? 1 / hhi : 0
      },
      positions: ranked.map(({ h, value }) => {
        const cost = h.avgCost != null ? h.avgCost * h.quantity : null
        return {
          symbol: h.symbol,
          name: h.name && h.name !== h.symbol ? h.name : h.symbol,
          assetClass: h.assetClass,
          sourceLabel: h.sourceLabel,
          value,
          pct: total > 0 ? (value / total) * 100 : 0,
          unrealizedPnl: h.unrealizedPnl,
          unrealizedPct: h.unrealizedPnl != null && cost ? (h.unrealizedPnl / cost) * 100 : null
        }
      }),
      coverage: {
        pct: total > 0 ? (resolvedValue / total) * 100 : 0,
        unresolved: unresolved.sort(),
        source: 'eulerpool',
        configured: exposureConfigured(),
        asOf: new Date().toISOString()
      }
    }

    return res.status(200).json(analysis)
  } catch (err: any) {
    console.error('portfolio analysis failed', err?.message || err)
    return res.status(500).json({ error: 'Portfolio-Analyse fehlgeschlagen.' })
  }
}
