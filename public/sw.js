const CACHE_VERSION = 'v1'
const SHELL_CACHE = `shell-${CACHE_VERSION}`
const ASSET_CACHE = `assets-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

const SHELL_ASSETS = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Live trading/account data must never be served from cache — let these
  // requests fail naturally when offline instead of showing stale numbers.
  if (url.pathname.startsWith('/api/')) return

  // Page navigations: try the network first so users always see live data
  // when online, falling back to a cached copy or the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)))
    )
    return
  }

  // Static build assets (JS/CSS/fonts/icons): stale-while-revalidate keeps
  // repeat loads fast and working offline without ever going stale for long.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon-') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            cache.put(request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})
