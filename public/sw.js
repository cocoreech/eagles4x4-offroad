const VERSION = 'eagles4x4-v1'
const PRECACHE = ['/offline.html', '/icons/icon-192.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/_next/static/')
  )
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // never touch Supabase / cross-origin

  // Page navigations: network-first, offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }

  // Static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        cached =>
          cached ??
          fetch(request).then(resp => {
            const copy = resp.clone()
            caches.open(VERSION).then(c => c.put(request, copy))
            return resp
          }),
      ),
    )
    return
  }
  // Everything else (API / auth / etc.): default network, no caching.
})
