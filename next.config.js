/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Never let a stale service worker linger — the browser must always
        // re-check for a new version so PWA updates actually reach users.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }]
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }]
      }
    ]
  }
}

module.exports = nextConfig
