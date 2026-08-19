const CACHE_TTL_MS = 60_000
const cache = new Map<string, { value: TickerSuggestion[]; at: number }>()

export interface TickerSuggestion {
  symbol: string
  name: string
  exchange: string
  assetClass: 'stock' | 'etf' | 'other'
}

const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; trading-dashboard/1.0)' }

// Exchanges a German/European user recognizes best, checked in order when several listings
// of the same instrument tie on relevance — everything else keeps Yahoo's own ranking.
const PREFERRED_EXCHANGES = ['xetra', 'frankfurt', 'gettex', 'tradegate', 'stuttgart']

function mapAssetClass(quoteType: string): TickerSuggestion['assetClass'] {
  if (quoteType === 'ETF' || quoteType === 'MUTUALFUND') return 'etf'
  if (quoteType === 'EQUITY') return 'stock'
  return 'other'
}

function isIsin(query: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(query)
}

/** German WKN: 6 alphanumeric chars, virtually always containing at least one digit — a plain
 * 6-letter word (e.g. a ticker or company fragment) never does, which keeps this from
 * misfiring on ordinary text searches. */
function looksLikeWkn(query: string): boolean {
  return /^[A-Z0-9]{6}$/i.test(query) && /[0-9]/.test(query)
}

async function yahooSearch(query: string): Promise<TickerSuggestion[]> {
  const res = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`, {
    headers: YAHOO_HEADERS
  })
  if (!res.ok) return []
  const data = await res.json()
  const quotes: any[] = Array.isArray(data.quotes) ? data.quotes : []
  return quotes
    .filter((q) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND'))
    .map((q) => ({
      symbol: q.symbol as string,
      name: (q.shortname || q.longname || q.symbol) as string,
      exchange: (q.exchDisp || q.exchange || '') as string,
      assetClass: mapAssetClass(q.quoteType)
    }))
}

/**
 * Resolves an ISIN or WKN to its canonical name and ticker root via OpenFIGI's free public
 * mapping API. Yahoo's own ISIN search is unreliable (frequently returns one weakly-named,
 * wrong-looking listing instead of the fund itself) and has no WKN coverage at all, so an exact
 * identifier is always resolved through OpenFIGI first rather than handed to Yahoo directly.
 */
async function resolveIdentifier(idType: 'ID_ISIN' | 'ID_WERTPAPIER', value: string): Promise<{ name: string; ticker: string } | null> {
  try {
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ idType, idValue: value }])
    })
    if (!res.ok) return null
    const body = await res.json()
    const listings = body?.[0]?.data
    if (!Array.isArray(listings) || listings.length === 0) return null
    // OpenFIGI returns every listing across every venue for the instrument (upwards of 100 for
    // a widely cross-listed ETF); "GR" is Bloomberg's exchange code for XETRA, the listing a
    // German-market user recognizes, so it's preferred over whichever entry happens to sort first.
    const primary = listings.find((l: any) => l.exchCode === 'GR') || listings[0]
    if (!primary?.name) return null
    return { name: primary.name, ticker: primary.ticker || '' }
  } catch (err) {
    console.error(`identifier resolution failed for "${value}"`, err)
    return null
  }
}

function hasExactTickerMatch(results: TickerSuggestion[], tickerRoot: string): boolean {
  const root = tickerRoot.toUpperCase()
  return results.some((r) => r.symbol.split('.')[0].toUpperCase() === root)
}

/**
 * Puts the listing matching the resolved ticker root — preferably on a familiar exchange —
 * first. Only ever reorders when some result actually carries an exact match for the resolved
 * ticker: without one, there is nothing confirming any candidate is the right company, and
 * boosting a same-exchange result regardless (as an earlier version did) promoted an unrelated
 * German cross-listing above Yahoo's own correct top match for a plain "MICROSOFT CORP" search.
 */
function rankByTickerRoot(results: TickerSuggestion[], tickerRoot: string): TickerSuggestion[] {
  const root = tickerRoot.toUpperCase()
  if (!hasExactTickerMatch(results, root)) return results

  const score = (r: TickerSuggestion, index: number) => {
    const symbolRoot = r.symbol.split('.')[0].toUpperCase()
    const isExact = symbolRoot === root
    let s = -index // preserve Yahoo's own relevance order as the base
    if (isExact) s += 1000
    if (isExact && PREFERRED_EXCHANGES.some((ex) => r.exchange.toLowerCase().includes(ex))) s += 100
    return s
  }
  return results
    .map((r, i) => ({ r, s: score(r, i) }))
    .sort((a, b) => b.s - a.s)
    .map(({ r }) => r)
}

async function resolveAndSearch(idType: 'ID_ISIN' | 'ID_WERTPAPIER', value: string): Promise<TickerSuggestion[]> {
  const resolved = await resolveIdentifier(idType, value)
  if (!resolved) return []

  // The resolved ticker is a precise Yahoo search term and usually hits directly, but a short
  // ticker string (e.g. "GOS") can also collide with an unrelated company's symbol/name and
  // return only noise — a ticker-search result set is only trusted when it actually contains an
  // exact match for the resolved ticker; otherwise it's discarded in favor of the descriptive
  // name search, which reliably finds the real instrument (verified: Yahoo has no "GOS" listing
  // for Goldman Sachs by that search term, but finds it immediately by full company name).
  let results = resolved.ticker ? await yahooSearch(resolved.ticker) : []
  if (!resolved.ticker || !hasExactTickerMatch(results, resolved.ticker)) {
    results = await yahooSearch(resolved.name)
  }

  return resolved.ticker ? rankByTickerRoot(results, resolved.ticker) : results
}

/**
 * Ticker autocomplete. Plain text goes straight to Yahoo Finance's public search. ISINs and
 * WKNs are resolved through OpenFIGI first and then re-searched on Yahoo by name, ranked so the
 * listing matching the resolved ticker (on a familiar exchange where possible) comes first —
 * a direct Yahoo ISIN search alone is unreliable and WKN has no Yahoo coverage at all.
 */
export async function searchTickers(query: string): Promise<TickerSuggestion[]> {
  const trimmed = query.trim()
  const key = trimmed.toLowerCase()
  if (key.length < 1) return []

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  try {
    let results: TickerSuggestion[] = []

    if (isIsin(trimmed)) {
      results = await resolveAndSearch('ID_ISIN', trimmed)
      if (results.length === 0) results = await yahooSearch(trimmed)
    } else if (looksLikeWkn(trimmed)) {
      results = await resolveAndSearch('ID_WERTPAPIER', trimmed)
    } else {
      results = await yahooSearch(trimmed)
    }

    cache.set(key, { value: results, at: Date.now() })
    return results
  } catch (err) {
    console.error(`ticker search failed for "${query}"`, err)
    return []
  }
}
