import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'

/** Registers the service worker and surfaces two small, dismissible states: offline and installable. */
export default function PwaStatus() {
  const [offline, setOffline] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.error('sw registration failed', err))
    }

    setOffline(!navigator.onLine)
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
    setInstalled(isStandalone)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      if (localStorage.getItem(DISMISS_KEY) === '1') return
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismissInstall = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setInstallPrompt(null)
  }

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return (
    <>
      {offline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-down/10 border-b border-down/40 text-down text-xs font-mono uppercase tracking-widest text-center py-1.5">
          Keine Verbindung — zuletzt geladene Daten
        </div>
      )}

      {!installed && installPrompt && (
        <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:w-80 z-50 border border-ink-600 rounded-md bg-ink-900 px-4 py-3 shadow-lg flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono uppercase tracking-widest text-ink-100">App installieren</div>
            <div className="text-xs text-ink-400 mt-0.5">Als App auf dem Homescreen ablegen — schneller Start, eigenes Fenster.</div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={install}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-signal/50 bg-signal/10 text-signal hover:bg-signal/20 transition-colors"
            >
              Installieren
            </button>
            <button
              onClick={dismissInstall}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-ink-600 text-ink-400 hover:text-ink-100 transition-colors"
            >
              Nicht jetzt
            </button>
          </div>
        </div>
      )}
    </>
  )
}
