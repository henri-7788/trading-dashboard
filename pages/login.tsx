import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    if (res.ok) {
      router.push('/')
    } else {
      setError('Falsches Passwort')
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <form onSubmit={submit} className="border border-ink-700 rounded-md p-8 w-full max-w-sm">
        <h1 className="font-mono text-sm tracking-[0.15em] text-ink-100 uppercase mb-6">Trading Dashboard</h1>
        <label className="block text-xs font-mono uppercase tracking-widest text-ink-400 mb-2">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 rounded-sm text-ink-100 font-mono focus:outline-none focus:border-signal/60 mb-4"
        />
        {error && <div className="text-down text-xs font-mono mb-4">{error}</div>}
        <button className="w-full font-mono text-xs uppercase tracking-widest py-2.5 rounded-sm border border-ink-600 bg-ink-900 text-signal hover:bg-ink-800 hover:border-signal/50 transition-colors">
          Einloggen
        </button>
      </form>
    </div>
  )
}
