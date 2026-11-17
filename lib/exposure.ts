/**
 * Look-through exposure data (countries, sectors, underlying companies) from Eulerpool.
 *
 * ETFs: `/etf/sectors`, `/etf/countries` and `/etf/holdings` by ISIN. Single stocks:
 * `/equity/profile`. Server-only — the API key never leaves this module, and is stripped from
 * any error text before it is logged.
 *
 * Eulerpool mixes two sector taxonomies (GICS "Information Technology" and Morningstar-style
 * "Technology") and returns long English country names, so both are normalised here: sectors to
 * the 11 GICS sectors with German labels, countries to ISO 3166 alpha-2.
 */

import { normalizeCountry } from './countries'

const BASE = 'https://api.eulerpool.com/api/1'
const TTL_MS = 24 * 60 * 60 * 1000

export interface Weight {
  key: string
  pct: number
}

export interface EtfExposure {
  sectors: Weight[]
  countries: Weight[]
  holdings: { isin: string | null; name: string; pct: number }[]
}

export interface EquityProfile {
  sector: string | null
  country: string | null
  name: string | null
}

// ── Sectors ─────────────────────────────────────────────────────────────────────────────────

export const SECTOR_LABEL: Record<string, string> = {
  it: 'IT',
  finanzen: 'Finanzen',
  gesundheit: 'Gesundheit',
  industrie: 'Industrie',
  zyklisch: 'Zyklischer Konsum',
  basis: 'Basiskonsum',
  kommunikation: 'Kommunikation',
  energie: 'Energie',
  rohstoffe: 'Rohstoffe',
  immobilien: 'Immobilien',
  versorger: 'Versorger',
  krypto: 'Krypto',
  sonstige: 'Cash & Sonstiges',
  unbekannt: 'Nicht zugeordnet'
}

const SECTOR_ALIASES: [RegExp, string][] = [
  [/information technology|^technology|^tech/, 'it'],
  [/financ/, 'finanzen'],
  [/health/, 'gesundheit'],
  [/industr/, 'industrie'],
  [/cyclical|discretionary/, 'zyklisch'],
  [/defensive|staples/, 'basis'],
  [/communication|telecom|media/, 'kommunikation'],
  [/energy/, 'energie'],
  [/material/, 'rohstoffe'],
  [/real estate/, 'immobilien'],
  [/utilit/, 'versorger'],
  [/cash|derivative|other|money market/, 'sonstige']
]

export function normalizeSector(raw: string | null | undefined): string {
  const s = (raw || '').trim().toLowerCase()
  if (!s) return 'unbekannt'
  for (const [re, key] of SECTOR_ALIASES) if (re.test(s)) return key
  return 'sonstige'
}

// ── Eulerpool client with a 24h promise cache ───────────────────────────────────────────────

const cache = new Map<string, { at: number; value: Promise<any> }>()

export function exposureConfigured() {
  return Boolean(process.env.EULERPOOL_API_KEY)
}

async function fetchEulerpool(path: string): Promise<any> {
  const key = process.env.EULERPOOL_API_KEY
  if (!key) throw new Error('EULERPOOL_API_KEY fehlt')
  const res = await fetch(`${BASE}/${path}?token=${encodeURIComponent(key)}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Eulerpool ${path.split('/').slice(0, 2).join('/')}: HTTP ${res.status}`)
  return res.json()
}

function cached<T>(path: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = load().catch((err) => {
    cache.delete(path)
    const key = process.env.EULERPOOL_API_KEY
    const msg = String(err?.message || err)
    console.error('exposure lookup failed:', key ? msg.split(key).join('***') : msg)
    throw err
  })
  cache.set(path, { at: Date.now(), value })
  return value
}

function weights(rows: any[], labelField: string, normalize: (v: string) => string | null): Weight[] {
  const out = new Map<string, number>()
  for (const r of Array.isArray(rows) ? rows : []) {
    const pct = Number(r?.exposure ?? r?.percent ?? r?.weight)
    if (!Number.isFinite(pct) || pct <= 0) continue
    const label = r?.[labelField] ?? r?.country ?? r?.industry ?? r?.sector
    const key = normalize(String(label ?? '')) ?? 'unbekannt'
    out.set(key, (out.get(key) || 0) + pct)
  }
  const total = Array.from(out.values()).reduce((a, b) => a + b, 0) || 1
  return Array.from(out.entries()).map(([key, pct]) => ({ key, pct: (pct / total) * 100 }))
}

export function getEtfExposure(isin: string): Promise<EtfExposure> {
  return cached(`etf/${isin}`, async () => {
    const [sectors, countries, holdings] = await Promise.all([
      fetchEulerpool(`etf/sectors/${isin}`),
      fetchEulerpool(`etf/countries/${isin}`),
      fetchEulerpool(`etf/holdings/${isin}`).catch(() => [])
    ])
    if (!Array.isArray(sectors) || sectors.length === 0) throw new Error(`Keine ETF-Daten für ${isin}`)
    const top = (Array.isArray(holdings) ? holdings : [])
      .map((h: any) => ({ isin: h?.isin || null, name: String(h?.name || h?.symbol || ''), pct: Number(h?.percent) || 0 }))
      .filter((h) => h.pct > 0 && h.name)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 40)
    return {
      sectors: weights(sectors, 'industry', normalizeSector),
      countries: weights(countries, 'country', (v) => normalizeCountry(v) ?? 'unbekannt'),
      holdings: top
    }
  })
}

export function getEquityProfile(identifier: string): Promise<EquityProfile> {
  return cached(`equity/${identifier}`, async () => {
    const p = await fetchEulerpool(`equity/profile/${identifier}`)
    return {
      sector: p?.sector ? normalizeSector(p.sector) : null,
      country: normalizeCountry(p?.country),
      name: p?.name || null
    }
  })
}
