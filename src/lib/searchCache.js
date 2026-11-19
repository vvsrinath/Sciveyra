import { dbDelete, dbGet, dbGetAll, dbPut } from './storage.js'
import { PEER_REVIEWED_SOURCE_IDS } from './metadata.js'
import { nowIso } from './util.js'

/**
 * Local, volatile cache for Reference Finder's pre-Unpaywall search results.
 *
 * The key deliberately contains only the query, the expanded source list and
 * the row count. Email addresses and the client-side reviewOnly/oaOnly filters
 * are never part of it, and enriched results are never written here.
 */

export const CACHE_TTL = Object.freeze({
  freshMs: 24 * 60 * 60 * 1000,
  staleMs: 7 * 24 * 60 * 60 * 1000,
  emptyFreshMs: 60 * 60 * 1000
})

export const CACHE_LIMITS = Object.freeze({
  maxEntries: 50,
  maxBytes: 4 * 1024 * 1024
})

const RESULT_SOURCE_NAMES = {
  openalex: ['openalex'],
  crossref: ['crossref'],
  doaj: ['doaj'],
  europepmc: ['europe pmc'],
  arxiv: ['arxiv']
}

/** @param {any} [value] */
export function normalizeQuery(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** @param {any} [value] */
export function normalizeRows(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 10
  return Math.max(1, Math.min(30, Math.trunc(parsed)))
}

/**
 * Expand the peer-reviewed bundle into its concrete providers, then sort.
 * @param {any} [sourceIds]
 */
export function expandSources(sourceIds) {
  const selected = Array.isArray(sourceIds) ? sourceIds : []
  const expanded = selected.includes('peerreviewed')
    ? [...selected.filter((id) => id !== 'peerreviewed'), ...PEER_REVIEWED_SOURCE_IDS]
    : [...selected]
  return [...new Set(expanded.filter(Boolean).map((id) => String(id)))].sort()
}

/**
 * @param {any} queryOrOptions
 * @param {any} [sourceIds]
 * @param {any} [rows]
 */
function normalizeArgs(queryOrOptions, sourceIds, rows) {
  if (queryOrOptions && typeof queryOrOptions === 'object' && !Array.isArray(queryOrOptions)) {
    const options = queryOrOptions
    return {
      query: normalizeQuery(options.query),
      sourceIds: expandSources(options.sourceIds),
      rows: normalizeRows(options.rows)
    }
  }
  return {
    query: normalizeQuery(queryOrOptions),
    sourceIds: expandSources(sourceIds),
    rows: normalizeRows(rows)
  }
}

/**
 * @param {any} queryOrOptions
 * @param {any} [sourceIds]
 * @param {any} [rows]
 */
export function cacheKey(queryOrOptions, sourceIds = [], rows = 10) {
  const { query, sourceIds: ids, rows: count } = normalizeArgs(queryOrOptions, sourceIds, rows)
  return `search:v1:${query}|${ids.join(',')}|${count}`
}

function normalizedTimestamp(value) {
  if (value === undefined || value === null || value === '') return nowIso()
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString()
}

/**
 * Build a cache record from a PRE-Unpaywall searchOpenAccess payload.
 * Provider errors are intentionally not copied into the record.
 * @param {any} [payload]
 * @param {any} [options]
 */
export function makeCacheEntry(payload = {}, options = {}) {
  const { sourceIds = [], rows = 10, key = '', query = '', now } = options || {}
  const results = Array.isArray(payload.results) ? payload.results : []
  const sources = Array.isArray(payload.sources) ? [...payload.sources] : []
  const id = key || cacheKey(query, sourceIds, rows)
  const fetchedAt = normalizedTimestamp(now)
  return {
    id,
    key: id,
    query: normalizeQuery(query),
    sourceIds: expandSources(sourceIds),
    rows: normalizeRows(rows),
    results,
    sources,
    resultCount: results.length,
    fetchedAt,
    createdAt: fetchedAt,
    updatedAt: fetchedAt,
    enriched: false
  }
}

function entryTime(entry) {
  const raw = entry?.fetchedAt || entry?.updatedAt || entry?.createdAt
  const time = raw ? new Date(raw).getTime() : NaN
  return Number.isFinite(time) ? time : null
}

export function cacheAge(entry, now = Date.now()) {
  const then = entryTime(entry)
  if (then === null) return null
  return Math.max(0, Number(now) - then)
}

function isEmptyEntry(entry) {
  const count = entry?.resultCount === undefined ? entry?.results?.length : entry.resultCount
  return Number(count) === 0
}

function freshWindow(entry) {
  return isEmptyEntry(entry) ? CACHE_TTL.emptyFreshMs : CACHE_TTL.freshMs
}

function staleWindow(entry) {
  return isEmptyEntry(entry) ? CACHE_TTL.emptyFreshMs : CACHE_TTL.staleMs
}

export function isFresh(entry, now = Date.now()) {
  const age = cacheAge(entry, now)
  return age !== null && age < freshWindow(entry)
}

export function isStale(entry, now = Date.now()) {
  const age = cacheAge(entry, now)
  return age !== null && age >= freshWindow(entry) && age < staleWindow(entry)
}

export function isExpired(entry, now = Date.now()) {
  return Boolean(entry) && !isFresh(entry, now) && !isStale(entry, now)
}

export function cacheStatus(entry, now = Date.now()) {
  if (!entry) return 'missing'
  if (isFresh(entry, now)) return 'fresh'
  if (isStale(entry, now)) return 'stale'
  return 'expired'
}

function sourceFromError(error) {
  const text = String(error || '')
  const match = text.match(/^\s*([a-z]+)\s*:\s*([\s\S]+)$/i)
  if (!match) return null
  const id = match[1].toLowerCase()
  const known = [...Object.keys(RESULT_SOURCE_NAMES), 'peerreviewed']
  return known.includes(id) ? { id, message: match[2].trim() } : null
}

function sourceFromResult(result) {
  const label = String(result?.source || '').toLowerCase().trim()
  if (!label) return null
  for (const [id, names] of Object.entries(RESULT_SOURCE_NAMES)) {
    if (names.some((name) => label === name || label.startsWith(`${name} `))) return id
  }
  return null
}

/**
 * Per-provider health for the providers that were actually attempted.
 * `sources` from searchOpenAccess only lists providers that returned rows, so
 * the attempted list must be supplied separately.
 */
/**
 * @param {{attempted?: any[], sources?: any[], errors?: any[], results?: any[]}} [options]
 */
export function summarizeSourceHealth({ attempted = [], sources = [], errors = [], results = [] } = {}) {
  const attemptedIds = expandSources(attempted)
  const okSources = Array.isArray(sources) ? sources.map((id) => String(id).toLowerCase()) : []
  const errorMessages = new Map()
  const unmatchedErrors = []
  for (const error of Array.isArray(errors) ? errors : []) {
    const parsed = sourceFromError(error)
    if (!parsed) { unmatchedErrors.push(String(error)); continue }
    errorMessages.set(parsed.id, [...(errorMessages.get(parsed.id) || []), parsed.message])
  }
  const counts = new Map()
  for (const result of Array.isArray(results) ? results : []) {
    const id = sourceFromResult(result)
    if (id) counts.set(id, (counts.get(id) || 0) + 1)
  }
  const labels = {
    openalex: 'OpenAlex', crossref: 'Crossref', doaj: 'DOAJ',
    europepmc: 'Europe PMC', arxiv: 'arXiv', peerreviewed: 'Peer-reviewed journals'
  }
  const health = attemptedIds.map((id) => {
    const messages = errorMessages.get(id) || []
    if (messages.length) {
      return { id, label: labels[id] || id, status: 'error', count: counts.get(id) || 0, message: messages.join(' · ') }
    }
    if (okSources.includes(id) || (counts.get(id) || 0) > 0) {
      return { id, label: labels[id] || id, status: 'ok', count: counts.get(id) || 0, message: '' }
    }
    return { id, label: labels[id] || id, status: 'empty', count: 0, message: 'No results from this source.' }
  })
  for (const message of unmatchedErrors) {
    health.push({ id: '', label: 'Search', status: 'error', count: 0, message })
  }
  return health
}

function estimateBytes(entry) {
  try { return JSON.stringify(entry || {}).length * 2 } catch { return 0 }
}

/** Async storage adapters. Every one degrades quietly if IndexedDB is unavailable. */
export async function readCacheEntry(key) {
  try {
    const entry = await dbGet('searchCache', key)
    if (!entry || entry.id !== key) return null
    if (isExpired(entry)) { await dbDelete('searchCache', key); return null }
    return entry
  } catch {
    return null
  }
}

export async function writeCacheEntry(key, payload = {}, options = {}) {
  const { sourceIds = [], rows = 10, now } = options || {}
  if (!key || !Array.isArray(payload?.results)) return null
  // Partial provider failures and Unpaywall-enriched payloads are never cached.
  if ((Array.isArray(payload.errors) && payload.errors.length) || payload.enriched) return null
  const entry = makeCacheEntry(payload, { key, sourceIds, rows, query: payload.query || '', now })
  try {
    await dbPut('searchCache', entry)
    await pruneSearchCache()
    return entry
  } catch {
    return null
  }
}

export async function deleteCacheEntry(key) {
  try { await dbDelete('searchCache', key); return true } catch { return false }
}

export async function listCacheEntries() {
  try {
    const entries = await dbGetAll('searchCache')
    return entries
      .filter((entry) => entry && entry.id)
      .sort((a, b) => (entryTime(b) || 0) - (entryTime(a) || 0) || String(a.id).localeCompare(String(b.id)))
  } catch {
    return []
  }
}

/** Drop expired, over-count and over-budget entries. Returns the number removed. */
export async function pruneSearchCache({ maxEntries = CACHE_LIMITS.maxEntries, maxBytes = CACHE_LIMITS.maxBytes, now = Date.now() } = {}) {
  let entries
  try { entries = await dbGetAll('searchCache') } catch { return 0 }
  const viable = entries.filter((entry) => entry && entry.id && !isExpired(entry, now))
    .sort((a, b) => (entryTime(b) || 0) - (entryTime(a) || 0) || String(a.id).localeCompare(String(b.id)))
  const keep = []
  let bytes = 0
  for (const entry of viable) {
    const size = estimateBytes(entry)
    if (keep.length >= maxEntries || bytes + size > maxBytes) continue
    keep.push(entry)
    bytes += size
  }
  const keepIds = new Set(keep.map((entry) => entry.id))
  for (const entry of entries) {
    if (!entry?.id || keepIds.has(entry.id)) continue
    try { await dbDelete('searchCache', entry.id) } catch { /* volatile cache; ignore */ }
  }
  return entries.length - keep.length
}
