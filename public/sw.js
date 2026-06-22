// DOTCOM service worker — minimal & network-first.
// Its job is (1) make the app installable and (2) provide an offline fallback for
// pages already visited. It deliberately does NOT cache data: cross-origin
// requests (Supabase auth/realtime/REST) are never touched, and same-origin
// navigations are network-first, so bus status / member data is never stale.

const SHELL_CACHE = 'dotcom-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop any caches from older SW versions.
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never intercept cross-origin requests (Supabase, tile servers, CDNs).
  if (url.origin !== self.location.origin) return

  // Network-first for page navigations; fall back to the last cached version of
  // that page (or /login) only when the network is unavailable.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        const cache = await caches.open(SHELL_CACHE)
        cache.put(request, response.clone())
        return response
      } catch {
        const cached = await caches.match(request)
        return cached || (await caches.match('/login')) || Response.error()
      }
    })())
  }
})
