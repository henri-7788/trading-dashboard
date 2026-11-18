import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const PIN_LENGTH = 4
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  const submit = useCallback(
    async (code: string) => {
      setSubmitting(true)
      setError('')
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: code })
      })
      if (res.ok) {
        router.push('/')
        return
      }
      setError('Falscher Code')
      setPin('')
      setShake(true)
      setSubmitting(false)
      setTimeout(() => setShake(false), 400)
    },
    [router]
  )

  const press = useCallback(
    (digit: string) => {
      if (submitting) return
      setError('')
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev
        const next = prev + digit
        if (next.length === PIN_LENGTH) submit(next)
        return next
      })
    },
    [submitting, submit]
  )

  const backspace = useCallback(() => {
    if (submitting) return
    setError('')
    setPin((prev) => prev.slice(0, -1))
  }, [submitting])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      else if (e.key === 'Backspace') backspace()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [press, backspace])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Head>
        <title>Anmelden · Trading Dashboard</title>
      </Head>
      <div className={`card p-8 w-full max-w-xs ${shake ? 'animate-shake' : ''}`}>
        <h1 className="text-xl font-normal tracking-[-0.02em] text-ink-900 mb-1 text-center">Trading Dashboard</h1>
        <p className="text-xs uppercase tracking-widest text-ink-500 mb-6 text-center">Code eingeben</p>

        <div className="flex items-center justify-center gap-4 mb-2">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                i < pin.length ? 'bg-teal-700 border-teal-700' : 'bg-transparent border-ink-300'
              }`}
            />
          ))}
        </div>

        <div className="h-5 mb-4 text-center">{error && <span className="text-down text-sm">{error}</span>}</div>

        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((key, i) => {
            if (key === '') return <div key={i} />
            if (key === 'back') {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={backspace}
                  aria-label="Löschen"
                  className="pill aspect-square text-base text-ink-600 hover:text-ink-900"
                >
                  ⌫
                </button>
              )
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => press(key)}
                disabled={submitting}
                className="pill aspect-square text-xl font-medium text-ink-900 active:bg-ink-150 disabled:opacity-50"
              >
                {key}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
