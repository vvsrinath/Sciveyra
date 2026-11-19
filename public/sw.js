/* SciVeyra service worker. Hand-written: no build plugin, no runtime dependencies. */
const CACHE_PREFIX = 'sciveyra-'
const CACHE_VERSION = 'v1'
const CACHE_NAME = `${CACHE_PREFIX}pwa-${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

const DOCUMENT_PATHS = new Set(['/', '/index.html'])
const STATIC_FILES = new Set(['/favicon.svg', '/manifest.webmanifest'])

function isStaticAsset(pathname) {
  return DOCUMENT_PATHS.has(pathname) || STATIC_FILES.has(pathname) ||
    pathname.startsWith('/assets/') || pathname.startsWith('/icons/')
}

async function precache() {
  const cache = await caches.open(CACHE_NAME)
  await Promise.all(PRECACHE_URLS.map(async (url) => {
    try {
      const response = await fetch(new Request(url, { cache: 'reload' }))
      if (response && response.ok) await cache.put(url, response.clone())
    } catch {
      // One unavailable asset must not prevent the shell from installing.
    }
  }))
}

async function clearStaleCaches() {
  const keys = await caches.keys()
  await Promise.all(
    keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key))
  )
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok && response.type === 'basic') {
    await cache.put(request, response.clone())
  }
  return response
}

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME)
      // Always store the shell under its canonical URL, never under an arbitrary SPA route.
      await cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(CACHE_NAME)
    const cached = (await cache.match('/index.html')) || (await cache.match('/'))
    if (cached) return cached
    return new Response(
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>SciVeyra offline</title><body><p>SciVeyra is offline and the app shell has not been cached yet. Reconnect once to finish setup.</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clearStaleCaches().then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (!request || request.method !== 'GET') return

  let url
  try { url = new URL(request.url) } catch { return }
  if (url.origin !== self.location.origin) return
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return
  // API rewrites, scholarly metadata and Ollama endpoints are always live-only.
  if (url.pathname.startsWith('/api/')) return

  if (isStaticAsset(url.pathname) && !DOCUMENT_PATHS.has(url.pathname)) {
    // Hashed bundles plus icons/manifest/favicon are immutable-ish: cache-first.
    event.respondWith(cacheFirst(request))
    return
  }
  if (request.mode === 'navigate' || DOCUMENT_PATHS.has(url.pathname)) {
    event.respondWith(networkFirstDocument(request))
  }
})

self.addEventListener('message', (event) => {
  const data = event && event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'SKIP_WAITING') self.skipWaiting()
})
