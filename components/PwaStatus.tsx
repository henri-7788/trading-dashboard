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
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').catch((err) => console.error('sw registration failed', err))
      } else {
        // Dev chunks keep the same URL across edits, so the worker's cache-first asset strategy would
        // serve stale JS and cause hydration mismatches. Remove any worker left over from a prod run.
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
        caches?.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
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
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] inset-x-0 z-50 flex justify-center px-4">
          <div className="pill pill-danger px-4 py-1.5 text-xs uppercase tracking-widest">Keine Verbindung — zuletzt geladene Daten</div>
        </div>
      )}

      {!installed && installPrompt && (
        <div className="card fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-3 md:inset-x-auto md:bottom-4 md:right-4 md:w-80 z-50 bg-white px-4 py-3.5 md:py-3 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-ink-900">App installieren</div>
            <div className="text-xs text-ink-500 mt-0.5">Als App auf dem Homescreen ablegen — schneller Start, eigenes Fenster.</div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-1.5 shrink-0">
            <button onClick={dismissInstall} className="pill h-11 md:h-auto px-3 md:py-1.5 text-xs md:text-[10px] md:uppercase md:tracking-widest text-ink-500 md:order-2">
              Nicht jetzt
            </button>
            <button onClick={install} className="pill pill-primary h-11 md:h-auto px-3 md:py-1.5 text-xs md:text-[10px] font-medium md:font-normal md:uppercase md:tracking-widest md:order-1">
              Installieren
            </button>
          </div>
        </div>
      )}
    </>
  )
}
