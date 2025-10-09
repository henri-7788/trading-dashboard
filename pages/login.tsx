import { useState } from 'react'
import { useRouter } from 'next/router'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const submit = async (e) => {
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
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <form onSubmit={submit} className="bg-slate-800 p-8 rounded shadow text-white w-full max-w-sm">
        <h2 className="text-2xl mb-4">Login</h2>
        <label className="block text-slate-300 mb-2">Passwort</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 rounded bg-slate-700 mb-4" />
        {error && <div className="text-red-400 mb-2">{error}</div>}
        <button className="w-full bg-blue-600 p-2 rounded">Einloggen</button>
      </form>
    </div>
  )
}
