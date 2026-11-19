import { beforeEach, describe, expect, it } from 'vitest'
import { STORES, dbClear, dbGetAll, dbPut, exportBackup } from '../src/lib/storage.js'
import {
  CACHE_LIMITS, cacheKey, cacheStatus, deleteCacheEntry, expandSources,
  isFresh, isStale, listCacheEntries, makeCacheEntry, normalizeQuery,
  pruneSearchCache, readCacheEntry, summarizeSourceHealth, writeCacheEntry
} from '../src/lib/searchCache.js'

beforeEach(async () => {
  for (const store of Object.keys(STORES)) await dbClear(store)
})

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NOW = Date.parse('2026-01-01T12:00:00.000Z')

describe('cache keys', () => {
  it('normalizes query text', () => {
    expect(normalizeQuery('  XRD   Analysis\n Nanomaterials ')).toBe('xrd analysis nanomaterials')
    expect(normalizeQuery(null)).toBe('')
  })

  it('expands and sorts source ids', () => {
    expect(expandSources(['peerreviewed', 'openalex'])).toEqual([
      'crossref', 'doaj', 'europepmc', 'openalex'
    ])
    expect(expandSources(['doaj', 'openalex'])).toEqual(['doaj', 'openalex'])
  })

  it('uses normalized query, expanded sources and rows only', () => {
    const expected = cacheKey('xrd analysis', ['crossref', 'doaj', 'europepmc', 'openalex'], 10)
    expect(cacheKey('  XRD   Analysis ', ['peerreviewed'], '10')).toBe(expected)
    expect(cacheKey({ query: 'XRD Analysis', sourceIds: ['peerreviewed'], rows: 10 })).toBe(expected)
    expect(cacheKey('xrd analysis', ['openalex'], 20)).not.toBe(expected)

    const withPrivateFields = cacheKey({
      query: 'xrd analysis', sourceIds: ['peerreviewed'], rows: 10,
      email: 'someone@institution.edu', reviewOnly: false, oaOnly: true
    })
    expect(withPrivateFields).toBe(expected)
    expect(expected).not.toContain('someone@institution.edu')
  })
})

describe('cache freshness', () => {
  const entry = makeCacheEntry(
    { results: [{ key: 'r1' }], sources: ['openalex'] },
    { key: 'k1', sourceIds: ['openalex'], rows: 10, now: NOW }
  )

  it('treats result-bearing entries as fresh for 24h and stale for up to 7d', () => {
    expect(entry.fetchedAt).toBe('2026-01-01T12:00:00.000Z')
    expect(isFresh(entry, NOW + 23 * HOUR)).toBe(true)
    expect(cacheStatus(entry, NOW + 23 * HOUR)).toBe('fresh')
    expect(isFresh(entry, NOW + 25 * HOUR)).toBe(false)
    expect(isStale(entry, NOW + 25 * HOUR)).toBe(true)
    expect(cacheStatus(entry, NOW + 6 * DAY)).toBe('stale')
    expect(isStale(entry, NOW + 8 * DAY)).toBe(false)
    expect(cacheStatus(entry, NOW + 8 * DAY)).toBe('expired')
    expect(cacheStatus(null, NOW)).toBe('missing')
  })

  it('gives empty successes a one-hour lifetime', () => {
    const empty = makeCacheEntry(
      { results: [], sources: [] },
      { key: 'empty', sourceIds: ['openalex'], rows: 10, now: NOW }
    )
    expect(isFresh(empty, NOW + 30 * 60 * 1000)).toBe(true)
    expect(isFresh(empty, NOW + 2 * HOUR)).toBe(false)
    expect(isStale(empty, NOW + 2 * HOUR)).toBe(false)
    expect(cacheStatus(empty, NOW + 2 * HOUR)).toBe('expired')
  })
})

describe('source health', () => {
  it('reports ok, error and no-results per attempted provider', () => {
    const health = summarizeSourceHealth({
      attempted: expandSources(['peerreviewed', 'arxiv']),
      sources: ['openalex', 'arxiv'],
      errors: ['crossref: gateway timeout'],
      results: [
        { key: '1', source: 'OpenAlex' },
        { key: '2', source: 'OpenAlex' },
        { key: '3', source: 'arXiv' }
      ]
    })
    expect(health.find((item) => item.id === 'openalex')).toMatchObject({ status: 'ok', count: 2 })
    expect(health.find((item) => item.id === 'arxiv')).toMatchObject({ status: 'ok', count: 1 })
    expect(health.find((item) => item.id === 'crossref')).toMatchObject({ status: 'error', message: 'gateway timeout' })
    expect(health.find((item) => item.id === 'doaj').status).toBe('empty')
    expect(health.find((item) => item.id === 'europepmc').status).toBe('empty')
    expect(health).toHaveLength(5)
  })

  it('keeps unattributed errors visible', () => {
    const health = summarizeSourceHealth({ attempted: ['openalex'], errors: ['search aborted'] })
    expect(health.some((item) => item.status === 'error' && item.message === 'search aborted')).toBe(true)
  })
})

describe('cache storage adapters', () => {
  it('writes and reads pre-Unpaywall results through the storage layer', async () => {
    const key = cacheKey('graphite', ['openalex'], 10)
    const entry = await writeCacheEntry(key, {
      results: [{ key: 'r1', title: 'Graphite study' }],
      sources: ['openalex'],
      errors: [],
      query: 'graphite'
    }, { sourceIds: ['openalex'], rows: 10 })

    expect(entry.id).toBe(key)
    expect(entry.enriched).toBe(false)
    const stored = await readCacheEntry(key)
    expect(stored.results).toHaveLength(1)
    expect(stored.results[0].title).toBe('Graphite study')
    expect((await listCacheEntries()).map((item) => item.id)).toEqual([key])
    expect((await exportBackup()).data.searchCache).toBeUndefined()
  })

  it('never caches provider errors or enriched results', async () => {
    const key = cacheKey('graphite', ['openalex'], 10)
    expect(await writeCacheEntry(key, {
      results: [{ key: 'r1' }], sources: [], errors: ['openalex: failed'], query: 'graphite'
    }, { sourceIds: ['openalex'], rows: 10 })).toBeNull()
    expect(await writeCacheEntry(key, {
      results: [{ key: 'r1' }], sources: ['openalex'], errors: [], enriched: true, query: 'graphite'
    }, { sourceIds: ['openalex'], rows: 10 })).toBeNull()
    expect(await dbGetAll('searchCache')).toHaveLength(0)
  })

  it('deletes entries and drops expired ones on read', async () => {
    const key = cacheKey('graphite', ['openalex'], 10)
    await writeCacheEntry(key, { results: [{ key: 'r1' }], sources: ['openalex'] }, { sourceIds: ['openalex'], rows: 10 })
    expect(await deleteCacheEntry(key)).toBe(true)
    expect(await readCacheEntry(key)).toBeNull()

    await dbPut('searchCache', makeCacheEntry(
      { results: [{ key: 'old' }], sources: ['openalex'] },
      { key: 'old-key', sourceIds: ['openalex'], rows: 10, now: NOW - 9 * DAY }
    ))
    expect(await readCacheEntry('old-key')).toBeNull()
    expect(await dbGetAll('searchCache')).toHaveLength(0)
  })

  it('prunes expired entries and caps the entry count', async () => {
    const start = Date.now()
    for (let index = 0; index < 55; index += 1) {
      await dbPut('searchCache', makeCacheEntry(
        { results: [{ key: `r${index}` }], sources: ['openalex'] },
        { key: `k${index}`, sourceIds: ['openalex'], rows: 10, now: start - index * 60 * 1000 }
      ))
    }
    await dbPut('searchCache', makeCacheEntry(
      { results: [{ key: 'ancient' }], sources: ['openalex'] },
      { key: 'ancient', sourceIds: ['openalex'], rows: 10, now: start - 9 * DAY }
    ))

    const removed = await pruneSearchCache()
    const entries = await listCacheEntries()
    expect(removed).toBe(56 - CACHE_LIMITS.maxEntries)
    expect(entries).toHaveLength(CACHE_LIMITS.maxEntries)
    expect(entries[0].id).toBe('k0')
    expect(entries.some((entry) => entry.id === 'ancient')).toBe(false)
    expect(entries.some((entry) => entry.id === 'k55')).toBe(false)
  })

  it('prunes oldest entries until the byte budget is met', async () => {
    const start = Date.now()
    const big = (key) => ({ results: [{ key, abstract: 'x'.repeat(40_000) }], sources: ['openalex'] })
    await dbPut('searchCache', makeCacheEntry(big('new'), {
      key: 'new', sourceIds: ['openalex'], rows: 10, now: start
    }))
    await dbPut('searchCache', makeCacheEntry(big('old'), {
      key: 'old', sourceIds: ['openalex'], rows: 10, now: start - 60 * 1000
    }))

    expect(await pruneSearchCache({ maxBytes: 150_000 })).toBe(1)
    expect(await readCacheEntry('new')).not.toBeNull()
    expect(await readCacheEntry('old')).toBeNull()
  })
})
