export type AssetClass = 'crypto' | 'stock' | 'etf' | 'other'
export type TransactionSide = 'buy' | 'sell'

export interface ManualTransactionInput {
  symbol: string
  name?: string
  assetClass: AssetClass
  side: TransactionSide
  quantity: number
  price: number
  fee?: number
  executedAt: string
  notes?: string
}

export function validateManualTransaction(input: Partial<ManualTransactionInput>): string | null {
  if (!input.symbol || !input.symbol.trim()) return 'Symbol ist erforderlich.'
  if (!input.assetClass || !['crypto', 'stock', 'etf', 'other'].includes(input.assetClass)) return 'Ungültige Anlageklasse.'
  if (!input.side || !['buy', 'sell'].includes(input.side)) return 'Ungültige Seite (Kauf/Verkauf).'
  if (!Number.isFinite(input.quantity) || (input.quantity as number) <= 0) return 'Menge muss größer als 0 sein.'
  // 0 is allowed deliberately: a position written off as worthless (e.g. an imported
  // corporate-action delisting) is a legitimate zero-price transaction, not a missing value.
  if (!Number.isFinite(input.price) || (input.price as number) < 0) return 'Preis darf nicht negativ sein.'
  if (!input.executedAt || isNaN(new Date(input.executedAt).getTime())) return 'Ungültiges Datum.'
  return null
}
