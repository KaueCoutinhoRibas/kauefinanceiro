const CACHE_PREFIX = 'meu-financeiro-cache-'
const CACHE_NAME = `${CACHE_PREFIX}v3`
const APP_BASE = new URL('./', self.registration.scope)
const APP_SHELL = [
  new URL('./', APP_BASE).href,
  new URL('index.html', APP_BASE).href,
  new URL('manifest.webmanifest', APP_BASE).href,
  new URL('icon.svg', APP_BASE).href,
  new URL('icon-192.png', APP_BASE).href,
  new URL('icon-512.png', APP_BASE).href,
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    if (cached) return cached

    try {
      const response = await fetch(request)
      if (response.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || request.destination === 'font')) {
        cache.put(request, response.clone()).catch(() => undefined)
      }
      return response
    } catch {
      if (request.mode === 'navigate') {
        return (await cache.match(new URL('index.html', APP_BASE).href)) || (await cache.match(APP_BASE.href))
      }
      return new Response('', { status: 504, statusText: 'Offline' })
    }
  })())
})
