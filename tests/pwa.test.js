import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const ORIGIN = 'https://sciveyra.example'
const CACHE_NAME = 'sciveyra-pwa-v1'
const swSource = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

const keyOf = (input) => new URL(typeof input === 'string' ? input : input.url, ORIGIN).href

class FakeRequest {
  constructor(url, init = {}) {
    this.url = new URL(typeof url === 'string' ? url : url.url, ORIGIN).href
    this.method = (init.method || 'GET').toUpperCase()
    this.mode = init.mode || 'cors'
  }
}

class FakeResponse {
  constructor(body, init = {}) {
    this.body = body
    this.ok = (init.status ?? 200) >= 200 && (init.status ?? 200) < 300
    this.type = init.type || 'basic'
    this.headers = init.headers || {}
  }
  clone() {
    return new FakeResponse(this.body, { status: this.ok ? 200 : 500, type: this.type, headers: this.headers })
  }
}

function setup({ fetchImpl } = {}) {
  const stores = new Map()
  const getStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map())
    return stores.get(name)
  }
  const cachesApi = {
    open: vi.fn(async (name) => {
      const store = getStore(name)
      return {
        match: vi.fn(async (request) => store.get(keyOf(request))?.clone()),
        put: vi.fn(async (request, response) => { store.set(keyOf(request), response.clone()) })
      }
    }),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name) => stores.delete(name))
  }
  const fetchApi = vi.fn(fetchImpl || (async (input) => new FakeResponse(`live:${keyOf(input)}`)))
  const listeners = new Map()
  const self = {
    location: { origin: ORIGIN },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    addEventListener: (type, handler) => {
      listeners.set(type, [...(listeners.get(type) || []), handler])
    }
  }
  const context = vm.createContext({
    self,
    caches: cachesApi,
    fetch: fetchApi,
    URL,
    Request: FakeRequest,
    Response: FakeResponse,
    console
  })
  vm.runInContext(swSource, context, { filename: 'sw.js' })
  return { listeners, self, cachesApi, fetchApi, stores, getStore }
}

function event(extra = {}) {
  return { waitUntil: vi.fn(), respondWith: vi.fn(), ...extra }
}

async function dispatch(ctx, type, payload) {
  const handlers = ctx.listeners.get(type) || []
  for (const handler of handlers) handler(payload)
  await Promise.all(payload.waitUntil?.mock.calls.flat() || [])
}

async function responseOf(evt) {
  expect(evt.respondWith).toHaveBeenCalledTimes(1)
  return evt.respondWith.mock.calls[0][0]
}

describe('service worker', () => {
  it('installs a versioned cache with the app shell and icons precached', async () => {
    const ctx = setup()
    await dispatch(ctx, 'install', event())

    expect(ctx.cachesApi.open).toHaveBeenCalledWith(CACHE_NAME)
    const keys = [...ctx.getStore(CACHE_NAME).keys()]
    for (const path of [
      '/', '/index.html', '/favicon.svg', '/manifest.webmanifest',
      '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'
    ]) {
      expect(keys).toContain(keyOf(path))
    }
    expect(ctx.self.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('never intercepts non-GET, cross-origin or /api/* requests', async () => {
    const ctx = setup()
    const requests = [
      new FakeRequest(`${ORIGIN}/api/crossref/works?query=test`),
      new FakeRequest('https://api.crossref.org/works'),
      new FakeRequest('http://127.0.0.1:11434/api/generate'),
      new FakeRequest(`${ORIGIN}/assets/index-abc.js`, { method: 'POST' })
    ]
    for (const request of requests) {
      const evt = event({ request })
      await dispatch(ctx, 'fetch', evt)
      expect(evt.respondWith).not.toHaveBeenCalled()
    }
    expect(ctx.fetchApi).not.toHaveBeenCalled()
  })

  it('serves navigations network-first and refreshes only the canonical shell', async () => {
    const ctx = setup()
    const evt = event({ request: new FakeRequest(`${ORIGIN}/graphs`, { mode: 'navigate' }) })
    await dispatch(ctx, 'fetch', evt)

    const response = await responseOf(evt)
    expect(response.body).toContain('/graphs')
    expect(ctx.getStore(CACHE_NAME).has(keyOf('/index.html'))).toBe(true)
    expect(ctx.getStore(CACHE_NAME).has(keyOf('/graphs'))).toBe(false)
  })

  it('falls back to the cached shell when a navigation is offline', async () => {
    const ctx = setup({ fetchImpl: async () => { throw new Error('offline') } })
    ctx.getStore(CACHE_NAME).set(keyOf('/index.html'), new FakeResponse('cached shell'))

    const evt = event({ request: new FakeRequest(`${ORIGIN}/rewriter`, { mode: 'navigate' }) })
    await dispatch(ctx, 'fetch', evt)
    expect((await responseOf(evt)).body).toBe('cached shell')
  })

  it('serves hashed assets cache-first', async () => {
    const ctx = setup()
    const request = new FakeRequest(`${ORIGIN}/assets/index-abc123.js`)
    ctx.getStore(CACHE_NAME).set(keyOf(request), new FakeResponse('cached bundle'))

    const evt = event({ request })
    await dispatch(ctx, 'fetch', evt)
    expect((await responseOf(evt)).body).toBe('cached bundle')
    expect(ctx.fetchApi).not.toHaveBeenCalled()
  })

  it('removes stale caches, keeps unrelated caches and claims clients on activate', async () => {
    const ctx = setup()
    ctx.getStore('sciveyra-pwa-v0').set(keyOf('/index.html'), new FakeResponse('old'))
    ctx.getStore('unrelated-cache').set('anything', new FakeResponse('keep'))
    await dispatch(ctx, 'activate', event())

    expect(ctx.cachesApi.delete).toHaveBeenCalledWith('sciveyra-pwa-v0')
    expect(ctx.stores.has('sciveyra-pwa-v0')).toBe(false)
    expect(ctx.stores.has('unrelated-cache')).toBe(true)
    expect(ctx.self.clients.claim).toHaveBeenCalledTimes(1)
  })

  it('only accepts the SKIP_WAITING message shape', async () => {
    const waiting = setup()
    await dispatch(waiting, 'message', { data: { type: 'SKIP_WAITING' } })
    expect(waiting.self.skipWaiting).toHaveBeenCalledTimes(1)

    const ignored = setup()
    await dispatch(ignored, 'message', { data: { type: 'DELETE_EVERYTHING' } })
    await dispatch(ignored, 'message', { data: null })
    expect(ignored.self.skipWaiting).not.toHaveBeenCalled()
  })
})
