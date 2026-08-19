import Papa from 'papaparse'
import { searchTickers } from '../tickerSearch'
import type { AssetClass, TransactionSide } from '../transactions'

export interface ImportedTransaction {
  externalId: string
  symbol: string
  name: string
  assetClass: AssetClass
  side: TransactionSide
  quantity: number
  price: number
  fee: number
  executedAt: string
  notes: string
}

export interface ImportResult {
  transactions: ImportedTransaction[]
  totalRows: number
  skipped: { category: string; type: string; count: number }[]
  unresolvedSymbols: string[]
}

interface TradeRepublicRow {
  datetime: string
  category: string
  type: string
  asset_class: string
  name: string
  symbol: string // ISIN
  shares: string
  price: string
  fee: string
  transaction_id: string
}

const REQUIRED_COLUMNS = ['datetime', 'category', 'type', 'name', 'symbol', 'shares', 'transaction_id']

function mapAssetClass(raw: string): AssetClass {
  if (raw === 'STOCK') return 'stock'
  if (raw === 'FUND') return 'etf'
  return 'other'
}

/**
 * Parses a TradeRepublic "Transaktionsexport" CSV and maps the rows that represent an actual
 * position change (buys/sells, and worthless-writeoff corporate actions) into transaction
 * records. Cash movements, dividends, interest, card transactions, and transfers are real rows
 * in the export but aren't positions — they're counted and reported as skipped, not silently
 * dropped, so the summary the user sees accounts for every row in the file.
 *
 * Each ISIN is resolved to a real, priceable ticker via the same ISIN→OpenFIGI→Yahoo pipeline
 * built for ticker search — TradeRepublic's own `symbol` column is the ISIN, which Yahoo's price
 * endpoint can't use directly. A row whose ISIN fails to resolve is still imported (with the raw
 * ISIN as its symbol) rather than dropped, so no real transaction is lost; the caller is expected
 * to report which symbols came back unresolved for the user to fix in Einstellungen.
 */
export async function importTradeRepublicCsv(csvText: string): Promise<ImportResult> {
  const parsed = Papa.parse<TradeRepublicRow>(csvText, { header: true, skipEmptyLines: true })
  const rows = parsed.data.filter((r) => r && typeof r === 'object')

  if (rows.length === 0 || !REQUIRED_COLUMNS.every((c) => c in (rows[0] || {}))) {
    throw new Error('Die Datei sieht nicht wie ein TradeRepublic-Transaktionsexport aus (erwartete Spalten fehlen).')
  }

  const relevant = rows.filter(
    (r) =>
      (r.category === 'TRADING' && (r.type === 'BUY' || r.type === 'SELL')) ||
      (r.category === 'CORPORATE_ACTION' && (r.type === 'WORTHLESS' || r.type === 'WORTHLESS_CANCELLED'))
  )

  const skippedCounts = new Map<string, number>()
  for (const r of rows) {
    if (relevant.includes(r)) continue
    const key = `${r.category}:${r.type}`
    skippedCounts.set(key, (skippedCounts.get(key) || 0) + 1)
  }

  const uniqueIsins = Array.from(new Set(relevant.map((r) => r.symbol).filter(Boolean)))
  const resolved = new Map<string, { symbol: string; assetClass: AssetClass } | null>()

  const CHUNK = 4
  for (let i = 0; i < uniqueIsins.length; i += CHUNK) {
    const chunk = uniqueIsins.slice(i, i + CHUNK)
    await Promise.all(
      chunk.map(async (isin) => {
        try {
          const results = await searchTickers(isin)
          resolved.set(isin, results[0] ? { symbol: results[0].symbol, assetClass: results[0].assetClass } : null)
        } catch {
          resolved.set(isin, null)
        }
      })
    )
  }

  const unresolvedSymbols = uniqueIsins.filter((isin) => !resolved.get(isin))

  const transactions: ImportedTransaction[] = relevant.map((r) => {
    const shares = parseFloat(r.shares) || 0
    const isWorthless = r.category === 'CORPORATE_ACTION'
    const side: TransactionSide = isWorthless ? (shares < 0 ? 'sell' : 'buy') : r.type === 'BUY' ? 'buy' : 'sell'
    const match = resolved.get(r.symbol)

    return {
      externalId: `manual-tr-${r.transaction_id}`,
      symbol: match?.symbol || r.symbol,
      name: r.name,
      assetClass: match?.assetClass || mapAssetClass(r.asset_class),
      side,
      quantity: Math.abs(shares),
      price: isWorthless ? 0 : Math.abs(parseFloat(r.price)) || 0,
      fee: Math.abs(parseFloat(r.fee)) || 0,
      executedAt: new Date(r.datetime).toISOString(),
      notes: match ? `ISIN ${r.symbol} · TradeRepublic-Import` : `ISIN ${r.symbol} · TradeRepublic-Import · Kurs konnte nicht automatisch aufgelöst werden`
    }
  })

  return {
    transactions,
    totalRows: rows.length,
    skipped: Array.from(skippedCounts.entries()).map(([key, count]) => {
      const [category, type] = key.split(':')
      return { category, type, count }
    }),
    unresolvedSymbols
  }
}
