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
    <div className="min-h-screen bg-board-950 flex items-center justify-center px-4">
      <form onSubmit={submit} className="flap-panel rounded-lg p-8 w-full max-w-sm">
        <div className="flex gap-1 mb-4">
          <span className="rivet" />
          <span className="rivet" />
        </div>
        <h1 className="font-mono text-sm tracking-[0.3em] text-flap-amber uppercase mb-6">Trading Dashboard</h1>
        <label className="block text-xs font-mono uppercase tracking-widest text-board-400 mb-2">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full px-3 py-2.5 bg-board-800 border border-board-600 rounded text-flap-bone font-mono focus:outline-none focus:border-flap-amber/50 mb-4"
        />
        {error && <div className="text-down text-xs font-mono mb-4">{error}</div>}
        <button className="w-full font-mono text-xs uppercase tracking-widest py-2.5 rounded border border-board-600 bg-board-800 text-flap-amber hover:bg-board-700 hover:border-flap-amber/40 transition-colors">
          Einloggen
        </button>
      </form>
    </div>
  )
}
