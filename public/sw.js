// ---------------------------------------------------------------------------
// Service Worker — Drumline Scores
//
// Cache strategies:
//   App shell (HTML, CSS, JS, fonts): cache-first
//   Data files (JSON):                network-first with cache fallback
//   Images/icons:                     cache-first
// ---------------------------------------------------------------------------

const CACHE_NAME = 'rmpa-v2'
const DATA_CACHE_NAME = 'rmpa-data-v1'

// App shell files to precache (populated at build time via manifest)
// We cache the root page and let the browser cache hashed assets naturally
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
]

// ---------------------------------------------------------------------------
// Install — precache app shell
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ---------------------------------------------------------------------------
// Activate — clean old caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DATA_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ---------------------------------------------------------------------------
// Fetch — route requests to appropriate cache strategy
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Data files (JSON) — network-first with cache fallback
  if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(networkFirstWithCache(event.request, DATA_CACHE_NAME))
    return
  }

  // Navigation requests (HTML pages) — network-first so new deploys are picked up
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstWithCache(event.request, CACHE_NAME))
    return
  }

  // Static assets (JS, CSS, images) — cache-first (filenames are content-hashed)
  event.respondWith(cacheFirstWithNetwork(event.request, CACHE_NAME))
})

// ---------------------------------------------------------------------------
// Cache strategies
// ---------------------------------------------------------------------------

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // For navigation requests, return cached root page
    if (request.mode === 'navigate') {
      const cachedRoot = await caches.match('/')
      if (cachedRoot) return cachedRoot
    }
    return new Response('Offline', { status: 503 })
  }
}
