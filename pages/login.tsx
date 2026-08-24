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
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass-panel p-8 w-full max-w-sm">
        <h1 className="text-lg font-semibold text-ink-100 mb-6">Trading Dashboard</h1>
        <label className="block text-xs uppercase tracking-widest text-ink-400 mb-2">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="glass-input mb-4"
        />
        {error && <div className="text-down text-sm mb-4">{error}</div>}
        <button className="glass-pill glass-pill-signal w-full py-2.5 text-sm font-medium">Einloggen</button>
      </form>
    </div>
  )
}
