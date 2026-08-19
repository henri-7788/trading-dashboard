import { useEffect, useRef, useState, FormEvent } from 'react'
import Link from 'next/link'

interface TickerSuggestion {
  symbol: string
  name: string
  exchange: string
  assetClass: 'stock' | 'etf' | 'other'
}

interface ConnectionView {
  id: string
  type: 'hyperliquid' | 'ccxt'
  label: string
  exchangeId: string | null
  walletAddress: string | null
  hasApiKey: boolean
  apiKeyPreview: string | null
  hasPassword: boolean
  symbols: string
  enabled: boolean
  createdAt: string
}

interface TransactionView {
  id: string
  source: string
  editable: boolean
  symbol: string
  name: string
  assetClass: 'crypto' | 'stock' | 'etf' | 'other'
  side: 'buy' | 'sell'
  quantity: number
  price: number
  fee: number
  executedAt: string
  notes: string
}

interface ImportSummary {
  totalRows: number
  created: number
  updated: number
  invalid: number
  skipped: { category: string; type: string; count: number }[]
  unresolvedSymbols: string[]
}

const ASSET_CLASS_LABEL: Record<string, string> = {
  crypto: 'Krypto',
  stock: 'Aktie',
  etf: 'ETF',
  other: 'Sonstiges'
}

export default function SettingsPage() {
  const [connections, setConnections] = useState<ConnectionView[]>([])
  const [transactions, setTransactions] = useState<TransactionView[]>([])
  const [exchanges, setExchanges] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [showAddConnection, setShowAddConnection] = useState<'hyperliquid' | 'ccxt' | null>(null)
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  const load = async () => {
    setError(null)
    const [connRes, txRes, exRes] = await Promise.all([
      fetch('/api/connections'),
      fetch('/api/transactions'),
      fetch('/api/exchanges')
    ])
    if (connRes.status === 401) {
      window.location.href = '/login'
      return
    }
    if (connRes.ok) setConnections((await connRes.json()).connections)
    if (txRes.ok) setTransactions((await txRes.json()).transactions)
    if (exRes.ok) setExchanges((await exRes.json()).exchanges)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const removeConnection = async (id: string, label: string) => {
    if (!confirm(`"${label}" entfernen? Alle zugehörigen Trades, Positionen und Transaktionen werden ebenfalls gelöscht.`)) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/connections/${id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Entfernen fehlgeschlagen.')
      return
    }
    setNotice(`"${label}" entfernt.`)
    load()
  }

  const importCsv = async (file: File) => {
    setImporting(true)
    setError(null)
    setImportSummary(null)
    try {
      const csv = await file.text()
      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'Import fehlgeschlagen.')
        return
      }
      setImportSummary(body)
      load()
    } finally {
      setImporting(false)
    }
  }

  const removeTransaction = async (id: string) => {
    if (!confirm('Diese manuelle Position löschen?')) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Löschen fehlgeschlagen.')
      return
    }
    load()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="font-mono text-sm text-ink-300 tabular animate-pulse">Lade Einstellungen…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-950 pb-16">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8">
        <header className="border border-ink-700 rounded-md px-5 py-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-mono text-sm tracking-[0.15em] text-ink-100 uppercase">Einstellungen</h1>
            <p className="text-xs text-ink-400 font-mono mt-1">Verbindungen &amp; manuelle Positionen</p>
          </div>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm border border-ink-600 bg-ink-900 text-ink-100 hover:bg-ink-800 hover:border-signal/40 transition-colors"
          >
            ← Dashboard
          </Link>
        </header>

        {error && <div className="mb-6 rounded-sm border border-down/40 bg-down/10 px-4 py-3 text-sm font-mono text-down">{error}</div>}
        {notice && (
          <div className="mb-6 rounded-sm border border-up/40 bg-up/10 px-4 py-3 text-sm font-mono text-up flex items-center justify-between">
            {notice}
            <button onClick={() => setNotice(null)} className="text-up/70 hover:text-up ml-4">
              ✕
            </button>
          </div>
        )}

        {/* Connections */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-400">Verbindungen</h2>
          </div>

          <div className="flex flex-col gap-3 mb-3">
            {connections.length === 0 && (
              <div className="border border-ink-700 rounded-md px-4 py-6 text-center text-ink-400 font-mono text-sm">
                Noch keine Verbindung. Füge Hyperliquid oder eine Börse hinzu, um Trades und Bestände zu synchronisieren.
              </div>
            )}
            {connections.map((c) => (
              <div key={c.id} className="border border-ink-700 rounded-md px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-ink-800 text-ink-400 font-mono">
                      {c.type === 'hyperliquid' ? 'Hyperliquid' : c.exchangeId}
                    </span>
                    <span className="font-mono text-sm text-ink-100 truncate">{c.label}</span>
                  </div>
                  <p className="text-xs text-ink-400 font-mono mt-1 truncate">
                    {c.type === 'hyperliquid' ? c.walletAddress : c.apiKeyPreview ? `API-Key ${c.apiKeyPreview}` : 'kein API-Key'}
                  </p>
                </div>
                <button
                  onClick={() => removeConnection(c.id, c.label)}
                  disabled={busy}
                  className="shrink-0 font-mono text-xs uppercase tracking-widest px-3 py-1.5 rounded-sm border border-ink-600 text-down hover:bg-down/10 hover:border-down/40 transition-colors disabled:opacity-50"
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowAddConnection(showAddConnection === 'hyperliquid' ? null : 'hyperliquid')}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm border border-ink-600 bg-ink-900 text-signal hover:bg-ink-800 hover:border-signal/50 transition-colors"
            >
              + Hyperliquid Wallet
            </button>
            <button
              onClick={() => setShowAddConnection(showAddConnection === 'ccxt' ? null : 'ccxt')}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm border border-ink-600 bg-ink-900 text-signal hover:bg-ink-800 hover:border-signal/50 transition-colors"
            >
              + Börse (API-Key)
            </button>
          </div>

          {showAddConnection === 'hyperliquid' && (
            <HyperliquidForm
              onCancel={() => setShowAddConnection(null)}
              onSaved={() => {
                setShowAddConnection(null)
                setNotice('Hyperliquid-Wallet hinzugefügt. Klicke im Dashboard auf "Sync now".')
                load()
              }}
              setError={setError}
            />
          )}
          {showAddConnection === 'ccxt' && (
            <ExchangeForm
              exchanges={exchanges}
              onCancel={() => setShowAddConnection(null)}
              onSaved={() => {
                setShowAddConnection(null)
                setNotice('Börsen-Verbindung hinzugefügt. Klicke im Dashboard auf "Sync now".')
                load()
              }}
              setError={setError}
            />
          )}
        </section>

        {/* Manual positions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-400">Manuelle Positionen (Aktien, ETFs, …)</h2>
          </div>

          <div className="border border-ink-700 rounded-md overflow-hidden mb-3">
            {transactions.filter((t) => t.editable).length === 0 ? (
              <div className="py-10 text-center text-ink-400 font-mono text-sm">Noch keine manuellen Käufe/Verkäufe erfasst.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-ink-400 border-b border-ink-700">
                      <th className="py-2.5 px-4">Symbol</th>
                      <th className="py-2.5 px-4">Typ</th>
                      <th className="py-2.5 px-4">Seite</th>
                      <th className="py-2.5 px-4">Menge</th>
                      <th className="py-2.5 px-4">Preis</th>
                      <th className="py-2.5 px-4">Datum</th>
                      <th className="py-2.5 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter((t) => t.editable)
                      .map((t) => (
                        <tr key={t.id} className="border-b border-ink-800 last:border-0">
                          <td className="py-2.5 px-4 text-ink-100 font-medium">{t.symbol}</td>
                          <td className="py-2.5 px-4 text-ink-400">{ASSET_CLASS_LABEL[t.assetClass]}</td>
                          <td className="py-2.5 px-4">
                            <span className={`uppercase text-xs tracking-wide ${t.side === 'buy' ? 'text-up' : 'text-down'}`}>
                              {t.side === 'buy' ? 'Kauf' : 'Verkauf'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 tabular text-ink-400">{t.quantity}</td>
                          <td className="py-2.5 px-4 tabular text-ink-400">{t.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                          <td className="py-2.5 px-4 tabular text-ink-400">{new Date(t.executedAt).toLocaleDateString('de-DE')}</td>
                          <td className="py-2.5 px-4 text-right">
                            <button onClick={() => removeTransaction(t.id)} className="text-down/70 hover:text-down text-xs uppercase tracking-widest">
                              Löschen
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setShowAddPosition((v) => !v)}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm border border-ink-600 bg-ink-900 text-signal hover:bg-ink-800 hover:border-signal/50 transition-colors"
            >
              + Position erfassen
            </button>
            <label className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm border border-ink-600 bg-ink-900 text-signal hover:bg-ink-800 hover:border-signal/50 transition-colors cursor-pointer">
              {importing ? 'Importiere…' : 'CSV importieren (TradeRepublic)'}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) importCsv(file)
                }}
              />
            </label>
          </div>

          {importSummary && (
            <div className="border border-ink-700 rounded-md p-4 mt-3 text-sm font-mono">
              <div className="text-ink-100 mb-2">
                {importSummary.totalRows} Zeilen gelesen · <span className="text-up">{importSummary.created} neu</span>
                {importSummary.updated > 0 && <>, {importSummary.updated} aktualisiert</>}
                {importSummary.invalid > 0 && (
                  <>
                    , <span className="text-down">{importSummary.invalid} übersprungen (ungültig)</span>
                  </>
                )}
              </div>
              {importSummary.skipped.length > 0 && (
                <div className="text-ink-400 text-xs">
                  Nicht importiert (keine Positionsänderung): {importSummary.skipped.map((s) => `${s.count}× ${s.type}`).join(', ')}
                </div>
              )}
              {importSummary.unresolvedSymbols.length > 0 && (
                <div className="text-down text-xs mt-1">
                  Kurs konnte nicht automatisch aufgelöst werden für: {importSummary.unresolvedSymbols.join(', ')} — Symbol in der Position ggf. manuell
                  korrigieren.
                </div>
              )}
              <button onClick={() => setImportSummary(null)} className="text-ink-400 hover:text-ink-100 text-xs uppercase tracking-widest mt-2">
                Schließen
              </button>
            </div>
          )}

          {showAddPosition && (
            <ManualPositionForm
              onCancel={() => setShowAddPosition(false)}
              onSaved={() => {
                setShowAddPosition(false)
                load()
              }}
              setError={setError}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: (e: FormEvent) => void }) {
  return (
    <form onSubmit={onSubmit} className="border border-ink-700 rounded-md p-4 mt-3 flex flex-col gap-3">
      {children}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-ink-400 font-mono">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-sm text-ink-100 font-mono text-sm focus:outline-none focus:border-signal/60'

function FormActions({ onCancel, submitLabel, busy }: { onCancel: () => void; submitLabel: string; busy: boolean }) {
  return (
    <div className="flex gap-2 justify-end pt-1">
      <button type="button" onClick={onCancel} className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm border border-ink-600 text-ink-400 hover:text-ink-100 transition-colors">
        Abbrechen
      </button>
      <button
        type="submit"
        disabled={busy}
        className="font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm border border-signal/40 bg-signal/10 text-signal hover:bg-signal/20 transition-colors disabled:opacity-50"
      >
        {busy ? 'Speichern…' : submitLabel}
      </button>
    </div>
  )
}

function HyperliquidForm({ onCancel, onSaved, setError }: { onCancel: () => void; onSaved: () => void; setError: (e: string | null) => void }) {
  const [label, setLabel] = useState('Hyperliquid')
  const [walletAddress, setWalletAddress] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'hyperliquid', label, walletAddress })
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Hinzufügen fehlgeschlagen.')
      return
    }
    onSaved()
  }

  return (
    <FormShell onSubmit={submit}>
      <Field label="Bezeichnung">
        <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} required />
      </Field>
      <Field label="Wallet-Adresse">
        <input className={inputClass} placeholder="0x…" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} required />
      </Field>
      <FormActions onCancel={onCancel} submitLabel="Wallet hinzufügen" busy={busy} />
    </FormShell>
  )
}

function ExchangeForm({
  exchanges,
  onCancel,
  onSaved,
  setError
}: {
  exchanges: string[]
  onCancel: () => void
  onSaved: () => void
  setError: (e: string | null) => void
}) {
  const [label, setLabel] = useState('')
  const [exchangeId, setExchangeId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [password, setPassword] = useState('')
  const [symbols, setSymbols] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ccxt', label, exchangeId, apiKey, apiSecret, password, symbols })
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Hinzufügen fehlgeschlagen.')
      return
    }
    onSaved()
  }

  return (
    <FormShell onSubmit={submit}>
      <Field label="Bezeichnung">
        <input className={inputClass} placeholder="z. B. Mein Binance-Konto" value={label} onChange={(e) => setLabel(e.target.value)} required />
      </Field>
      <Field label="Börse">
        <input
          className={inputClass}
          list="exchange-options"
          placeholder="binance, coinbase, kraken, bybit, okx, …"
          value={exchangeId}
          onChange={(e) => setExchangeId(e.target.value)}
          required
        />
        <datalist id="exchange-options">
          {exchanges.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </Field>
      <Field label="API-Key">
        <input className={inputClass} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
      </Field>
      <Field label="API-Secret">
        <input className={inputClass} type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} required />
      </Field>
      <Field label="Passphrase (nur falls von der Börse verlangt)">
        <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Trading-Paare für Transaktionshistorie (optional, kommagetrennt, z. B. BTC/USDT,ETH/USDT)">
        <input className={inputClass} placeholder="BTC/USDT,ETH/USDT" value={symbols} onChange={(e) => setSymbols(e.target.value)} />
      </Field>
      <p className="text-xs text-ink-400 font-mono leading-relaxed">
        API-Key und Secret werden verschlüsselt gespeichert. Nutze einen Key mit ausschließlich Lese-Rechten (kein Trading/Withdraw).
      </p>
      <FormActions onCancel={onCancel} submitLabel="Verbindung hinzufügen" busy={busy} />
    </FormShell>
  )
}

function TickerAutocomplete({
  value,
  onChange,
  onPick
}: {
  value: string
  onChange: (v: string) => void
  onPick: (s: TickerSuggestion) => void
}) {
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.trim().length < 1) {
      setSuggestions([])
      return
    }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(value)}`)
      if (!res.ok) return
      const data = await res.json()
      setSuggestions(data.results || [])
      setOpen(true)
    }, 250)
    return () => clearTimeout(handle)
  }, [value])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <input
        className={inputClass}
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase())
          setOpen(true)
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
        required
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 top-full left-0 right-0 mt-1 border border-ink-600 rounded-sm bg-ink-900 max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={`${s.symbol}-${s.exchange}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(s)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-ink-800 transition-colors flex items-center justify-between gap-3"
              >
                <span className="font-mono text-sm text-ink-100">{s.symbol}</span>
                <span className="font-mono text-xs text-ink-400 truncate">{s.name}</span>
                <span className="text-[10px] uppercase tracking-widest text-ink-400 shrink-0">{s.exchange}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ManualPositionForm({ onCancel, onSaved, setError }: { onCancel: () => void; onSaved: () => void; setError: (e: string | null) => void }) {
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [assetClass, setAssetClass] = useState<'stock' | 'etf' | 'crypto' | 'other'>('etf')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fee, setFee] = useState('0')
  const [executedAt, setExecutedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, name, assetClass, side, quantity, price, fee, executedAt, notes })
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Erfassen fehlgeschlagen.')
      return
    }
    onSaved()
  }

  return (
    <FormShell onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Symbol, ISIN oder WKN (Aktie/ETF: tippen für Vorschläge)">
          <TickerAutocomplete
            value={symbol}
            onChange={setSymbol}
            onPick={(s) => {
              setSymbol(s.symbol)
              if (!name) setName(s.name)
              setAssetClass(s.assetClass)
            }}
          />
        </Field>
        <Field label="Name (optional)">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Anlageklasse">
          <select className={inputClass} value={assetClass} onChange={(e) => setAssetClass(e.target.value as typeof assetClass)}>
            <option value="etf">ETF</option>
            <option value="stock">Aktie</option>
            <option value="crypto">Krypto</option>
            <option value="other">Sonstiges</option>
          </select>
        </Field>
        <Field label="Seite">
          <select className={inputClass} value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
            <option value="buy">Kauf</option>
            <option value="sell">Verkauf</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Menge">
          <input className={inputClass} type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </Field>
        <Field label="Preis / Stück">
          <input className={inputClass} type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Field label="Gebühr (optional)">
          <input className={inputClass} type="number" step="any" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
      </div>
      <Field label="Datum">
        <input className={inputClass} type="date" value={executedAt} onChange={(e) => setExecutedAt(e.target.value)} required />
      </Field>
      <Field label="Notiz (optional)">
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <FormActions onCancel={onCancel} submitLabel="Position speichern" busy={busy} />
    </FormShell>
  )
}
